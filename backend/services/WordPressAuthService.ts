import crypto from 'crypto';
import { EventEmitter } from 'events';

interface WordPressCredentials {
  siteUrl: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  applicationPassword?: string;
  accessToken?: string;
  refreshToken?: string;
}

interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export class WordPressAuthService extends EventEmitter {
  private credentials: Map<string, WordPressCredentials> = new Map();
  private authStates: Map<string, string> = new Map();

  constructor() {
    super();
  }

  /**
   * Generate OAuth authorization URL for WordPress site
   */
  generateAuthUrl(siteUrl: string, clientId: string, redirectUri: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    const siteKey = this.getSiteKey(siteUrl);
    
    this.authStates.set(state, siteKey);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'auth',
      state: state
    });

    return `${siteUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    siteUrl: string,
    clientId: string,
    clientSecret: string,
    code: string,
    redirectUri: string,
    state: string
  ): Promise<AuthResult> {
    try {
      // Verify state parameter
      const siteKey = this.authStates.get(state);
      if (!siteKey || siteKey !== this.getSiteKey(siteUrl)) {
        return { success: false, error: 'Invalid state parameter' };
      }

      const response = await fetch(`${siteUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri
        })
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `OAuth token exchange failed: ${error}` };
      }

      const tokenData = await response.json();
      
      // Store credentials
      const credentials: WordPressCredentials = {
        siteUrl,
        clientId,
        clientSecret,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token
      };

      this.credentials.set(this.getSiteKey(siteUrl), credentials);
      
      // Clean up state
      this.authStates.delete(state);

      this.emit('auth_success', { siteUrl, tokenData });

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      };

    } catch (error) {
      this.emit('auth_error', { siteUrl, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Authenticate using WordPress Application Passwords
   */
  async authenticateWithApplicationPassword(
    siteUrl: string,
    username: string,
    applicationPassword: string
  ): Promise<AuthResult> {
    try {
      // Test the credentials by making a simple API call
      const testResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${username}:${applicationPassword}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!testResponse.ok) {
        return { success: false, error: 'Invalid credentials' };
      }

      const userData = await testResponse.json();

      // Store credentials
      const credentials: WordPressCredentials = {
        siteUrl,
        username,
        applicationPassword
      };

      this.credentials.set(this.getSiteKey(siteUrl), credentials);

      this.emit('auth_success', { siteUrl, method: 'application_password', user: userData });

      return { success: true };

    } catch (error) {
      this.emit('auth_error', { siteUrl, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Refresh OAuth access token
   */
  async refreshAccessToken(siteUrl: string): Promise<AuthResult> {
    const credentials = this.credentials.get(this.getSiteKey(siteUrl));
    
    if (!credentials || !credentials.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    try {
      const response = await fetch(`${siteUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: credentials.clientId!,
          client_secret: credentials.clientSecret!,
          refresh_token: credentials.refreshToken
        })
      });

      if (!response.ok) {
        return { success: false, error: 'Token refresh failed' };
      }

      const tokenData = await response.json();

      // Update stored credentials
      credentials.accessToken = tokenData.access_token;
      if (tokenData.refresh_token) {
        credentials.refreshToken = tokenData.refresh_token;
      }

      this.credentials.set(this.getSiteKey(siteUrl), credentials);

      this.emit('token_refreshed', { siteUrl, tokenData });

      return {
        success: true,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in
      };

    } catch (error) {
      this.emit('auth_error', { siteUrl, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(siteUrl: string): Record<string, string> {
    const credentials = this.credentials.get(this.getSiteKey(siteUrl));
    
    if (!credentials) {
      throw new Error('No credentials found for site');
    }

    if (credentials.accessToken) {
      // OAuth authentication
      return {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json'
      };
    } else if (credentials.username && credentials.applicationPassword) {
      // Application Password authentication
      const auth = Buffer.from(`${credentials.username}:${credentials.applicationPassword}`).toString('base64');
      return {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      };
    }

    throw new Error('No valid authentication method available');
  }

  /**
   * Test authentication for a site
   */
  async testAuthentication(siteUrl: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const headers = this.getAuthHeaders(siteUrl);
      
      const response = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
        headers
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Try to refresh token if using OAuth
          const credentials = this.credentials.get(this.getSiteKey(siteUrl));
          if (credentials?.refreshToken) {
            const refreshResult = await this.refreshAccessToken(siteUrl);
            if (refreshResult.success) {
              // Retry with new token
              const newHeaders = this.getAuthHeaders(siteUrl);
              const retryResponse = await fetch(`${siteUrl}/wp-json/wp/v2/users/me`, {
                headers: newHeaders
              });
              
              if (retryResponse.ok) {
                const userData = await retryResponse.json();
                return { success: true, user: userData };
              }
            }
          }
          return { success: false, error: 'Authentication failed' };
        }
        return { success: false, error: `API error: ${response.status}` };
      }

      const userData = await response.json();
      return { success: true, user: userData };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove stored credentials for a site
   */
  removeCredentials(siteUrl: string): boolean {
    const siteKey = this.getSiteKey(siteUrl);
    const deleted = this.credentials.delete(siteKey);
    
    if (deleted) {
      this.emit('credentials_removed', { siteUrl });
    }
    
    return deleted;
  }

  /**
   * Get all authenticated sites
   */
  getAuthenticatedSites(): string[] {
    return Array.from(this.credentials.keys()).map(key => {
      const credentials = this.credentials.get(key);
      return credentials?.siteUrl || '';
    }).filter(url => url);
  }

  /**
   * Check if site is authenticated
   */
  isAuthenticated(siteUrl: string): boolean {
    return this.credentials.has(this.getSiteKey(siteUrl));
  }

  /**
   * Get authentication method for site
   */
  getAuthMethod(siteUrl: string): 'oauth' | 'application_password' | null {
    const credentials = this.credentials.get(this.getSiteKey(siteUrl));
    
    if (!credentials) return null;
    
    if (credentials.accessToken) return 'oauth';
    if (credentials.applicationPassword) return 'application_password';
    
    return null;
  }

  /**
   * Generate unique key for site URL
   */
  private getSiteKey(siteUrl: string): string {
    return crypto.createHash('sha256').update(siteUrl.toLowerCase()).digest('hex');
  }

  /**
   * Export credentials for storage (encrypted)
   */
  exportCredentials(): string {
    const credentialsObj = Object.fromEntries(this.credentials);
    return JSON.stringify(credentialsObj);
  }

  /**
   * Import credentials from storage
   */
  importCredentials(credentialsJson: string): void {
    try {
      const credentialsObj = JSON.parse(credentialsJson);
      this.credentials = new Map(Object.entries(credentialsObj));
    } catch (error) {
      throw new Error('Invalid credentials format');
    }
  }
}