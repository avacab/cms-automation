<?php

namespace Drupal\headless_cms_bridge\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use Drupal\headless_cms_bridge\Service\ContentSyncService;
use Drupal\headless_cms_bridge\Service\ApiClientService;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Controller for providing status information about the integration.
 */
class StatusController extends ControllerBase {

  /**
   * The content sync service.
   */
  protected ContentSyncService $contentSync;

  /**
   * The API client service.
   */
  protected ApiClientService $apiClient;

  /**
   * The logger channel.
   */
  protected LoggerChannelInterface $logger;

  /**
   * Constructs the StatusController.
   */
  public function __construct(
    ContentSyncService $content_sync,
    ApiClientService $api_client,
    LoggerChannelFactoryInterface $logger_factory
  ) {
    $this->contentSync = $content_sync;
    $this->apiClient = $api_client;
    $this->logger = $logger_factory->get('headless_cms_bridge');
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    return new static(
      $container->get('headless_cms_bridge.content_sync'),
      $container->get('headless_cms_bridge.api_client'),
      $container->get('logger.factory')
    );
  }

  /**
   * Returns the current status of the integration.
   */
  public function getStatus(Request $request): JsonResponse {
    try {
      $detailed = $request->query->get('detailed', FALSE);
      
      // Get basic status
      $status = [
        'module' => [
          'name' => 'Headless CMS Bridge',
          'version' => '1.0.0',
          'enabled' => TRUE,
        ],
        'drupal' => [
          'version' => \Drupal::VERSION,
          'core' => \Drupal::CORE_COMPATIBILITY,
        ],
        'timestamp' => time(),
        'status' => 'operational',
      ];

      // Test CMS connection
      $connection_test = $this->apiClient->testConnection();
      $status['cms_connection'] = $connection_test;

      // Get sync service status
      $sync_status = $this->contentSync->getStatus();
      $status['sync'] = [
        'enabled' => $sync_status['config']['sync_direction'] !== 'disabled',
        'direction' => $sync_status['config']['sync_direction'],
        'statistics' => $sync_status['stats'],
      ];

      // Get configuration status
      $config = $this->apiClient->getConfig();
      $status['configuration'] = [
        'api_url_configured' => !empty($config['api_url']),
        'api_key_configured' => !empty($config['api_key']),
        'webhook_secret_configured' => !empty($config['webhook_secret']),
        'enabled_content_types' => $config['enabled_content_types'],
        'sync_direction' => $config['sync_direction'],
      ];

      // Add detailed information if requested
      if ($detailed) {
        $status['detailed'] = $this->getDetailedStatus();
      }

      // Determine overall health
      $status['healthy'] = $connection_test['success'] && 
                          !empty($config['api_url']) && 
                          !empty($config['api_key']);

      $this->logger->debug('Status request served: healthy=@healthy', [
        '@healthy' => $status['healthy'] ? 'yes' : 'no',
      ]);

      return new JsonResponse($status);

    }
    catch (\Exception $e) {
      $this->logger->error('Status request failed: @error', ['@error' => $e->getMessage()]);
      
      return new JsonResponse([
        'module' => [
          'name' => 'Headless CMS Bridge',
          'version' => '1.0.0',
          'enabled' => TRUE,
        ],
        'status' => 'error',
        'healthy' => FALSE,
        'error' => 'Failed to retrieve status information',
        'timestamp' => time(),
      ], 500);
    }
  }

  /**
   * Returns detailed status information.
   */
  protected function getDetailedStatus(): array {
    $detailed = [];

    try {
      // Module dependencies
      $detailed['dependencies'] = $this->checkDependencies();

      // Database information
      $detailed['database'] = $this->getDatabaseInfo();

      // Webhook endpoints
      $detailed['webhooks'] = $this->getWebhookInfo();

      // Recent sync activity
      $detailed['recent_activity'] = $this->getRecentActivity();

      // System requirements
      $detailed['system'] = $this->getSystemInfo();

    }
    catch (\Exception $e) {
      $detailed['error'] = 'Failed to retrieve detailed status: ' . $e->getMessage();
    }

    return $detailed;
  }

  /**
   * Checks module dependencies.
   */
  protected function checkDependencies(): array {
    $module_handler = \Drupal::service('module_handler');
    
    $required_modules = [
      'system' => 'System',
      'user' => 'User',
      'node' => 'Node',
      'field' => 'Field',
      'rest' => 'REST',
      'serialization' => 'Serialization',
    ];

    $dependencies = [];
    foreach ($required_modules as $module => $name) {
      $dependencies[$module] = [
        'name' => $name,
        'enabled' => $module_handler->moduleExists($module),
        'required' => TRUE,
      ];
    }

    $optional_modules = [
      'hal' => 'HAL',
      'jsonapi' => 'JSON:API',
    ];

    foreach ($optional_modules as $module => $name) {
      $dependencies[$module] = [
        'name' => $name,
        'enabled' => $module_handler->moduleExists($module),
        'required' => FALSE,
      ];
    }

    return $dependencies;
  }

