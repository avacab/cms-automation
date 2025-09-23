<?php

namespace Drupal\headless_cms_bridge\Service;

use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use Drupal\Core\Queue\QueueFactory;
use Drupal\Core\Queue\QueueInterface;

/**
 * Service for processing sync operations via queue.
 */
class QueueProcessorService {

  /**
   * The queue factory.
   */
  protected QueueFactory $queueFactory;

  /**
   * The content sync service.
   */
  protected ContentSyncService $contentSync;

  /**
   * The logger channel.
   */
  protected LoggerChannelInterface $logger;

  /**
   * The sync queue.
   */
  protected QueueInterface $syncQueue;

  /**
   * Constructs the QueueProcessorService.
   */
  public function __construct(
    QueueFactory $queue_factory,
    ContentSyncService $content_sync,
    LoggerChannelFactoryInterface $logger_factory
  ) {
    $this->queueFactory = $queue_factory;
    $this->contentSync = $content_sync;
    $this->logger = $logger_factory->get('headless_cms_bridge');
    $this->syncQueue = $this->queueFactory->get('headless_cms_bridge_sync');
  }

  /**
   * Queues a sync operation.
   */
  public function queueSyncOperation(array $operation): void {
    $this->syncQueue->createItem($operation);
    
    $this->logger->debug('Sync operation queued: @type:@id (@operation)', [
      '@type' => $operation['entity_type'],
      '@id' => $operation['entity_id'],
      '@operation' => $operation['operation'],
    ]);
  }

  /**
   * Processes queued sync operations.
   */
  public function processQueue(int $time_limit = 30): array {
    $start_time = time();
    $processed = 0;
    $errors = 0;
    
    $this->logger->info('Starting queue processing with time limit: @limit seconds', [
      '@limit' => $time_limit,
    ]);

    while (time() - $start_time < $time_limit) {
      $item = $this->syncQueue->claimItem();
      
      if (!$item) {
        break; // No more items
      }

      try {
        $this->processQueueItem($item);
        $this->syncQueue->deleteItem($item);
        $processed++;
        
        $this->logger->debug('Queue item processed successfully: @type:@id', [
          '@type' => $item->data['entity_type'] ?? 'unknown',
          '@id' => $item->data['entity_id'] ?? 'unknown',
        ]);
        
      }
      catch (\Exception $e) {
        $this->syncQueue->releaseItem($item);
        $errors++;
        
        $this->logger->error('Queue item processing failed: @error', [
          '@error' => $e->getMessage(),
        ]);
      }
    }

    $total_time = time() - $start_time;
    
    $this->logger->info('Queue processing completed: @processed processed, @errors errors in @time seconds', [
      '@processed' => $processed,
      '@errors' => $errors,
      '@time' => $total_time,
    ]);

    return [
      'processed' => $processed,
      'errors' => $errors,
      'time' => $total_time,
      'remaining' => $this->syncQueue->numberOfItems(),
    ];
  }

  /**
   * Processes a single queue item.
   */
  protected function processQueueItem($item): void {
    $data = $item->data;
    
    if (!isset($data['entity_type']) || !isset($data['entity_id']) || !isset($data['operation'])) {
      throw new \InvalidArgumentException('Invalid queue item data');
    }

    $entity_type = $data['entity_type'];
    $entity_id = $data['entity_id'];
    $operation = $data['operation'];

    // Load the entity
    $entity_storage = \Drupal::entityTypeManager()->getStorage($entity_type);
    
    if ($operation === 'delete') {
      // For delete operations, we can't load the entity, so create a mock
      $result = $this->contentSync->processWebhookData(
        "{$entity_type}/delete",
        ['drupal_id' => $entity_id]
      );
    }
    else {
      $entity = $entity_storage->load($entity_id);
      
      if (!$entity) {
        throw new \Exception("Entity {$entity_type}:{$entity_id} not found");
      }

      // Sync the entity
      $result = $this->contentSync->syncEntityToCMS($entity, $operation);
    }

    if (!$result['success']) {
      throw new \Exception($result['error'] ?? 'Unknown sync error');
    }
  }

  /**
   * Gets queue statistics.
   */
  public function getQueueStats(): array {
    return [
      'total_items' => $this->syncQueue->numberOfItems(),
      'queue_name' => 'headless_cms_bridge_sync',
      'last_processed' => time(),
    ];
  }

  /**
   * Clears the sync queue.
   */
  public function clearQueue(): int {
    $count = $this->syncQueue->numberOfItems();
    
    while ($item = $this->syncQueue->claimItem()) {
      $this->syncQueue->deleteItem($item);
    }
    
    $this->logger->info('Sync queue cleared: @count items removed', ['@count' => $count]);
    
    return $count;
  }

}