<?php

namespace Drupal\headless_cms_bridge\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use Drupal\node\NodeInterface;
use Drupal\user\UserInterface;
use Drupal\taxonomy\TermInterface;

/**
 * Service for synchronizing content with the headless CMS.
 */
class ContentSyncService {

  /**
   * The API client service.
   */
  protected ApiClientService $apiClient;

  /**
   * The entity type manager.
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * The logger channel.
   */
  protected LoggerChannelInterface $logger;

  /**
   * The config factory.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * The data transformer service.
   */
  protected DataTransformerService $transformer;

  /**
   * Sync statistics.
   */
  protected array $stats = [
    'nodes' => ['synced' => 0, 'failed' => 0, 'last_sync' => NULL],
    'users' => ['synced' => 0, 'failed' => 0, 'last_sync' => NULL],
    'terms' => ['synced' => 0, 'failed' => 0, 'last_sync' => NULL],
    'total_operations' => 0,
  ];

  /**
   * Constructs the ContentSyncService.
   */
  public function __construct(
    ApiClientService $api_client,
    EntityTypeManagerInterface $entity_type_manager,
    LoggerChannelFactoryInterface $logger_factory,
    ConfigFactoryInterface $config_factory
  ) {
    $this->apiClient = $api_client;
    $this->entityTypeManager = $entity_type_manager;
    $this->logger = $logger_factory->get('headless_cms_bridge');
    $this->configFactory = $config_factory;
  }

  /**
   * Sets the data transformer service.
   */
  public function setTransformer(DataTransformerService $transformer): void {
    $this->transformer = $transformer;
  }

  /**
   * Syncs an entity to the CMS.
   */
  public function syncEntityToCMS(ContentEntityInterface $entity, string $action = 'update'): array {
    try {
      if (!$this->apiClient->shouldSyncToCMS()) {
        $this->logger->info('Sync to CMS disabled by configuration');
        return ['success' => FALSE, 'message' => 'Sync to CMS disabled'];
      }

      $entity_type = $entity->getEntityTypeId();
      if (!$this->apiClient->isContentTypeEnabled($entity_type)) {
        $this->logger->debug('Content type @type not enabled for sync', ['@type' => $entity_type]);
        return ['success' => FALSE, 'message' => "Content type {$entity_type} not enabled"];
      }

      $this->logger->info('Syncing entity to CMS: @type:@id (@action)', [
        '@type' => $entity_type,
        '@id' => $entity->id(),
        '@action' => $action,
      ]);

      // Transform entity data
      if (!$this->transformer) {
        throw new \Exception('Data transformer not available');
      }

      $transformed_data = $this->transformer->transformEntityToCMS($entity);

      // Perform sync based on action
      switch ($action) {
        case 'create':
          $result = $this->apiClient->createContent($entity_type, $transformed_data);
          break;

        case 'update':
          $result = $this->apiClient->updateContent($entity_type, (string) $entity->id(), $transformed_data);
          break;

        case 'delete':
          $result = $this->apiClient->deleteContent($entity_type, (string) $entity->id());
          break;

        default:
          throw new \Exception("Unknown sync action: {$action}");
      }

      $this->updateStats($entity_type, TRUE);
      $this->stats['total_operations']++;

      $this->logger->info('Entity synced to CMS successfully: @type:@id', [
        '@type' => $entity_type,
        '@id' => $entity->id(),
      ]);

      return [
        'success' => TRUE,
        'entity_type' => $entity_type,
        'entity_id' => $entity->id(),
        'cms_result' => $result,
        'action' => $action,
        'timestamp' => time(),
      ];

    }
    catch (\Exception $e) {
      $entity_type = $entity->getEntityTypeId();
      $this->updateStats($entity_type, FALSE);
      $this->logger->error('Failed to sync entity @type:@id to CMS: @error', [
        '@type' => $entity_type,
        '@id' => $entity->id(),
        '@error' => $e->getMessage(),
      ]);

      return [
        'success' => FALSE,
        'entity_type' => $entity_type,
        'entity_id' => $entity->id(),
        'error' => $e->getMessage(),
        'action' => $action,
        'timestamp' => time(),
      ];
    }
  }

  /**
   * Syncs a node to the CMS.
   */
  public function syncNodeToCMS(NodeInterface $node, string $action = 'update'): array {
    return $this->syncEntityToCMS($node, $action);
  }

