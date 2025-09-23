<?php

namespace Drupal\headless_cms_bridge\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Http\ClientFactory;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Exception\ConnectException;
use Psr\Http\Message\ResponseInterface;

/**
 * Service for handling API communication with the headless CMS.
 */
class ApiClientService {

  /**
   * The config factory.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * The HTTP client.
   */
  protected ClientInterface $httpClient;

  /**
   * The logger channel.
   */
  protected LoggerChannelInterface $logger;

  /**
   * Module configuration.
   */
  protected array $config;

  /**
   * Constructs the ApiClientService.
   */
  public function __construct(
    ConfigFactoryInterface $config_factory,
    ClientFactory $http_client_factory,
    LoggerChannelFactoryInterface $logger_factory
  ) {
    $this->configFactory = $config_factory;
    $this->httpClient = $http_client_factory->fromOptions([
      'timeout' => 30,
      'verify' => TRUE,
      'headers' => [
        'Content-Type' => 'application/json',
        'User-Agent' => 'Drupal-Headless-CMS-Bridge/1.0.0',
      ],
    ]);
    $this->logger = $logger_factory->get('headless_cms_bridge');
    $this->loadConfig();
  }

  /**
   * Loads module configuration.
   */
  protected function loadConfig(): void {
    $config = $this->configFactory->get('headless_cms_bridge.settings');
    $this->config = [
      'api_url' => $config->get('api_url') ?: '',
      'api_key' => $config->get('api_key') ?: '',
      'sync_direction' => $config->get('sync_direction') ?: 'bidirectional',
      'enabled_content_types' => $config->get('enabled_content_types') ?: [],
      'webhook_secret' => $config->get('webhook_secret') ?: '',
      'retry_attempts' => $config->get('retry_attempts') ?: 3,
      'retry_delay' => $config->get('retry_delay') ?: 1000,
    ];
  }

  /**
   * Tests the connection to the CMS API.
   */
  public function testConnection(): array {
    try {
      $response = $this->makeRequest('GET', '/health');
      
      if ($response->getStatusCode() === 200) {
        $this->logger->info('CMS API connection test successful');
        return [
          'success' => TRUE,
          'status' => 'connected',
          'response_code' => $response->getStatusCode(),
          'timestamp' => time(),
        ];
      }
      else {
        throw new \Exception('Unexpected response code: ' . $response->getStatusCode());
      }
    }
    catch (\Exception $e) {
      $this->logger->error('CMS API connection test failed: @error', ['@error' => $e->getMessage()]);
      return [
        'success' => FALSE,
        'status' => 'disconnected',
        'error' => $e->getMessage(),
        'timestamp' => time(),
      ];
    }
  }

  /**
   * Creates content in the CMS.
   */
  public function createContent(string $content_type, array $data): array {
    try {
      $this->logger->info('Creating content in CMS: @type - @title', [
        '@type' => $content_type,
        '@title' => $data['title'] ?? 'Unknown',
      ]);

      $endpoint = "/api/v1/drupal/{$content_type}";
      $payload = [$content_type => $data];

      $response = $this->makeRequest('POST', $endpoint, $payload);
      $response_data = $this->parseResponse($response);

      $this->logger->info('Content created in CMS: @type - @id', [
        '@type' => $content_type,
        '@id' => $response_data['data']['id'] ?? 'unknown',
      ]);

      return [
        'success' => TRUE,
        'data' => $response_data['data'] ?? [],
        'cms_id' => $response_data['data']['id'] ?? NULL,
        'drupal_id' => $data['drupal_id'] ?? NULL,
      ];
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to create content in CMS: @error', ['@error' => $e->getMessage()]);
      throw new \Exception("CMS content creation failed: {$e->getMessage()}");
    }
  }

