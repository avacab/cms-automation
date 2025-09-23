<?php

namespace Drupal\Tests\headless_cms_bridge\Unit;

use Drupal\Tests\UnitTestCase;
use Drupal\headless_cms_bridge\Service\ApiClientService;
use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Config\ImmutableConfig;
use Drupal\Core\Http\ClientFactory;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Psr7\Response;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\RequestInterface;

/**
 * Tests the ApiClientService.
 *
 * @group headless_cms_bridge
 * @coversDefaultClass \Drupal\headless_cms_bridge\Service\ApiClientService
 */
class ApiClientServiceTest extends UnitTestCase {

  /**
   * The config factory mock.
   */
  protected ConfigFactoryInterface $configFactory;

  /**
   * The HTTP client factory mock.
   */
  protected ClientFactory $httpClientFactory;

  /**
   * The HTTP client mock.
   */
  protected ClientInterface $httpClient;

  /**
   * The logger channel factory mock.
   */
  protected LoggerChannelFactoryInterface $loggerChannelFactory;

  /**
   * The logger channel mock.
   */
  protected LoggerChannelInterface $logger;

  /**
   * The API client service.
   */
  protected ApiClientService $apiClient;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();

    // Mock configuration
    $config = $this->createMock(ImmutableConfig::class);
    $config->method('get')->willReturnMap([
      ['api_url', 'http://localhost:5000'],
      ['api_key', 'test_api_key'],
      ['sync_direction', 'bidirectional'],
      ['webhook_secret', 'test_secret'],
      ['retry_attempts', 3],
      ['retry_delay', 1000],
    ]);

    $this->configFactory = $this->createMock(ConfigFactoryInterface::class);
    $this->configFactory->method('get')->with('headless_cms_bridge.settings')->willReturn($config);

    // Mock HTTP client
    $this->httpClient = $this->createMock(ClientInterface::class);
    $this->httpClientFactory = $this->createMock(ClientFactory::class);
    $this->httpClientFactory->method('fromOptions')->willReturn($this->httpClient);

    // Mock logger
    $this->logger = $this->createMock(LoggerChannelInterface::class);
    $this->loggerChannelFactory = $this->createMock(LoggerChannelFactoryInterface::class);
    $this->loggerChannelFactory->method('get')->with('headless_cms_bridge')->willReturn($this->logger);

