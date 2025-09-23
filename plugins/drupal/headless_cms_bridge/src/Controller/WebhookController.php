<?php

namespace Drupal\headless_cms_bridge\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use Drupal\headless_cms_bridge\Service\ContentSyncService;
use Drupal\headless_cms_bridge\Service\ApiClientService;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

/**
 * Controller for handling webhook requests from the headless CMS.
 */
class WebhookController extends ControllerBase {

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
   * Constructs the WebhookController.
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
   * Handles incoming webhook requests.
   */
  public function handleWebhook(Request $request, string $event): JsonResponse {
    try {
      $this->logger->info('Webhook received: @event', ['@event' => $event]);

      // Get request data
      $content = $request->getContent();
      $data = json_decode($content, TRUE);

      if (json_last_error() !== JSON_ERROR_NONE) {
        throw new \InvalidArgumentException('Invalid JSON payload: ' . json_last_error_msg());
      }

      // Verify webhook signature if configured
      $signature = $request->headers->get('X-Signature');
      if (!$this->verifyWebhookSignature($content, $signature)) {
        $this->logger->error('Webhook signature verification failed for event: @event', ['@event' => $event]);
        return new JsonResponse(['error' => 'Unauthorized'], Response::HTTP_UNAUTHORIZED);
      }

      // Process webhook data
      $result = $this->processWebhook($event, $data);

      if ($result['success']) {
        $this->logger->info('Webhook processed successfully: @event', ['@event' => $event]);
        return new JsonResponse([
          'success' => TRUE,
          'message' => 'Webhook processed successfully',
          'event' => $event,
          'result' => $result,
          'timestamp' => time(),
        ]);
      }
      else {
        $this->logger->error('Webhook processing failed: @event - @error', [
          '@event' => $event,
          '@error' => $result['error'] ?? 'Unknown error',
        ]);
        return new JsonResponse([
          'success' => FALSE,
          'message' => 'Webhook processing failed',
          'event' => $event,
          'error' => $result['error'] ?? 'Unknown error',
          'timestamp' => time(),
        ], Response::HTTP_INTERNAL_SERVER_ERROR);
      }

    }
    catch (\InvalidArgumentException $e) {
      $this->logger->error('Invalid webhook request: @error', ['@error' => $e->getMessage()]);
      return new JsonResponse([
        'success' => FALSE,
        'message' => 'Invalid request',
        'error' => $e->getMessage(),
      ], Response::HTTP_BAD_REQUEST);
    }
    catch (\Exception $e) {
      $this->logger->error('Webhook processing error: @error', ['@error' => $e->getMessage()]);
      return new JsonResponse([
        'success' => FALSE,
        'message' => 'Internal server error',
        'error' => 'An unexpected error occurred',
      ], Response::HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Processes the webhook based on event type.
   */
  protected function processWebhook(string $event, array $data): array {
    try {
      // Validate event format
      if (!str_contains($event, '/')) {
        throw new \InvalidArgumentException("Invalid event format: {$event}");
      }

      [$entity_type, $action] = explode('/', $event, 2);

      // Validate supported entity types
      $supported_types = ['node', 'user', 'taxonomy_term'];
      if (!in_array($entity_type, $supported_types)) {
        throw new \InvalidArgumentException("Unsupported entity type: {$entity_type}");
      }

      // Validate supported actions
      $supported_actions = ['create', 'update', 'delete'];
      if (!in_array($action, $supported_actions)) {
        throw new \InvalidArgumentException("Unsupported action: {$action}");
      }

      $this->logger->debug('Processing webhook: @type/@action with data keys: @keys', [
        '@type' => $entity_type,
        '@action' => $action,
        '@keys' => implode(', ', array_keys($data)),
      ]);

      // Process the webhook data
      return $this->contentSync->processWebhookData($event, $data);

    }
    catch (\Exception $e) {
      return [
        'success' => FALSE,
        'error' => $e->getMessage(),
        'event' => $event,
      ];
    }
  }

  /**
   * Verifies the webhook signature.
   */
  protected function verifyWebhookSignature(string $payload, ?string $signature): bool {
    $webhook_secret = $this->apiClient->getConfig()['webhook_secret'] ?? '';
    
    if (empty($webhook_secret)) {
      $this->logger->warning('Webhook secret not configured, skipping signature verification');
      return TRUE;
    }

    if (empty($signature)) {
      $this->logger->warning('No webhook signature provided');
      return FALSE;
    }

    // Remove 'sha256=' prefix if present
    $signature = str_replace('sha256=', '', $signature);

    $expected_signature = hash_hmac('sha256', $payload, $webhook_secret);

    $is_valid = hash_equals($expected_signature, $signature);

    if (!$is_valid) {
      $this->logger->error('Webhook signature mismatch. Expected: @expected, Got: @actual', [
        '@expected' => substr($expected_signature, 0, 8) . '...',
        '@actual' => substr($signature, 0, 8) . '...',
      ]);
    }

    return $is_valid;
  }

  /**
   * Handles webhook test requests.
   */
  public function testWebhook(Request $request): JsonResponse {
    try {
      $this->logger->info('Webhook test request received');

      $test_data = [
        'test' => TRUE,
        'timestamp' => time(),
        'drupal_version' => \Drupal::VERSION,
        'module_version' => '1.0.0',
      ];

      return new JsonResponse([
        'success' => TRUE,
        'message' => 'Webhook endpoint is working',
        'data' => $test_data,
      ]);

    }
    catch (\Exception $e) {
      $this->logger->error('Webhook test failed: @error', ['@error' => $e->getMessage()]);
      return new JsonResponse([
        'success' => FALSE,
        'message' => 'Webhook test failed',
        'error' => $e->getMessage(),
      ], Response::HTTP_INTERNAL_SERVER_ERROR);
    }
  }

}