  /**
   * Updates content in the CMS.
   */
  public function updateContent(string $content_type, string $drupal_id, array $data): array {
    try {
      $this->logger->info('Updating content in CMS: @type - @id', [
        '@type' => $content_type,
        '@id' => $drupal_id,
      ]);

      $endpoint = "/api/v1/drupal/{$content_type}/{$drupal_id}";
      $payload = [$content_type => $data];

      $response = $this->makeRequest('PUT', $endpoint, $payload);
      $response_data = $this->parseResponse($response);

      $this->logger->info('Content updated in CMS: @type - @id', [
        '@type' => $content_type,
        '@id' => $drupal_id,
      ]);

      return [
        'success' => TRUE,
        'data' => $response_data['data'] ?? [],
        'cms_id' => $response_data['data']['id'] ?? NULL,
        'drupal_id' => $drupal_id,
      ];
    }
    catch (\Exception $e) {
      if ($this->isNotFoundError($e)) {
        $this->logger->info('Content not found in CMS, creating new: @type - @id', [
          '@type' => $content_type,
          '@id' => $drupal_id,
        ]);
        return $this->createContent($content_type, $data);
      }
      
      $this->logger->error('Failed to update content in CMS: @error', ['@error' => $e->getMessage()]);
      throw new \Exception("CMS content update failed: {$e->getMessage()}");
    }
  }

  /**
   * Deletes content from the CMS.
   */
  public function deleteContent(string $content_type, string $drupal_id): array {
    try {
      $this->logger->info('Deleting content from CMS: @type - @id', [
        '@type' => $content_type,
        '@id' => $drupal_id,
      ]);

      $endpoint = "/api/v1/drupal/{$content_type}/{$drupal_id}";
      $response = $this->makeRequest('DELETE', $endpoint);

      $this->logger->info('Content deleted from CMS: @type - @id', [
        '@type' => $content_type,
        '@id' => $drupal_id,
      ]);

      return [
        'success' => TRUE,
        'drupal_id' => $drupal_id,
        'timestamp' => time(),
      ];
    }
    catch (\Exception $e) {
      if ($this->isNotFoundError($e)) {
        $this->logger->warning('Content not found in CMS for deletion: @type - @id', [
          '@type' => $content_type,
          '@id' => $drupal_id,
        ]);
        return [
          'success' => TRUE,
          'message' => 'Content not found (already deleted)',
          'drupal_id' => $drupal_id,
        ];
      }
      
      $this->logger->error('Failed to delete content from CMS: @error', ['@error' => $e->getMessage()]);
      throw new \Exception("CMS content deletion failed: {$e->getMessage()}");
    }
  }

  /**
   * Gets content from the CMS.
   */
  public function getContent(string $content_type, string $drupal_id): ?array {
    try {
      $endpoint = "/api/v1/drupal/{$content_type}/{$drupal_id}";
      $response = $this->makeRequest('GET', $endpoint);
      $response_data = $this->parseResponse($response);

      return $response_data['data'] ?? NULL;
    }
    catch (\Exception $e) {
      if ($this->isNotFoundError($e)) {
        return NULL;
      }
      
      $this->logger->error('Failed to get content from CMS: @error', ['@error' => $e->getMessage()]);
      throw new \Exception("CMS content retrieval failed: {$e->getMessage()}");
    }
  }

  /**
   * Sends a webhook notification to the CMS.
   */
  public function sendWebhookNotification(string $event, array $data): array {
    try {
      $this->logger->debug('Sending webhook notification to CMS: @event', ['@event' => $event]);

      $payload = [
        'event' => $event,
        'data' => $data,
        'timestamp' => time(),
        'source' => 'drupal',
      ];

      $response = $this->makeRequest('POST', '/api/v1/drupal/webhooks/notify', $payload);
      $response_data = $this->parseResponse($response);

      return [
        'success' => TRUE,
        'response' => $response_data,
      ];
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to send webhook notification: @error', ['@error' => $e->getMessage()]);
      // Don't throw here as webhook notifications are not critical
      return [
        'success' => FALSE,
        'error' => $e->getMessage(),
      ];
    }
  }

  /**
   * Performs a batch operation.
   */
  public function batchOperation(string $operation, string $content_type, array $items): array {
    try {
      $this->logger->info('Performing batch operation: @op on @type (@count items)', [
        '@op' => $operation,
        '@type' => $content_type,
        '@count' => count($items),
      ]);

      $endpoint = "/api/v1/drupal/{$content_type}/batch";
      $payload = [
        'operation' => $operation,
        'items' => $items,
      ];

      $response = $this->makeRequest('POST', $endpoint, $payload);
      $response_data = $this->parseResponse($response);

      $this->logger->info('Batch operation completed: @successful successful, @failed failed', [
        '@successful' => count($response_data['successful'] ?? []),
        '@failed' => count($response_data['failed'] ?? []),
      ]);

      return $response_data;
    }
    catch (\Exception $e) {
      $this->logger->error('Batch operation failed: @error', ['@error' => $e->getMessage()]);
      throw new \Exception("Batch operation failed: {$e->getMessage()}");
    }
  }

