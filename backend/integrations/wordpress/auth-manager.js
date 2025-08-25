/**
 * Authentication Manager for WordPress Integration
 * 
 * Handles authentication between CMS and WordPress instances
 * including JWT tokens, API keys, and OAuth flows.
 * 
 * @package CMS_Automation_Backend
 * @since   1.0.0
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');

class AuthManager {
    constructor(options = {}) {
        this.config = {
            jwtSecret: options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
            jwtExpiry: options.jwtExpiry || '24h',
            apiKeyLength: options.apiKeyLength || 32,
            encryptionAlgorithm: options.encryptionAlgorithm || 'aes-256-gcm',
            encryptionKey: options.encryptionKey || process.env.ENCRYPTION_KEY
        };

        // Initialize encryption key if not provided
        if (!this.config.encryptionKey) {
            this.config.encryptionKey = crypto.randomBytes(32);
        }
        
        this.authenticatedInstances = new Map();
    }

    /**
     * Generate API key for WordPress instance
     */
    generateApiKey(wordpressUrl, metadata = {}) {
        const apiKey = crypto.randomBytes(this.config.apiKeyLength).toString('hex');
        
        const keyData = {
            key: apiKey,
            url: wordpressUrl,
            created_at: new Date().toISOString(),
            metadata: metadata,
            permissions: metadata.permissions || ['read', 'write'],
            expires_at: metadata.expires_at || null
        };

        // Store encrypted key data
        this.storeApiKey(apiKey, keyData);
        
        return {
            api_key: apiKey,
            created_at: keyData.created_at,
            permissions: keyData.permissions
        };
    }

    /**
     * Validate API key
     */
    async validateApiKey(apiKey, requiredPermissions = []) {
        const keyData = this.getApiKey(apiKey);
        
        if (!keyData) {
            return { valid: false, error: 'Invalid API key' };
        }

        // Check expiry
        if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
            this.revokeApiKey(apiKey);
            return { valid: false, error: 'API key expired' };
        }

        // Check permissions
        if (requiredPermissions.length > 0) {
            const hasPermission = requiredPermissions.every(permission => 
                keyData.permissions.includes(permission) || keyData.permissions.includes('admin')
            );
            
            if (!hasPermission) {
                return { valid: false, error: 'Insufficient permissions' };
            }
        }

        return { 
            valid: true, 
            data: {
                url: keyData.url,
                permissions: keyData.permissions,
                metadata: keyData.metadata
            }
        };
    }

    /**
     * Generate JWT token for temporary authentication
     */
    generateJWT(payload, expiresIn = null) {
        const tokenPayload = {
            ...payload,
            iat: Math.floor(Date.now() / 1000),
            iss: 'headless-cms'
        };

        const options = {
            expiresIn: expiresIn || this.config.jwtExpiry
        };

        return jwt.sign(tokenPayload, this.config.jwtSecret, options);
    }

    /**
     * Verify JWT token
     */
    verifyJWT(token) {
        try {
            const decoded = jwt.verify(token, this.config.jwtSecret);
            return { valid: true, payload: decoded };
        } catch (error) {
            return { 
                valid: false, 
                error: error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token'
            };
        }
    }

    /**
     * Authenticate WordPress instance
     */
    async authenticateWordPress(wordpressUrl, credentials) {
        try {
            // Test connection with provided credentials
            const response = await this.testWordPressConnection(wordpressUrl, credentials);
            
            if (!response.success) {
                return { success: false, error: response.error };
            }

            // Generate API key for this instance
            const apiKeyData = this.generateApiKey(wordpressUrl, {
                wordpress_version: response.data.version,
                authenticated_at: new Date().toISOString(),
                authentication_method: credentials.method || 'api_key'
            });

            // Store authenticated instance
            this.authenticatedInstances.set(wordpressUrl, {
                ...apiKeyData,
                last_used: new Date().toISOString(),
                status: 'active'
            });

            return {
                success: true,
                api_key: apiKeyData.api_key,
                instance_info: response.data
            };

        } catch (error) {
            return {
                success: false,
                error: `Authentication failed: ${error.message}`
            };
        }
    }

    /**
     * Test WordPress connection
     */
    async testWordPressConnection(wordpressUrl, credentials) {
        try {
            const healthEndpoint = `${wordpressUrl}/wp-json/wp-headless-cms-bridge/v1/webhook/health`;
            
            const response = await axios.get(healthEndpoint, {
                timeout: 10000,
                headers: credentials.api_key ? {
                    'Authorization': `Bearer ${credentials.api_key}`
                } : {}
            });

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            return {
                success: false,
                error: error.response ? 
                    `HTTP ${error.response.status}: ${error.response.statusText}` : 
                    error.message
            };
        }
    }

    /**
     * Revoke API key
     */
    revokeApiKey(apiKey) {
        const keyData = this.getApiKey(apiKey);
        if (keyData) {
            // Remove from authenticated instances
            this.authenticatedInstances.delete(keyData.url);
        }
        
        // Remove from storage
        this.removeApiKey(apiKey);
        
        return true;
    }

    /**
     * List authenticated WordPress instances
     */
    getAuthenticatedInstances() {
        const instances = Array.from(this.authenticatedInstances.entries()).map(([url, data]) => ({
            url,
            created_at: data.created_at,
            last_used: data.last_used,
            status: data.status,
            permissions: data.permissions
        }));

        return instances;
    }

    /**
     * Refresh authentication for an instance
     */
    async refreshAuthentication(wordpressUrl) {
        const instance = this.authenticatedInstances.get(wordpressUrl);
        if (!instance) {
            return { success: false, error: 'Instance not found' };
        }

        try {
            // Test current connection
            const testResult = await this.testWordPressConnection(wordpressUrl, {
                api_key: instance.api_key
            });

            if (testResult.success) {
                // Update last used timestamp
                instance.last_used = new Date().toISOString();
                this.authenticatedInstances.set(wordpressUrl, instance);
                
                return { success: true, status: 'active' };
            } else {
                // Mark as inactive
                instance.status = 'inactive';
                this.authenticatedInstances.set(wordpressUrl, instance);
                
                return { success: false, error: testResult.error, status: 'inactive' };
            }

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Create webhook signature for authentication
     */
    createWebhookSignature(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload, signature, secret) {
        const expectedSignature = this.createWebhookSignature(payload, secret);
        
        // Use constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(
            Buffer.from(signature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    }

    /**
     * Encrypt sensitive data
     */
    encrypt(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(this.config.encryptionAlgorithm, this.config.encryptionKey);
        
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        return {
            iv: iv.toString('hex'),
            data: encrypted
        };
    }

    /**
     * Decrypt sensitive data
     */
    decrypt(encryptedData) {
        try {
            const decipher = crypto.createDecipher(this.config.encryptionAlgorithm, this.config.encryptionKey);
            
            let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('Decryption failed: Invalid data or key');
        }
    }

    /**
     * Store API key (in production, use a database)
     */
    storeApiKey(apiKey, keyData) {
        // In production, this should use a proper database
        // For now, we'll use a simple in-memory storage
        if (!this.apiKeys) {
            this.apiKeys = new Map();
        }
        
        this.apiKeys.set(apiKey, this.encrypt(keyData));
    }

    /**
     * Get API key data
     */
    getApiKey(apiKey) {
        if (!this.apiKeys || !this.apiKeys.has(apiKey)) {
            return null;
        }
        
        try {
            const encryptedData = this.apiKeys.get(apiKey);
            return this.decrypt(encryptedData);
        } catch (error) {
            return null;
        }
    }

    /**
     * Remove API key from storage
     */
    removeApiKey(apiKey) {
        if (this.apiKeys) {
            this.apiKeys.delete(apiKey);
        }
    }

    /**
     * Generate secure random string
     */
    generateSecureRandom(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash password for storage
     */
    hashPassword(password, salt = null) {
        const actualSalt = salt || crypto.randomBytes(16).toString('hex');
        const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, 'sha512').toString('hex');
        
        return {
            hash,
            salt: actualSalt
        };
    }

    /**
     * Verify password
     */
    verifyPassword(password, hash, salt) {
        const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
        return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(verifyHash));
    }

    /**
     * Get authentication statistics
     */
    getAuthStats() {
        const instances = this.getAuthenticatedInstances();
        
        return {
            total_instances: instances.length,
            active_instances: instances.filter(i => i.status === 'active').length,
            inactive_instances: instances.filter(i => i.status === 'inactive').length,
            total_api_keys: this.apiKeys ? this.apiKeys.size : 0
        };
    }

    /**
     * Cleanup expired keys
     */
    cleanupExpiredKeys() {
        if (!this.apiKeys) return 0;
        
        let cleaned = 0;
        
        for (const [apiKey, encryptedData] of this.apiKeys.entries()) {
            try {
                const keyData = this.decrypt(encryptedData);
                
                if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
                    this.revokeApiKey(apiKey);
                    cleaned++;
                }
            } catch (error) {
                // Remove corrupted keys
                this.apiKeys.delete(apiKey);
                cleaned++;
            }
        }
        
        return cleaned;
    }
}

module.exports = AuthManager;