/**
 * WordPress Integration Adapter for Headless CMS
 * 
 * Handles bidirectional synchronization between the CMS and WordPress instances.
 * 
 * @package CMS_Automation_Backend
 * @since   1.0.0
 */

const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');

class WordPressAdapter extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            wordpressUrl: options.wordpressUrl || '',
            webhookSecret: options.webhookSecret || '',
            apiKey: options.apiKey || '',
            timeout: options.timeout || 30000,
            retries: options.retries || 3,
            syncDirection: options.syncDirection || 'cms_to_wp', // cms_to_wp, wp_to_cms, bidirectional
            syncBatch: options.syncBatch || 10
        };

        this.axios = axios.create({
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'HeadlessCMS-WordPress-Bridge/1.0.0'
            }
        });

        // Add auth if API key is provided
        if (this.config.apiKey) {
            this.axios.defaults.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }

        this.syncQueue = [];
        this.isProcessing = false;
        
        // Start processing queue
        this.startQueueProcessor();
    }

    /**
     * Test connection to WordPress
     */
    async testConnection() {
        try {
            const response = await this.axios.get(
                `${this.config.wordpressUrl}/wp-json/wp-headless-cms-bridge/v1/webhook/health`
            );
            
            return {
                success: true,
                data: response.data,
                message: 'Successfully connected to WordPress'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to connect to WordPress'
            };
        }
    }

    /**
     * Send content to WordPress
     */
    async sendContentToWordPress(cmsContent) {
        try {
            // Transform CMS content to WordPress format
            const wpContent = this.transformCMSToWP(cmsContent);
            
            // Determine if this is create or update
            const existingPost = await this.findWordPressPost(cmsContent.id);
            
            let response;
            if (existingPost) {
                // Update existing post
                response = await this.updateWordPressPost(existingPost.id, wpContent);
            } else {
                // Create new post
                response = await this.createWordPressPost(wpContent);
            }
            
            this.emit('content_synced', {
                cms_id: cmsContent.id,
                wp_id: response.data.id,
                action: existingPost ? 'update' : 'create',
                success: true
            });
            
            return response;
        } catch (error) {
            this.emit('sync_error', {
                cms_id: cmsContent.id,
                error: error.message,
                action: 'send_to_wp'
            });
            throw error;
        }
    }

    /**
     * Create WordPress post via REST API
     */
    async createWordPressPost(postData) {
        const response = await this.axios.post(
            `${this.config.wordpressUrl}/wp-json/wp/v2/posts`,
            postData
        );
        return response;
    }

    /**
     * Update WordPress post via REST API
     */
    async updateWordPressPost(postId, postData) {
        const response = await this.axios.put(
            `${this.config.wordpressUrl}/wp-json/wp/v2/posts/${postId}`,
            postData
        );
        return response;
    }

    /**
     * Delete WordPress post
     */
    async deleteWordPressPost(postId) {
        const response = await this.axios.delete(
            `${this.config.wordpressUrl}/wp-json/wp/v2/posts/${postId}`
        );
        return response;
    }

    /**
     * Find WordPress post by CMS ID (stored in meta)
     */
    async findWordPressPost(cmsId) {
        try {
            const response = await this.axios.get(
                `${this.config.wordpressUrl}/wp-json/wp/v2/posts`,
                {
                    params: {
                        meta_key: '_headless_cms_id',
                        meta_value: cmsId,
                        per_page: 1
                    }
                }
            );
            
            return response.data.length > 0 ? response.data[0] : null;
        } catch (error) {
            console.error('Error finding WordPress post:', error.message);
            return null;
        }
    }

    /**
     * Send webhook to WordPress
     */
    async sendWebhook(event, data) {
        const webhookUrl = `${this.config.wordpressUrl}/wp-json/wp-headless-cms-bridge/v1/webhook/content`;
        
        const payload = {
            event: event,
            content_id: data.id,
            content: data,
            timestamp: Math.floor(Date.now() / 1000)
        };

        // Generate signature
        const signature = this.generateWebhookSignature(JSON.stringify(payload));

        try {
            const response = await this.axios.post(webhookUrl, payload, {
                headers: {
                    'X-CMS-Signature': `sha256=${signature}`,
                    'X-CMS-Timestamp': payload.timestamp.toString()
                }
            });

            this.emit('webhook_sent', {
                event,
                content_id: data.id,
                success: true,
                response: response.status
            });

            return response;
        } catch (error) {
            this.emit('webhook_error', {
                event,
                content_id: data.id,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate HMAC signature for webhook
     */
    generateWebhookSignature(payload) {
        return crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(payload)
            .digest('hex');
    }

    /**
     * Transform CMS content to WordPress format
     */
    transformCMSToWP(cmsContent) {
        const wpContent = {
            title: cmsContent.title,
            content: cmsContent.content,
            excerpt: cmsContent.excerpt || '',
            status: this.mapCMSStatusToWP(cmsContent.status),
            slug: cmsContent.slug,
            date: cmsContent.created_at,
            modified: cmsContent.updated_at,
            meta: {
                _headless_cms_id: cmsContent.id.toString()
            }
        };

        // Handle categories and tags if present
        if (cmsContent.taxonomies) {
            if (cmsContent.taxonomies.categories) {
                wpContent.categories = cmsContent.taxonomies.categories.map(cat => cat.id);
            }
            if (cmsContent.taxonomies.tags) {
                wpContent.tags = cmsContent.taxonomies.tags.map(tag => tag.id);
            }
        }

        // Handle featured image
        if (cmsContent.featured_image) {
            wpContent.featured_media = cmsContent.featured_image.wp_id || null;
        }

        // Handle custom fields
        if (cmsContent.metadata) {
            Object.keys(cmsContent.metadata).forEach(key => {
                wpContent.meta[key] = cmsContent.metadata[key];
            });
        }

        return wpContent;
    }

    /**
     * Transform WordPress content to CMS format
     */
    transformWPToCMS(wpContent) {
        const cmsContent = {
            id: wpContent.meta._headless_cms_id || `wp_${wpContent.id}`,
            title: wpContent.title.rendered || wpContent.title,
            slug: wpContent.slug,
            content: wpContent.content.rendered || wpContent.content,
            excerpt: wpContent.excerpt.rendered || wpContent.excerpt,
            status: this.mapWPStatusToCMS(wpContent.status),
            type: wpContent.type,
            created_at: wpContent.date,
            updated_at: wpContent.modified,
            author: {
                id: wpContent.author,
                name: wpContent.author_name || ''
            },
            wordpress_id: wpContent.id
        };

        // Handle taxonomies
        if (wpContent.categories && wpContent.categories.length > 0) {
            cmsContent.taxonomies = {
                categories: wpContent.categories
            };
        }

        if (wpContent.tags && wpContent.tags.length > 0) {
            cmsContent.taxonomies = cmsContent.taxonomies || {};
            cmsContent.taxonomies.tags = wpContent.tags;
        }

        // Handle featured image
        if (wpContent.featured_media) {
            cmsContent.featured_image = {
                wp_id: wpContent.featured_media,
                id: wpContent.featured_media // Will need to be mapped to CMS media ID
            };
        }

        return cmsContent;
    }

    /**
     * Map CMS status to WordPress status
     */
    mapCMSStatusToWP(cmsStatus) {
        const statusMap = {
            'published': 'publish',
            'draft': 'draft',
            'private': 'private',
            'pending': 'pending',
            'trashed': 'trash'
        };
        
        return statusMap[cmsStatus] || 'draft';
    }

    /**
     * Map WordPress status to CMS status
     */
    mapWPStatusToCMS(wpStatus) {
        const statusMap = {
            'publish': 'published',
            'draft': 'draft',
            'private': 'private',
            'pending': 'pending',
            'trash': 'trashed'
        };
        
        return statusMap[wpStatus] || 'draft';
    }

    /**
     * Add content to sync queue
     */
    queueSync(operation, data) {
        this.syncQueue.push({
            operation,
            data,
            timestamp: Date.now(),
            retries: 0
        });
    }

    /**
     * Process sync queue
     */
    async processQueue() {
        if (this.isProcessing || this.syncQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        const batch = this.syncQueue.splice(0, this.config.syncBatch);
        
        for (const item of batch) {
            try {
                await this.processQueueItem(item);
            } catch (error) {
                // Handle retry logic
                if (item.retries < this.config.retries) {
                    item.retries++;
                    this.syncQueue.unshift(item); // Add back to front of queue
                } else {
                    this.emit('sync_failed', {
                        operation: item.operation,
                        data: item.data,
                        error: error.message,
                        retries: item.retries
                    });
                }
            }
        }

        this.isProcessing = false;
    }

    /**
     * Process individual queue item
     */
    async processQueueItem(item) {
        switch (item.operation) {
            case 'send_to_wp':
                await this.sendContentToWordPress(item.data);
                break;
            case 'webhook':
                await this.sendWebhook(item.data.event, item.data.content);
                break;
            case 'delete_from_wp':
                const wpPost = await this.findWordPressPost(item.data.cms_id);
                if (wpPost) {
                    await this.deleteWordPressPost(wpPost.id);
                }
                break;
        }
    }

    /**
     * Start queue processor
     */
    startQueueProcessor() {
        setInterval(() => {
            this.processQueue();
        }, 5000); // Process queue every 5 seconds
    }

    /**
     * Handle CMS content events
     */
    onContentEvent(event, content) {
        if (this.config.syncDirection === 'wp_to_cms') {
            return; // Only sync WP to CMS
        }

        switch (event) {
            case 'content.created':
            case 'content.updated':
            case 'content.published':
                if (this.config.syncDirection === 'cms_to_wp' || this.config.syncDirection === 'bidirectional') {
                    this.queueSync('webhook', { event: event.split('.')[1], content });
                }
                break;
            case 'content.deleted':
                if (this.config.syncDirection === 'cms_to_wp' || this.config.syncDirection === 'bidirectional') {
                    this.queueSync('delete_from_wp', { cms_id: content.id });
                }
                break;
        }
    }

    /**
     * Bulk sync content from CMS to WordPress
     */
    async bulkSyncToWordPress(contents) {
        const results = [];
        
        for (const content of contents) {
            try {
                const result = await this.sendContentToWordPress(content);
                results.push({
                    cms_id: content.id,
                    success: true,
                    wp_id: result.data.id
                });
            } catch (error) {
                results.push({
                    cms_id: content.id,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return results;
    }

    /**
     * Get sync statistics
     */
    getSyncStats() {
        return {
            queue_length: this.syncQueue.length,
            is_processing: this.isProcessing,
            config: {
                sync_direction: this.config.syncDirection,
                wordpress_url: this.config.wordpressUrl,
                batch_size: this.config.syncBatch
            }
        };
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Update axios instance if needed
        if (newConfig.apiKey) {
            this.axios.defaults.headers['Authorization'] = `Bearer ${newConfig.apiKey}`;
        }
    }
}

module.exports = WordPressAdapter;