  /**
   * Syncs a user to the CMS.
   */
  public function syncUserToCMS(UserInterface $user, string $action = 'update'): array {
    return $this->syncEntityToCMS($user, $action);
  }

  /**
   * Syncs a taxonomy term to the CMS.
   */
  public function syncTermToCMS(TermInterface $term, string $action = 'update'): array {
    return $this->syncEntityToCMS($term, $action);
  }

  /**
   * Processes incoming webhook data from the CMS.
   */
  public function processWebhookData(string $event, array $data): array {
    try {
      if (!$this->apiClient->shouldSyncFromCMS()) {
        $this->logger->info('Sync from CMS disabled by configuration');
        return ['success' => FALSE, 'message' => 'Sync from CMS disabled'];
      }

      $this->logger->info('Processing webhook data: @event', ['@event' => $event]);

      // Parse event type
      [$entity_type, $action] = explode('/', $event, 2);

      if (!$this->apiClient->isContentTypeEnabled($entity_type)) {
        $this->logger->debug('Content type @type not enabled for webhook processing', ['@type' => $entity_type]);
        return ['success' => FALSE, 'message' => "Content type {$entity_type} not enabled"];
      }

      // Transform CMS data to Drupal format
      if (!$this->transformer) {
        throw new \Exception('Data transformer not available');
      }

      $drupal_data = $this->transformer->transformCMSToDrupal($entity_type, $data);

      // Process based on action
      switch ($action) {
        case 'create':
        case 'update':
          return $this->createOrUpdateEntity($entity_type, $drupal_data, $action);

        case 'delete':
          return $this->deleteEntity($entity_type, $drupal_data['drupal_id'] ?? NULL);

        default:
          throw new \Exception("Unknown webhook action: {$action}");
      }

    }
    catch (\Exception $e) {
      $this->logger->error('Failed to process webhook data: @error', ['@error' => $e->getMessage()]);
      return [
        'success' => FALSE,
        'error' => $e->getMessage(),
        'event' => $event,
        'timestamp' => time(),
      ];
    }
  }

  /**
   * Creates or updates a Drupal entity from CMS data.
   */
  protected function createOrUpdateEntity(string $entity_type, array $data, string $action): array {
    try {
      $entity_storage = $this->entityTypeManager->getStorage($entity_type);
      
      $entity = NULL;
      $entity_id = $data['drupal_id'] ?? NULL;

      // Try to load existing entity
      if ($entity_id && $action === 'update') {
        $entity = $entity_storage->load($entity_id);
      }

      if (!$entity) {
        // Create new entity
        $entity = $entity_storage->create($data);
        $operation = 'created';
      }
      else {
        // Update existing entity
        foreach ($data as $field => $value) {
          if ($entity->hasField($field)) {
            $entity->set($field, $value);
          }
        }
        $operation = 'updated';
      }

      $entity->save();

      $this->updateStats($entity_type, TRUE);
      $this->logger->info('Entity @operation from CMS data: @type:@id', [
        '@operation' => $operation,
        '@type' => $entity_type,
        '@id' => $entity->id(),
      ]);

      return [
        'success' => TRUE,
        'entity_type' => $entity_type,
        'entity_id' => $entity->id(),
        'operation' => $operation,
        'timestamp' => time(),
      ];

    }
    catch (\Exception $e) {
      $this->updateStats($entity_type, FALSE);
      $this->logger->error('Failed to @action entity from CMS data: @error', [
        '@action' => $action,
        '@error' => $e->getMessage(),
      ]);
      throw $e;
    }
  }

  /**
   * Deletes a Drupal entity.
   */
  protected function deleteEntity(string $entity_type, ?string $entity_id): array {
    try {
      if (empty($entity_id)) {
        throw new \Exception('No entity ID provided for deletion');
      }

      $entity_storage = $this->entityTypeManager->getStorage($entity_type);
      $entity = $entity_storage->load($entity_id);

      if (!$entity) {
        $this->logger->warning('Entity not found for deletion: @type:@id', [
          '@type' => $entity_type,
          '@id' => $entity_id,
        ]);
        return [
          'success' => TRUE,
          'message' => 'Entity not found (already deleted)',
          'entity_type' => $entity_type,
          'entity_id' => $entity_id,
        ];
      }

      $entity->delete();

      $this->updateStats($entity_type, TRUE);
      $this->logger->info('Entity deleted from CMS webhook: @type:@id', [
        '@type' => $entity_type,
        '@id' => $entity_id,
      ]);

      return [
        'success' => TRUE,
        'entity_type' => $entity_type,
        'entity_id' => $entity_id,
        'operation' => 'deleted',
        'timestamp' => time(),
      ];

    }
    catch (\Exception $e) {
      $this->updateStats($entity_type, FALSE);
      $this->logger->error('Failed to delete entity: @error', ['@error' => $e->getMessage()]);
      throw $e;
    }
  }