  /**
   * Gets sync report from the CMS.
   */
  public function getSyncReport(array $options = []): array {
    try {
      $query_params = [];
      if (!empty($options['start_date'])) {
        $query_params['start_date'] = $options['start_date'];
      }
      if (!empty($options['end_date'])) {
        $query_params['end_date'] = $options['end_date'];
      }
      if (!empty($options['content_type'])) {
        $query_params['type'] = $options['content_type'];
      }

      $endpoint = '/api/v1/drupal/sync-report';
      if (!empty($query_params)) {
        $endpoint .= '?' . http_build_query($query_params);
      }

      $response = $this->makeRequest('GET', $endpoint);
      $response_data = $this->parseResponse($response);

      return $response_data['data'] ?? [];
    }
    catch (\Exception $e) {
      $this->logger->error('Failed to get sync report: @error', ['@error' => $e->getMessage()]);
      throw new \Exception("Sync report retrieval failed: {$e->getMessage()}");
    }
  }

  /**
   * Makes an HTTP request to the CMS API.
   */
  protected function makeRequest(string $method, string $endpoint, array $data = NULL): ResponseInterface {
    if (empty($this->config['api_url'])) {
      throw new \Exception('CMS API URL not configured');
    }

    $url = rtrim($this->config['api_url'], '/') . $endpoint;
    $options = [
      'headers' => [
        'Content-Type' => 'application/json',
        'User-Agent' => 'Drupal-Headless-CMS-Bridge/1.0.0',
      ],
    ];

    // Add authentication if API key is configured
    if (!empty($this->config['api_key'])) {
      $options['headers']['Authorization'] = 'Bearer ' . $this->config['api_key'];
    }

    // Add request body for POST/PUT requests
    if ($data !== NULL && in_array($method, ['POST', 'PUT', 'PATCH'])) {
      $options['json'] = $data;
    }

    $last_exception = NULL;
    $retry_attempts = $this->config['retry_attempts'];
    $retry_delay = $this->config['retry_delay'];

    for ($attempt = 1; $attempt <= $retry_attempts; $attempt++) {
      try {
        return $this->httpClient->request($method, $url, $options);
      }
      catch (RequestException | ConnectException $e) {
        $last_exception = $e;
        
        $this->logger->warning('CMS API request attempt @attempt failed: @error', [
          '@attempt' => $attempt,
          '@error' => $e->getMessage(),
        ]);

        if ($attempt < $retry_attempts) {
          usleep($retry_delay * 1000 * $attempt); // Exponential backoff
        }
      }
    }

    throw $last_exception;
  }

  /**
   * Parses the response from the CMS API.
   */
  protected function parseResponse(ResponseInterface $response): array {
    $body = $response->getBody()->getContents();
    
    if (empty($body)) {
      return [];
    }

    $data = json_decode($body, TRUE);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
      throw new \Exception('Invalid JSON response from CMS API: ' . json_last_error_msg());
    }

    return $data;
  }

  /**
   * Checks if an exception indicates a 404 Not Found error.
   */
  protected function isNotFoundError(\Exception $e): bool {
    if ($e instanceof RequestException && $e->hasResponse()) {
      return $e->getResponse()->getStatusCode() === 404;
    }
    return FALSE;
  }

  /**
   * Gets the current configuration.
   */
  public function getConfig(): array {
    return $this->config;
  }

  /**
   * Checks if sync to CMS is enabled.
   */
  public function shouldSyncToCMS(): bool {
    return in_array($this->config['sync_direction'], ['bidirectional', 'drupal_to_cms']);
  }

  /**
   * Checks if sync from CMS is enabled.
   */
  public function shouldSyncFromCMS(): bool {
    return in_array($this->config['sync_direction'], ['bidirectional', 'cms_to_drupal']);
  }

  /**
   * Checks if a content type is enabled for sync.
   */
  public function isContentTypeEnabled(string $content_type): bool {
    return empty($this->config['enabled_content_types']) ||
           in_array($content_type, $this->config['enabled_content_types']);
  }

  /**
   * Updates the configuration and reloads it.
   */
  public function refreshConfig(): void {
    $this->loadConfig();
  }

}