  /**
   * Gets database information.
   */
  protected function getDatabaseInfo(): array {
    try {
      $connection = \Drupal::database();
      
      return [
        'driver' => $connection->driver(),
        'version' => $connection->version(),
        'database' => $connection->getConnectionOptions()['database'] ?? 'unknown',
        'connected' => TRUE,
      ];
    }
    catch (\Exception $e) {
      return [
        'connected' => FALSE,
        'error' => $e->getMessage(),
      ];
    }
  }

  /**
   * Gets webhook endpoint information.
   */
  protected function getWebhookInfo(): array {
    $base_url = \Drupal::request()->getSchemeAndHttpHost();
    
    $endpoints = [
      'content_create' => '/headless-cms-bridge/webhook/node/create',
      'content_update' => '/headless-cms-bridge/webhook/node/update', 
      'content_delete' => '/headless-cms-bridge/webhook/node/delete',
      'user_create' => '/headless-cms-bridge/webhook/user/create',
      'user_update' => '/headless-cms-bridge/webhook/user/update',
      'user_delete' => '/headless-cms-bridge/webhook/user/delete',
      'term_create' => '/headless-cms-bridge/webhook/taxonomy_term/create',
      'term_update' => '/headless-cms-bridge/webhook/taxonomy_term/update',
      'term_delete' => '/headless-cms-bridge/webhook/taxonomy_term/delete',
      'test' => '/headless-cms-bridge/webhook/test',
    ];

    $webhook_info = [];
    foreach ($endpoints as $name => $path) {
      $webhook_info[$name] = [
        'path' => $path,
        'full_url' => $base_url . $path,
        'method' => 'POST',
      ];
    }

    return $webhook_info;
  }

  /**
   * Gets recent sync activity information.
   */
  protected function getRecentActivity(): array {
    try {
      // This would typically query a log table or cache
      // For now, return basic statistics from the sync service
      $status = $this->contentSync->getStatus();
      
      return [
        'last_sync_attempt' => $status['stats']['nodes']['last_sync'] ?? NULL,
        'total_operations' => $status['stats']['total_operations'] ?? 0,
        'recent_errors' => [], // Would come from a log table
      ];
    }
    catch (\Exception $e) {
      return [
        'error' => 'Failed to retrieve activity information',
      ];
    }
  }

  /**
   * Gets system information.
   */
  protected function getSystemInfo(): array {
    return [
      'php_version' => PHP_VERSION,
      'memory_limit' => ini_get('memory_limit'),
      'max_execution_time' => ini_get('max_execution_time'),
      'drupal_root' => DRUPAL_ROOT,
      'site_path' => \Drupal::service('site.path'),
      'environment' => [
        'https' => \Drupal::request()->isSecure(),
        'cli' => PHP_SAPI === 'cli',
      ],
    ];
  }

  /**
   * Returns health check information.
   */
  public function getHealth(Request $request): JsonResponse {
    try {
      $checks = [];

      // Check CMS connection
      $connection_test = $this->apiClient->testConnection();
      $checks['cms_connection'] = [
        'status' => $connection_test['success'] ? 'healthy' : 'unhealthy',
        'message' => $connection_test['success'] ? 'CMS API accessible' : 'CMS API not accessible',
        'details' => $connection_test,
      ];

      // Check configuration
      $config = $this->apiClient->getConfig();
      $checks['configuration'] = [
        'status' => (!empty($config['api_url']) && !empty($config['api_key'])) ? 'healthy' : 'unhealthy',
        'message' => 'Configuration status',
        'details' => [
          'api_url_configured' => !empty($config['api_url']),
          'api_key_configured' => !empty($config['api_key']),
        ],
      ];

      // Check database connection
      try {
        \Drupal::database()->query('SELECT 1')->fetchField();
        $checks['database'] = [
          'status' => 'healthy',
          'message' => 'Database connection working',
        ];
      }
      catch (\Exception $e) {
        $checks['database'] = [
          'status' => 'unhealthy',
          'message' => 'Database connection failed',
          'error' => $e->getMessage(),
        ];
      }

      // Determine overall health
      $overall_healthy = TRUE;
      foreach ($checks as $check) {
        if ($check['status'] !== 'healthy') {
          $overall_healthy = FALSE;
          break;
        }
      }

      $response = [
        'status' => $overall_healthy ? 'healthy' : 'unhealthy',
        'timestamp' => time(),
        'checks' => $checks,
      ];

      $status_code = $overall_healthy ? 200 : 503;

      return new JsonResponse($response, $status_code);

    }
    catch (\Exception $e) {
      $this->logger->error('Health check failed: @error', ['@error' => $e->getMessage()]);
      
      return new JsonResponse([
        'status' => 'unhealthy',
        'timestamp' => time(),
        'error' => 'Health check failed',
      ], 503);
    }
  }

}