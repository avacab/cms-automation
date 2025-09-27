import { LinkedInService, LinkedInConfig } from '../LinkedInService.js';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('LinkedInService', () => {
  let linkedInService: LinkedInService;
  let mockConfig: LinkedInConfig;

  beforeEach(() => {
    mockConfig = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      accessToken: 'test-access-token',
      personUrn: 'urn:li:person:test-person-id'
    };

    linkedInService = new LinkedInService(mockConfig);

    // Reset axios mock
    mockedAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
      defaults: {
        headers: {
          common: {}
        }
      },
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
      expect(linkedInService.isConfigured()).toBe(true);
    });

    it('should detect missing configuration', () => {
      const incompleteConfig = { clientId: '', clientSecret: '' };
      const incompleteService = new LinkedInService(incompleteConfig);
      expect(incompleteService.isConfigured()).toBe(false);
    });

    it('should check readiness for publishing', () => {
      expect(linkedInService.isReadyForPublishing()).toBe(true);
      
      const serviceWithoutToken = new LinkedInService({
        clientId: 'test',
        clientSecret: 'test'
      });
      expect(serviceWithoutToken.isReadyForPublishing()).toBe(false);
    });

    it('should return correct character limit', () => {
      expect(linkedInService.getCharacterLimit()).toBe(3000);
    });
  });

  describe('OAuth Flow', () => {
    it('should generate auth URL correctly', () => {
      const redirectUri = 'http://localhost:3000/callback';
      const scopes = ['w_member_social', 'r_liteprofile'];
      
      const result = linkedInService.generateAuthUrl(redirectUri, scopes);
      
      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(result.authUrl).toContain('client_id=test-client-id');
      expect(result.authUrl).toContain('redirect_uri=' + encodeURIComponent(redirectUri));
      expect(result.authUrl).toContain('scope=w_member_social%20r_liteprofile');
      expect(result.state).toHaveLength(32);
    });

    it('should exchange code for token successfully', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-access-token',
          expires_in: 5184000
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await linkedInService.exchangeCodeForToken('test-code', 'http://localhost:3000');
      
      expect(result.success).toBe(true);
      expect(result.data?.access_token).toBe('new-access-token');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.linkedin.com/oauth/v2/accessToken',
        expect.objectContaining({
          grant_type: 'authorization_code',
          client_id: 'test-client-id',
          client_secret: 'test-client-secret',
          code: 'test-code'
        }),
        expect.any(Object)
      );
    });

    it('should handle token exchange error', async () => {
      const mockError = {
        response: {
          data: {
            error: 'invalid_grant',
            error_description: 'Invalid authorization code'
          }
        }
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      const result = await linkedInService.exchangeCodeForToken('invalid-code', 'http://localhost:3000');
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid authorization code');
    });
  });

  describe('Profile Management', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: {
          headers: {
            common: {}
          }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Recreate service to use new mock
      linkedInService = new LinkedInService(mockConfig);
    });

    it('should get user profile successfully', async () => {
      const mockProfile = {
        id: 'test-user-id',
        firstName: {
          localized: { en_US: 'John' }
        },
        lastName: {
          localized: { en_US: 'Doe' }
        },
        vanityName: 'johndoe'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockProfile
      });

      const result = await linkedInService.getUserProfile();
      
      expect(result.success).toBe(true);
      expect(result.data?.firstName).toBe('John');
      expect(result.data?.lastName).toBe('Doe');
      expect(result.data?.id).toBe('test-user-id');
    });

    it('should get user organizations successfully', async () => {
      const mockOrganizations = {
        elements: [
          {
            organization: {
              id: 'org-1',
              name: {
                localized: { en_US: 'Test Company' }
              },
              vanityName: 'test-company'
            }
          }
        ]
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockOrganizations
      });

      const result = await linkedInService.getUserOrganizations();
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Test Company');
    });
  });

  describe('Post Publishing', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: {
          headers: {
            common: {}
          }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      
      // Recreate service to use new mock
      linkedInService = new LinkedInService(mockConfig);
    });

    it('should publish post successfully', async () => {
      const mockResponse = {
        data: {
          id: 'urn:li:ugcPost:123456789'
        },
        headers: {
          'x-linkedin-id': 'urn:li:ugcPost:123456789'
        }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      const postData = {
        text: 'Test LinkedIn post',
        url: 'https://example.com/blog-post'
      };

      const result = await linkedInService.publishPost(postData);
      
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('urn:li:ugcPost:123456789');
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/ugcPosts',
        expect.objectContaining({
          author: 'urn:li:person:test-person-id',
          lifecycleState: 'PUBLISHED',
          specificContent: expect.objectContaining({
            'com.linkedin.ugc.ShareContent': expect.objectContaining({
              shareCommentary: { text: 'Test LinkedIn post' },
              shareMediaCategory: 'ARTICLE'
            })
          })
        })
      );
    });

    it('should publish organization post successfully', async () => {
      const mockResponse = {
        data: { id: 'urn:li:ugcPost:987654321' },
        headers: { 'x-linkedin-id': 'urn:li:ugcPost:987654321' }
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockResponse);

      // Set organization URN
      linkedInService.setOrganizationUrn('test-org-id');

      const postData = {
        text: 'Test organization post',
        visibility: 'PUBLIC' as const
      };

      const result = await linkedInService.publishPost(postData, true);
      
      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/ugcPosts',
        expect.objectContaining({
          author: 'urn:li:organization:test-org-id'
        })
      );
    });

    it('should handle publish error', async () => {
      const mockError = {
        response: {
          data: {
            errorCode: 'ACCESS_DENIED',
            message: 'Insufficient permissions'
          }
        }
      };

      mockAxiosInstance.post.mockRejectedValueOnce(mockError);

      const result = await linkedInService.publishPost({ text: 'Test' });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Insufficient permissions');
    });

    it('should require person or organization URN for publishing', async () => {
      const serviceWithoutUrn = new LinkedInService({
        clientId: 'test',
        clientSecret: 'test',
        accessToken: 'test'
      });

      const result = await serviceWithoutUrn.publishPost({ text: 'Test' });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('URN must be set');
    });
  });

  describe('Media Upload', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: {
          headers: {
            common: {}
          }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      linkedInService = new LinkedInService(mockConfig);
    });

    it('should upload media successfully', async () => {
      const mockRegisterResponse = {
        data: {
          value: {
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://upload.linkedin.com/test'
              }
            },
            asset: 'urn:li:digitalmediaAsset:test-asset-id'
          }
        }
      };

      const mockMediaResponse = {
        data: Buffer.from('fake-image-data')
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockRegisterResponse);
      mockedAxios.get.mockResolvedValueOnce(mockMediaResponse);
      mockedAxios.put.mockResolvedValueOnce({});

      const result = await linkedInService.uploadMedia('https://example.com/image.jpg', 'image');
      
      expect(result.success).toBe(true);
      expect(result.data?.asset).toBe('urn:li:digitalmediaAsset:test-asset-id');
    });
  });

  describe('Analytics and Posts', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: {
          headers: {
            common: {}
          }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      linkedInService = new LinkedInService(mockConfig);
    });

    it('should get post analytics successfully', async () => {
      const mockAnalytics = {
        elements: [
          { actionType: 'LIKE', totalActionCounts: 25 }
        ]
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockAnalytics
      });

      const result = await linkedInService.getPostAnalytics('urn:li:ugcPost:123');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAnalytics);
    });

    it('should get user posts successfully', async () => {
      const mockPosts = {
        elements: [
          {
            id: 'urn:li:ugcPost:123',
            specificContent: {
              'com.linkedin.ugc.ShareContent': {
                shareCommentary: { text: 'Test post' }
              }
            }
          }
        ]
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockPosts
      });

      const result = await linkedInService.getUserPosts(10);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPosts.elements);
    });

    it('should delete post successfully', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      const result = await linkedInService.deletePost('urn:li:ugcPost:123');
      
      expect(result.success).toBe(true);
      expect(result.data?.success).toBe(true);
    });
  });

  describe('Post Validation', () => {
    it('should validate valid post', () => {
      const validPost = {
        text: 'This is a valid LinkedIn post with proper content.',
        url: 'https://example.com',
        visibility: 'PUBLIC' as const
      };

      const result = linkedInService.validatePost(validPost);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject post without text', () => {
      const invalidPost = {
        text: '',
        url: 'https://example.com'
      };

      const result = linkedInService.validatePost(invalidPost);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Post text is required');
    });

    it('should reject post with too long text', () => {
      const longText = 'a'.repeat(3001); // Exceeds 3000 character limit
      const invalidPost = {
        text: longText
      };

      const result = linkedInService.validatePost(invalidPost);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Post text exceeds 3000 character limit');
    });

    it('should reject post with invalid URL', () => {
      const invalidPost = {
        text: 'Valid text',
        url: 'not-a-valid-url'
      };

      const result = linkedInService.validatePost(invalidPost);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid URL format');
    });

    it('should reject post with invalid visibility', () => {
      const invalidPost = {
        text: 'Valid text',
        visibility: 'INVALID' as any
      };

      const result = linkedInService.validatePost(invalidPost);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid visibility setting');
    });
  });

  describe('Connection Testing', () => {
    let mockAxiosInstance: any;

    beforeEach(() => {
      mockAxiosInstance = {
        get: jest.fn(),
        post: jest.fn(),
        delete: jest.fn(),
        defaults: {
          headers: {
            common: {}
          }
        }
      };
      mockedAxios.create.mockReturnValue(mockAxiosInstance);
      linkedInService = new LinkedInService(mockConfig);
    });

    it('should test connection successfully', async () => {
      const mockProfile = {
        id: 'test-user',
        firstName: { localized: { en_US: 'John' } },
        lastName: { localized: { en_US: 'Doe' } }
      };

      const mockOrganizations = {
        elements: []
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockProfile })
        .mockResolvedValueOnce({ data: mockOrganizations });

      const result = await linkedInService.testConnection();
      
      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.profile?.firstName).toBe('John');
    });

    it('should handle connection test failure', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Invalid token'));

      const result = await linkedInService.testConnection();
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Invalid token');
    });
  });

  describe('Error Handling', () => {
    it('should format LinkedIn API errors correctly', () => {
      const service = new LinkedInService(mockConfig);
      const mockError = {
        response: {
          data: {
            errorCode: 'ACCESS_DENIED',
            message: 'Insufficient permissions to perform this action'
          }
        }
      };

      const formattedError = (service as any).formatError(mockError);
      
      expect(formattedError.code).toBe('ACCESS_DENIED');
      expect(formattedError.message).toBe('Insufficient permissions to perform this action');
    });

    it('should handle OAuth errors', () => {
      const service = new LinkedInService(mockConfig);
      const oauthError = {
        response: {
          data: {
            error: 'invalid_grant',
            error_description: 'The provided authorization grant is invalid'
          }
        }
      };

      const formattedError = (service as any).formatError(oauthError);
      
      expect(formattedError.code).toBe('invalid_grant');
      expect(formattedError.message).toBe('The provided authorization grant is invalid');
    });

    it('should handle network errors', () => {
      const service = new LinkedInService(mockConfig);
      const networkError = { code: 'ENOTFOUND', message: 'Network error' };

      const formattedError = (service as any).formatError(networkError);
      
      expect(formattedError.code).toBe('NETWORK_ERROR');
      expect(formattedError.message).toBe('Network connection failed');
    });

    it('should handle timeout errors', () => {
      const service = new LinkedInService(mockConfig);
      const timeoutError = { code: 'ECONNABORTED', message: 'Timeout' };

      const formattedError = (service as any).formatError(timeoutError);
      
      expect(formattedError.code).toBe('TIMEOUT_ERROR');
      expect(formattedError.message).toContain('Request timeout');
    });
  });

  describe('Utility Methods', () => {
    it('should set access token correctly', () => {
      const newToken = 'new-access-token';
      linkedInService.setAccessToken(newToken);
      
      expect((linkedInService as any).config.accessToken).toBe(newToken);
    });

    it('should set organization URN correctly', () => {
      const orgId = 'test-org-123';
      linkedInService.setOrganizationUrn(orgId);
      
      expect((linkedInService as any).config.organizationUrn).toBe(`urn:li:organization:${orgId}`);
    });

    it('should validate URLs correctly', () => {
      const service = linkedInService as any;
      
      expect(service.isValidUrl('https://example.com')).toBe(true);
      expect(service.isValidUrl('http://example.com')).toBe(true);
      expect(service.isValidUrl('not-a-url')).toBe(false);
      expect(service.isValidUrl('')).toBe(false);
    });
  });
});