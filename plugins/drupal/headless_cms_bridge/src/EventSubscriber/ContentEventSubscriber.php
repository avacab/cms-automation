<?php

namespace Drupal\headless_cms_bridge\EventSubscriber;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use Drupal\headless_cms_bridge\Service\ContentSyncService;
use Drupal\headless_cms_bridge\Service\QueueProcessorService;
use Drupal\node\NodeInterface;
use Drupal\taxonomy\TermInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Drupal\core_event_dispatcher\Event\Entity\EntityDeleteEvent;
use Drupal\core_event_dispatcher\Event\Entity\EntityInsertEvent;
use Drupal\core_event_dispatcher\Event\Entity\EntityUpdateEvent;
use Drupal\core_event_dispatcher\Event\Entity\EntityPresaveEvent;

/**
 * Event subscriber for content entity operations.
 */
class ContentEventSubscriber implements EventSubscriberInterface {

  /**
   * The content sync service.
   */
  protected ContentSyncService $contentSync;

  /**
   * The queue processor service.
   */
  protected QueueProcessorService $queueProcessor;

  /**
   * The config factory.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * The logger channel.
   */
  protected LoggerChannelInterface $logger;

  /**
   * Module configuration.
   */
  protected array $config;

  /**
   * Constructs the ContentEventSubscriber.
   */
  public function __construct(
    ContentSyncService $content_sync,
    QueueProcessorService $queue_processor,
    ConfigFactoryInterface $config_factory,
    LoggerChannelFactoryInterface $logger_factory
  ) {
    $this->contentSync = $content_sync;
    $this->queueProcessor = $queue_processor;
    $this->configFactory = $config_factory;
    $this->logger = $logger_factory->get('headless_cms_bridge');
    $this->loadConfig();
  }

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      'core_event_dispatcher.entity.insert' => ['onEntityInsert', 100],
      'core_event_dispatcher.entity.update' => ['onEntityUpdate', 100],
      'core_event_dispatcher.entity.delete' => ['onEntityDelete', 100],
      'core_event_dispatcher.entity.presave' => ['onEntityPresave', 50],
    ];
  }

  /**
   * Responds to entity insert events.
   */
  public function onEntityInsert(EntityInsertEvent $event): void {
    $entity = $event->getEntity();
    
    if (!$this->shouldSyncEntity($entity)) {
      return;
    }

    $this->logger->debug('Entity insert detected: @type:@id', [
      '@type' => $entity->getEntityTypeId(),
      '@id' => $entity->id(),
    ]);

    try {
      if ($this->config['sync_mode'] === 'queue') {
        $this->queueSyncOperation($entity, 'create');
      }
      else {
        $this->contentSync->syncEntityToCMS($entity, 'create');
      }
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to handle entity insert: @error', ['@error' => $e->getMessage()]);
    }
  }

  /**
   * Responds to entity update events.
   */
  public function onEntityUpdate(EntityUpdateEvent $event): void {
    $entity = $event->getEntity();
    
    if (!$this->shouldSyncEntity($entity)) {
      return;
    }

    // Skip if entity hasn't actually changed
    if (!$this->hasEntityChanged($entity, $event->getOriginal())) {
      $this->logger->debug('Entity unchanged, skipping sync: @type:@id', [
        '@type' => $entity->getEntityTypeId(),
        '@id' => $entity->id(),
      ]);
      return;
    }

    $this->logger->debug('Entity update detected: @type:@id', [
      '@type' => $entity->getEntityTypeId(),
      '@id' => $entity->id(),
    ]);

    try {
      if ($this->config['sync_mode'] === 'queue') {
        $this->queueSyncOperation($entity, 'update');
      }
      else {
        $this->contentSync->syncEntityToCMS($entity, 'update');
      }
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to handle entity update: @error', ['@error' => $e->getMessage()]);
    }
  }

  /**
   * Responds to entity delete events.
   */
  public function onEntityDelete(EntityDeleteEvent $event): void {
    $entity = $event->getEntity();
    
    if (!$this->shouldSyncEntity($entity)) {
      return;
    }

    $this->logger->debug('Entity delete detected: @type:@id', [
      '@type' => $entity->getEntityTypeId(),
      '@id' => $entity->id(),
    ]);

    try {
      if ($this->config['sync_mode'] === 'queue') {
        $this->queueSyncOperation($entity, 'delete');
      }
      else {
        $this->contentSync->syncEntityToCMS($entity, 'delete');
      }
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to handle entity delete: @error', ['@error' => $e->getMessage()]);
    }
  }

  /**
   * Responds to entity presave events.
   */
  public function onEntityPresave(EntityPresaveEvent $event): void {
    $entity = $event->getEntity();
    
    if (!$this->shouldSyncEntity($entity)) {
      return;
    }

    // Store pre-save state for comparison
    if ($entity->hasField('headless_cms_bridge_sync_hash')) {
      $current_hash = $this->generateEntityHash($entity);
      $entity->set('headless_cms_bridge_sync_hash', $current_hash);
    }

    // Mark entity as pending sync if configured
    if ($this->config['mark_pending_sync'] && $entity->hasField('headless_cms_bridge_sync_status')) {
      $entity->set('headless_cms_bridge_sync_status', 'pending');
    }
  }

  /**
   * Determines if an entity should be synced.
   */
  protected function shouldSyncEntity(EntityInterface $entity): bool {
    // Check if sync is enabled
    if (!$this->config['sync_enabled']) {
      return FALSE;
    }

    // Check entity type
    $entity_type = $entity->getEntityTypeId();
    if (!in_array($entity_type, $this->config['enabled_entity_types'])) {
      return FALSE;
    }

    // Check if entity is published (for content entities)
    if ($entity instanceof NodeInterface) {
      if (!$entity->isPublished() && !$this->config['sync_unpublished']) {
        return FALSE;
      }
      
      // Check content type
      $bundle = $entity->bundle();
      if (!empty($this->config['enabled_node_types']) && 
          !in_array($bundle, $this->config['enabled_node_types'])) {
        return FALSE;
      }
    }

    // Check taxonomy vocabulary
    if ($entity instanceof TermInterface) {
      $vocabulary = $entity->bundle();
      if (!empty($this->config['enabled_vocabularies']) && 
          !in_array($vocabulary, $this->config['enabled_vocabularies'])) {
        return FALSE;
      }
    }

    // Skip certain system entities
    if ($this->isSystemEntity($entity)) {
      return FALSE;
    }

    return TRUE;
  }

  /**
   * Checks if an entity has actually changed.
   */
  protected function hasEntityChanged(EntityInterface $entity, EntityInterface $original): bool {
    // Simple hash-based comparison
    $current_hash = $this->generateEntityHash($entity);
    $original_hash = $this->generateEntityHash($original);
    
    return $current_hash !== $original_hash;
  }

  /**
   * Generates a hash for entity comparison.
   */
  protected function generateEntityHash(EntityInterface $entity): string {
    $data = [];
    
    // Include relevant field data
    foreach ($entity->getFields() as $field_name => $field) {
      // Skip system fields and sync-specific fields
      if (strpos($field_name, 'headless_cms_bridge_') === 0 ||
          in_array($field_name, ['changed', 'revision_timestamp', 'revision_uid'])) {
        continue;
      }
      
      $data[$field_name] = $field->getValue();
    }
    
    return hash('sha256', serialize($data));
  }

  /**
   * Checks if an entity is a system entity that shouldn't be synced.
   */
  protected function isSystemEntity(EntityInterface $entity): bool {
    // Skip anonymous user
    if ($entity->getEntityTypeId() === 'user' && $entity->id() == 0) {
      return TRUE;
    }
    
    // Skip admin user if configured
    if ($entity->getEntityTypeId() === 'user' && 
        $entity->id() == 1 && 
        !$this->config['sync_admin_user']) {
      return TRUE;
    }
    
    return FALSE;
  }

  /**
   * Queues a sync operation for processing.
   */
  protected function queueSyncOperation(EntityInterface $entity, string $operation): void {
    $this->queueProcessor->queueSyncOperation([
      'entity_type' => $entity->getEntityTypeId(),
      'entity_id' => $entity->id(),
      'operation' => $operation,
      'timestamp' => time(),
    ]);
    
    $this->logger->debug('Sync operation queued: @type:@id (@operation)', [
      '@type' => $entity->getEntityTypeId(),
      '@id' => $entity->id(),
      '@operation' => $operation,
    ]);
  }

  /**
   * Loads module configuration.
   */
  protected function loadConfig(): void {
    $config = $this->configFactory->get('headless_cms_bridge.settings');
    $this->config = [
      'sync_enabled' => $config->get('sync_enabled') ?: FALSE,
      'sync_mode' => $config->get('sync_mode') ?: 'immediate',
      'enabled_entity_types' => $config->get('enabled_entity_types') ?: ['node'],
      'enabled_node_types' => $config->get('enabled_node_types') ?: [],
      'enabled_vocabularies' => $config->get('enabled_vocabularies') ?: [],
      'sync_unpublished' => $config->get('sync_unpublished') ?: FALSE,
      'sync_admin_user' => $config->get('sync_admin_user') ?: FALSE,
      'mark_pending_sync' => $config->get('mark_pending_sync') ?: FALSE,
    ];
  }

}