  /**
   * Performs a bulk sync of entities to the CMS.
   */
  public function bulkSyncToCMS(string $entity_type, array $entity_ids = [], int $batch_size = 50): array {
    try {
      $this->logger->info('Starting bulk sync to CMS: @type', ['@type' => $entity_type]);

      $entity_storage = $this->entityTypeManager->getStorage($entity_type);
      
      // Get entities to sync
      if (empty($entity_ids)) {
        $query = $entity_storage->getQuery()
          ->accessCheck(FALSE);
        
        // Add published filter for content entities
        if ($entity_type === 'node') {
          $query->condition('status', 1);
        }
        
        $entity_ids = $query->execute();
      }

      $results = [
        'total' => count($entity_ids),
        'successful' => 0,
        'failed' => 0,
        'errors' => [],
      ];

      // Process in batches
      $batches = array_chunk($entity_ids, $batch_size);
      
      foreach ($batches as $batch) {
        $entities = $entity_storage->loadMultiple($batch);
        
        foreach ($entities as $entity) {
          try {
            $sync_result = $this->syncEntityToCMS($entity, 'update');
            
            if ($sync_result['success']) {
              $results['successful']++;
            }
            else {
              $results['failed']++;
              $results['errors'][] = [
                'entity_id' => $entity->id(),
                'error' => $sync_result['error'] ?? 'Unknown error',
              ];
            }
          }
          catch (\Exception $e) {
            $results['failed']++;
            $results['errors'][] = [
              'entity_id' => $entity->id(),
              'error' => $e->getMessage(),
            ];
          }
        }

        // Add small delay between batches to avoid overwhelming the API
        if (count($batches) > 1) {
          usleep(500000); // 0.5 seconds
        }
      }

      $this->logger->info('Bulk sync to CMS completed: @successful successful, @failed failed', [
        '@successful' => $results['successful'],
        '@failed' => $results['failed'],
      ]);

      return $results;

    }
    catch (\Exception $e) {
      $this->logger->error('Bulk sync to CMS failed: @error', ['@error' => $e->getMessage()]);
      throw $e;
    }
  }

  /**
   * Gets the sync status and statistics.
   */
  public function getStatus(): array {
    $connection_test = $this->apiClient->testConnection();
    
    return [
      'connection' => $connection_test,
      'config' => [
        'sync_direction' => $this->apiClient->getConfig()['sync_direction'],
        'enabled_content_types' => $this->apiClient->getConfig()['enabled_content_types'],
      ],
      'stats' => $this->stats,
      'last_activity' => time(),
    ];
  }

  /**
   * Updates sync statistics.
   */
  protected function updateStats(string $entity_type, bool $success): void {
    $stat_key = $this->getStatKey($entity_type);
    
    if ($success) {
      $this->stats[$stat_key]['synced']++;
    }
    else {
      $this->stats[$stat_key]['failed']++;
    }
    
    $this->stats[$stat_key]['last_sync'] = time();
  }

  /**
   * Gets the statistics key for an entity type.
   */
  protected function getStatKey(string $entity_type): string {
    $mapping = [
      'node' => 'nodes',
      'user' => 'users',
      'taxonomy_term' => 'terms',
    ];
    
    return $mapping[$entity_type] ?? $entity_type;
  }

  /**
   * Resets sync statistics.
   */
  public function resetStats(): void {
    $this->stats = [
      'nodes' => ['synced' => 0, 'failed' => 0, 'last_sync' => NULL],
      'users' => ['synced' => 0, 'failed' => 0, 'last_sync' => NULL],
      'terms' => ['synced' => 0, 'failed' => 0, 'last_sync' => NULL],
      'total_operations' => 0,
    ];
  }

}