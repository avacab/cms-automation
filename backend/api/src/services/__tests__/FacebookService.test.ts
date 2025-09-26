import { FacebookService, FacebookConfig } from '../FacebookService.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FacebookService', () => {
  let facebookService: FacebookService;
  let mockConfig: FacebookConfig;

  beforeEach(() => {
    mockConfig = {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      accessToken: 'test-access-token',
      pageId: 'test-page-id'
    };

    facebookService = new FacebookService(mockConfig);

    // Reset axios mock
    mockedAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        response: {
          use: jest.fn()
        }
      }
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with correct config', () => {
      expect(facebookService.isConfigured()).toBe(true);
    });

    it('should detect missing configuration', () => {
      const incompleteConfig = { appId: '', appSecret: '' };
      const incompleteService = new FacebookService(incompleteConfig);
      expect(incompleteService.isConfigured()).toBe(false);
    });

    it('should check readiness for publishing', () => {
      expect(facebookService.isReadyForPublishing()).toBe(true);
      
      const serviceWithoutTokens = new FacebookService({
        appId: 'test',
        appSecret: 'test'
      });
      expect(serviceWithoutTokens.isReadyForPublishing()).toBe(false);
    });
  });

  describe('OAuth Flow', () => {
    it('should generate auth URL correctly', () => {
      const redirectUri = 'http://localhost:3000/callback';
      const scopes = ['pages_manage_posts'];
      
      const result = facebookService.generateAuthUrl(redirectUri, scopes);
      
      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toContain('client_id=test-app-id');
      expect(result.authUrl).toContain('redirect_uri=' + encodeURIComponent(redirectUri));
      expect(result.authUrl).toContain('scope=pages_manage_posts');
      expect(result.state).toHaveLength(32);
    });

    it('should exchange code for token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-access-token',
          token_type: 'bearer',
          expires_in: 3600
        }
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await facebookService.exchangeCodeForToken('test-code', 'http://localhost:3000');
      
      expect(result.success).toBe(true);
      expect(result.data?.access_token).toBe('new-access-token');
    });

    it('should handle token exchange error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              code: 400,
              message: 'Invalid authorization code'
            }
          }
        }
      };

      mockedAxios.get.mockRejectedValueOnce(mockError);

      const result = await facebookService.exchangeCodeForToken('invalid-code', 'http://localhost:3000');
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid authorization code');
    });
  });

  describe('Page Management', () => {
    it('should get user pages successfully', async () => {
      const mockPages = [
        {
          id: 'page-1',
          name: 'Test Page',
          access_token: 'page-token',
          category: 'Business'
        }
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: { data: mockPages }
      });

      const result = await facebookService.getUserPages('user-token');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPages);
    });

    it('should handle pages request error', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await facebookService.getUserPages('invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('Post Publishing', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Recreate service to use new mock
      facebookService = new FacebookService(mockConfig);
    });

    it('should publish post successfully', async () => {
      const mockResponse = {
        data: {
          id: 'post-123'
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const postData = {
        message: 'Test post message',
        link: 'https://example.com'
      };

      const result = await facebookService.publishPost(postData);
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('post-123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/test-page-id/feed',
        expect.objectContaining({
          ...postData,
          access_token: 'test-access-token'
        })
      );
    });

    it('should handle publish error', async () => {
      const mockError = {
        response: {
          data: {
            error: {
              code: 200,
              message: 'Insufficient permissions'
            }
          }
        }
      };

      mockAxiosInstance.post.mockRejectedValueOnce(mockError);

      const result = await facebookService.publishPost({ message: 'Test' });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Insufficient permissions');
    });

    it('should require access token and page ID for publishing', async () => {
      const serviceWithoutTokens = new FacebookService({
        appId: 'test',
        appSecret: 'test'
      });

      const result = await serviceWithoutTokens.publishPost({ message: 'Test' });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('access token and page ID must be set');
    });

    it('should schedule post with correct timestamp', async () => {
      const mockResponse = { data: { id: 'scheduled-post-123' } };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const publishTime = new Date('2024-12-01T15:00:00Z');
      const postData = { message: 'Scheduled post' };

      const result = await facebookService.schedulePost(postData, publishTime);
      
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/test-page-id/feed',
        expect.objectContaining({
          message: 'Scheduled post',
          scheduled_publish_time: 1733068800, // Unix timestamp
          published: false,
          access_token: 'test-access-token'
        })
      );
    });
  });

  describe('Media Upload', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      facebookService = new FacebookService(mockConfig);
    });

    it('should upload photo successfully', async () => {
      const mockResponse = { data: { id: 'photo-123' } };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await facebookService.uploadMedia('https://example.com/photo.jpg', 'photo');
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('photo-123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/test-page-id/photos',
        expect.objectContaining({
          url: 'https://example.com/photo.jpg',
          published: false,
          access_token: 'test-access-token'
        })
      );
    });

    it('should upload video successfully', async () => {
      const mockResponse = { data: { id: 'video-123' } };
      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const result = await facebookService.uploadMedia('https://example.com/video.mp4', 'video');
      
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test-page-id/videos', expect.any(Object));
    });
  });

  describe('Analytics', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      facebookService = new FacebookService(mockConfig);
    });

    it('should get post insights successfully', async () => {
      const mockInsights = [
        { name: 'post_impressions', values: [{ value: 100 }] },
        { name: 'post_engaged_users', values: [{ value: 25 }] }
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockInsights }
      });

      const result = await facebookService.getPostInsights('post-123');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockInsights);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/post-123/insights',
        expect.objectContaining({
          params: expect.objectContaining({
            access_token: 'test-access-token',
            metric: 'post_impressions,post_engaged_users,post_reactions_total'
          })
        })
      );
    });

    it('should get page posts successfully', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          message: 'First post',
          created_time: '2024-01-01T10:00:00Z'
        }
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockPosts }
      });

      const result = await facebookService.getPagePosts(10);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPosts);
    });
  });

  describe('Webhook Verification', () => {
    it('should verify webhook signature correctly', () => {
      const payload = '{"test": "data"}';
      const secret = 'webhook-secret';
      const validSignature = 'sha256=f4b3c4efe7c0f4c1f7b7c4e4f4c4b3c4efe7c0f4c1f7b7c4e4f4c4b3c4efe7c0';
      
      // Mock crypto.createHmac to return a predictable hash
      const originalCrypto = require('crypto');
      const mockHmac = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('f4b3c4efe7c0f4c1f7b7c4e4f4c4b3c4efe7c0f4c1f7b7c4e4f4c4b3c4efe7c0')
      };
      const mockCrypto = {
        ...originalCrypto,
        createHmac: jest.fn().mockReturnValue(mockHmac),
        timingSafeEqual: jest.fn().mockReturnValue(true)
      };

      // Use the actual implementation but with our mock
      const result = FacebookService.verifyWebhookSignature(payload, validSignature, secret);
      
      expect(result).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'webhook-secret';
      const invalidSignature = 'sha256=invalid-signature';
      
      const result = FacebookService.verifyWebhookSignature(payload, invalidSignature, secret);
      
      expect(result).toBe(false);
    });
  });

  describe('Connection Testing', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        post: jest.fn(),
        get: jest.fn(),
        delete: jest.fn()
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      facebookService = new FacebookService(mockConfig);
    });

    it('should test connection successfully', async () => {
      const mockPermissions = [
        { permission: 'pages_manage_posts', status: 'granted' },
        { permission: 'pages_read_engagement', status: 'granted' }
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { data: mockPermissions }
      });

      const result = await facebookService.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.permissions).toEqual(['pages_manage_posts', 'pages_read_engagement']);
    });

    it('should handle connection test failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Invalid token'));

      const result = await facebookService.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid token');
    });
  });

  describe('Error Handling', () => {
    it('should format Facebook API errors correctly', () => {
      const service = new FacebookService(mockConfig);
      const mockError = {
        response: {
          data: {
            error: {
              code: 190,
              message: 'Invalid OAuth access token'
            }
          }
        }
      };

      const formattedError = (service as any).formatError(mockError);
      
      expect(formattedError.code).toBe('190');
      expect(formattedError.message).toBe('Invalid OAuth access token');
    });

    it('should handle network errors', () => {
      const service = new FacebookService(mockConfig);
      const networkError = { code: 'ENOTFOUND', message: 'Network error' };

      const formattedError = (service as any).formatError(networkError);
      
      expect(formattedError.code).toBe('NETWORK_ERROR');
      expect(formattedError.message).toBe('Network connection failed');
    });

    it('should handle timeout errors', () => {
      const service = new FacebookService(mockConfig);
      const timeoutError = { code: 'ECONNABORTED', message: 'Timeout' };

      const formattedError = (service as any).formatError(timeoutError);
      
      expect(formattedError.code).toBe('TIMEOUT_ERROR');
      expect(formattedError.message).toContain('Request timeout');
    });
  });
});