import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';

interface OptimizelyCredentials {
  clientId: string;
  clientSecret: string;
  apiEndpoint: string;
  cmsEndpoint: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export class OptimizelyAuthService extends EventEmitter {
  private credentials?: OptimizelyCredentials;
  private httpClient: AxiosInstance;
  private tokenRefreshTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CMS-Automation-Optimizely/1.0.0'
      }
    });

    this.setupRequestInterceptors();
  }

  /**
   * Initialize authentication with Optimizely credentials
   */
  async authenticate(credentials: OptimizelyCredentials): Promise<AuthResult> {
    try {
      this.credentials = credentials;

      // Attempt client credentials flow for machine-to-machine authentication
      const tokenResult = await this.getClientCredentialsToken();
      
      if (tokenResult.success) {
        this.scheduleTokenRefresh(tokenResult.expiresIn!);
        this.emit('auth_success', { 
          clientId: credentials.clientId, 
          endpoint: credentials.apiEndpoint 
        });
      }

      return tokenResult;

    } catch (error) {
      this.emit('auth_error', { error: error.message, credentials: credentials.clientId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get access token using client credentials flow (OAuth 2.0)
   */
  private async getClientCredentialsToken(): Promise<AuthResult> {
    if (!this.credentials) {
      return { success: false, error: 'No credentials configured' };
    }

    try {
      const authHeader = Buffer.from(
        `${this.credentials.clientId}:${this.credentials.clientSecret}`
      ).toString('base64');

      const response = await this.httpClient.post(
        `${this.credentials.apiEndpoint}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'cms:read cms:write experiments:read experiments:write'
        }),
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData: TokenResponse = response.data;

      // Store tokens
      this.credentials.accessToken = tokenData.access_token;
      this.credentials.refreshToken = tokenData.refresh_token;
      this.credentials.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      };

    } catch (error) {
      const errorMessage = error.response?.data?.error_description || error.message;
      return { success: false, error: `Token request failed: ${errorMessage}` };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<AuthResult> {
    if (!this.credentials?.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const authHeader = Buffer.from(
        `${this.credentials.clientId}:${this.credentials.clientSecret}`
      ).toString('base64');

      const response = await this.httpClient.post(
        `${this.credentials.apiEndpoint}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.credentials.refreshToken
        }),
        {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokenData: TokenResponse = response.data;

      // Update stored tokens
      this.credentials.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        this.credentials.refreshToken = tokenData.refresh_token;
      }
      this.credentials.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));

      this.scheduleTokenRefresh(tokenData.expires_in);
      this.emit('token_refreshed', { clientId: this.credentials.clientId });

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      };

    } catch (error) {
      this.emit('token_refresh_error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.credentials?.accessToken) {
      return null;
    }

    // Check if token is expired or expires soon (within 5 minutes)
    if (this.credentials.tokenExpiry) {
      const now = new Date();
      const expiryWithBuffer = new Date(this.credentials.tokenExpiry.getTime() - (5 * 60 * 1000));
      
      if (now >= expiryWithBuffer) {
        const refreshResult = await this.refreshAccessToken();
        if (!refreshResult.success) {
          return null;
        }
      }
    }

    return this.credentials.accessToken;
  }

  /**
   * Get authorization headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken();
    
    if (!accessToken) {
      throw new Error('No valid access token available');
    }

    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Validate JWT token
   */
  isTokenValid(token?: string): boolean {
    const tokenToCheck = token || this.credentials?.accessToken;
    
    if (!tokenToCheck) {
      return false;
    }

    try {
      const decoded = jwt.decode(tokenToCheck, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return false;
      }

      const payload = decoded.payload as any;
      const now = Math.floor(Date.now() / 1000);
      
      return payload.exp > now;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test API connectivity and authentication
   */
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      
      const response = await this.httpClient.get(
        `${this.credentials?.cmsEndpoint}/api/episerver/v3.0/site`,
        { headers }
      );

      return {
        success: true,
        user: {
          authenticated: true,
          site: response.data.name || 'Optimizely Site',
          version: response.data.version
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Connection test failed: ${error.message}`
      };
    }
  }

  /**
   * Get user profile information
   */
  async getUserProfile(): Promise<{ success: boolean; profile?: any; error?: string }> {
    try {
      if (!this.credentials?.accessToken) {
        return { success: false, error: 'Not authenticated' };
      }

      // Decode JWT to get user information
      const decoded = jwt.decode(this.credentials.accessToken, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return { success: false, error: 'Invalid token format' };
      }

      const payload = decoded.payload as any;
      
      return {
        success: true,
        profile: {
          clientId: payload.client_id || payload.aud,
          scope: payload.scope,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          issuedAt: new Date(payload.iat * 1000).toISOString()
        }
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke authentication tokens
   */
  async logout(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.credentials?.accessToken) {
        // Attempt to revoke the token
        const authHeader = Buffer.from(
          `${this.credentials.clientId}:${this.credentials.clientSecret}`
        ).toString('base64');

        await this.httpClient.post(
          `${this.credentials.apiEndpoint}/oauth2/revoke`,
          new URLSearchParams({
            token: this.credentials.accessToken,
            token_type_hint: 'access_token'
          }),
          {
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
      }

      // Clear stored credentials
      this.credentials = undefined;
      
      // Clear refresh timer
      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = undefined;
      }

      this.emit('logout_success');
      
      return { success: true };

    } catch (error) {
      // Even if revocation fails, clear local credentials
      this.credentials = undefined;
      if (this.tokenRefreshTimer) {
        clearTimeout(this.tokenRefreshTimer);
        this.tokenRefreshTimer = undefined;
      }

      this.emit('logout_error', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if currently authenticated
   */
  isAuthenticated(): boolean {
    return !!(this.credentials?.accessToken && this.isTokenValid());
  }

  /**
   * Get current credentials info (without sensitive data)
   */
  getCredentialsInfo(): { clientId?: string; endpoint?: string; authenticated: boolean } {
    return {
      clientId: this.credentials?.clientId,
      endpoint: this.credentials?.apiEndpoint,
      authenticated: this.isAuthenticated()
    };
  }

  // Private methods

  private setupRequestInterceptors(): void {
    // Request interceptor to add auth headers
    this.httpClient.interceptors.request.use(
      async (config) => {
        if (this.credentials?.accessToken && this.isTokenValid()) {
          config.headers.Authorization = `Bearer ${this.credentials.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle auth errors
    this.httpClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.credentials?.refreshToken) {
          // Attempt token refresh
          const refreshResult = await this.refreshAccessToken();
          if (refreshResult.success) {
            // Retry original request
            return this.httpClient.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private scheduleTokenRefresh(expiresIn: number): void {
    // Clear existing timer
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }

    // Schedule refresh 5 minutes before expiry
    const refreshTime = Math.max(0, (expiresIn - 300) * 1000);
    
    this.tokenRefreshTimer = setTimeout(async () => {
      try {
        await this.refreshAccessToken();
      } catch (error) {
        this.emit('auto_refresh_error', { error: error.message });
      }
    }, refreshTime);
  }

  /**
   * Export credentials for secure storage (encrypt before storing)
   */
  exportCredentials(): string | null {
    if (!this.credentials) {
      return null;
    }

    return JSON.stringify({
      clientId: this.credentials.clientId,
      apiEndpoint: this.credentials.apiEndpoint,
      cmsEndpoint: this.credentials.cmsEndpoint,
      // Note: Don't export client secret for security
      hasAuth: !!this.credentials.accessToken
    });
  }
}