    // Create the service
    $this->apiClient = new ApiClientService(
      $this->configFactory,
      $this->httpClientFactory,
      $this->loggerChannelFactory
    );
  }

  /**
   * @covers ::testConnection
   */
  public function testConnectionSuccess(): void {
    $response = new Response(200, [], '{"status": "ok"}');
    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('GET', 'http://localhost:5000/health', $this->anything())
      ->willReturn($response);

    $result = $this->apiClient->testConnection();

    $this->assertTrue($result['success']);
    $this->assertEquals('connected', $result['status']);
    $this->assertEquals(200, $result['response_code']);
  }

  /**
   * @covers ::testConnection
   */
  public function testConnectionFailure(): void {
    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('GET', 'http://localhost:5000/health', $this->anything())
      ->willThrowException(new RequestException('Connection failed', $this->createMock(RequestInterface::class)));

    $result = $this->apiClient->testConnection();

    $this->assertFalse($result['success']);
    $this->assertEquals('disconnected', $result['status']);
    $this->assertStringContains('Connection failed', $result['error']);
  }

  /**
   * @covers ::createContent
   */
  public function testCreateContentSuccess(): void {
    $contentData = [
      'title' => 'Test Content',
      'content_type' => 'article',
      'body' => 'Test body content',
    ];

    $response = new Response(201, [], json_encode([
      'data' => [
        'id' => 'cms_123',
        'title' => 'Test Content',
      ]
    ]));

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('POST', 'http://localhost:5000/api/v1/drupal/article', $this->callback(function($options) {
        return isset($options['json']['article']) && 
               $options['json']['article']['title'] === 'Test Content';
      }))
      ->willReturn($response);

    $result = $this->apiClient->createContent('article', $contentData);

    $this->assertTrue($result['success']);
    $this->assertEquals('cms_123', $result['cms_id']);
    $this->assertEquals('Test Content', $result['data']['title']);
  }

  /**
   * @covers ::updateContent
   */
  public function testUpdateContentSuccess(): void {
    $contentData = [
      'title' => 'Updated Content',
      'content_type' => 'article',
      'body' => 'Updated body content',
    ];

    $response = new Response(200, [], json_encode([
      'data' => [
        'id' => 'cms_123',
        'title' => 'Updated Content',
      ]
    ]));

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('PUT', 'http://localhost:5000/api/v1/drupal/article/123', $this->callback(function($options) {
        return isset($options['json']['article']) && 
               $options['json']['article']['title'] === 'Updated Content';
      }))
      ->willReturn($response);

    $result = $this->apiClient->updateContent('article', '123', $contentData);

    $this->assertTrue($result['success']);
    $this->assertEquals('cms_123', $result['cms_id']);
    $this->assertEquals('123', $result['drupal_id']);
  }

  /**
   * @covers ::updateContent
   */
  public function testUpdateContentNotFoundCreatesNew(): void {
    $contentData = [
      'title' => 'New Content',
      'content_type' => 'article',
    ];

    // First call (update) returns 404
    $updateResponse = new RequestException(
      'Not found',
      $this->createMock(RequestInterface::class),
      new Response(404)
    );

    // Second call (create) succeeds
    $createResponse = new Response(201, [], json_encode([
      'data' => [
        'id' => 'cms_123',
        'title' => 'New Content',
      ]
    ]));

    $this->httpClient->expects($this->exactly(2))
      ->method('request')
      ->willReturnOnConsecutiveCalls(
        $this->throwException($updateResponse),
        $createResponse
      );

    $result = $this->apiClient->updateContent('article', '123', $contentData);

    $this->assertTrue($result['success']);
    $this->assertEquals('cms_123', $result['cms_id']);
  }

  /**
   * @covers ::deleteContent
   */
  public function testDeleteContentSuccess(): void {
    $response = new Response(200, [], json_encode(['success' => true]));

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('DELETE', 'http://localhost:5000/api/v1/drupal/article/123', $this->anything())
      ->willReturn($response);

    $result = $this->apiClient->deleteContent('article', '123');

    $this->assertTrue($result['success']);
    $this->assertEquals('123', $result['drupal_id']);
  }

  /**
   * @covers ::deleteContent
   */
  public function testDeleteContentNotFound(): void {
    $exception = new RequestException(
      'Not found',
      $this->createMock(RequestInterface::class),
      new Response(404)
    );

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('DELETE', 'http://localhost:5000/api/v1/drupal/article/123', $this->anything())
      ->willThrowException($exception);

    $result = $this->apiClient->deleteContent('article', '123');

    $this->assertTrue($result['success']);
    $this->assertStringContains('already deleted', $result['message']);
  }

  /**
   * @covers ::getContent
   */
  public function testGetContentSuccess(): void {
    $response = new Response(200, [], json_encode([
      'data' => [
        'id' => 'cms_123',
        'title' => 'Test Content',
      ]
    ]));

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('GET', 'http://localhost:5000/api/v1/drupal/article/123', $this->anything())
      ->willReturn($response);

    $result = $this->apiClient->getContent('article', '123');

    $this->assertIsArray($result);
    $this->assertEquals('cms_123', $result['id']);
    $this->assertEquals('Test Content', $result['title']);
  }

  /**
   * @covers ::getContent
   */
  public function testGetContentNotFound(): void {
    $exception = new RequestException(
      'Not found',
      $this->createMock(RequestInterface::class),
      new Response(404)
    );

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('GET', 'http://localhost:5000/api/v1/drupal/article/123', $this->anything())
      ->willThrowException($exception);

    $result = $this->apiClient->getContent('article', '123');

    $this->assertNull($result);
  }

  /**
   * @covers ::shouldSyncToCMS
   */
  public function testShouldSyncToCMS(): void {
    $this->assertTrue($this->apiClient->shouldSyncToCMS());
  }

  /**
   * @covers ::shouldSyncFromCMS
   */
  public function testShouldSyncFromCMS(): void {
    $this->assertTrue($this->apiClient->shouldSyncFromCMS());
  }

  /**
   * @covers ::isContentTypeEnabled
   */
  public function testIsContentTypeEnabled(): void {
    // When no specific content types are configured, all should be enabled
    $this->assertTrue($this->apiClient->isContentTypeEnabled('article'));
    $this->assertTrue($this->apiClient->isContentTypeEnabled('page'));
  }

  /**
   * @covers ::batchOperation
   */
  public function testBatchOperationSuccess(): void {
    $items = [
      ['title' => 'Item 1'],
      ['title' => 'Item 2'],
    ];

    $response = new Response(200, [], json_encode([
      'successful' => [
        ['id' => 'cms_1', 'title' => 'Item 1'],
        ['id' => 'cms_2', 'title' => 'Item 2'],
      ],
      'failed' => []
    ]));

    $this->httpClient->expects($this->once())
      ->method('request')
      ->with('POST', 'http://localhost:5000/api/v1/drupal/article/batch', $this->callback(function($options) {
        return isset($options['json']['operation']) && $options['json']['operation'] === 'create' &&
               count($options['json']['items']) === 2;
      }))
      ->willReturn($response);

    $result = $this->apiClient->batchOperation('create', 'article', $items);

    $this->assertCount(2, $result['successful']);
    $this->assertCount(0, $result['failed']);
  }

}