/**
 * Webhook Sender for WordPress Integration
 * 
 * Handles sending webhooks from CMS to WordPress instances
 * with retry logic, rate limiting, and error handling.
 * 
 * @package CMS_Automation_Backend
 * @since   1.0.0
 */

const axios = require('axios');
const crypto = require('crypto');
const EventEmitter = require('events');

class WebhookSender extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            retryAttempts: options.retryAttempts || 3,
            retryDelay: options.retryDelay || 1000, // Base delay in ms
            timeout: options.timeout || 10000,
            rateLimit: options.rateLimit || 10, // Max requests per minute
            maxConcurrent: options.maxConcurrent || 5,
            queueMaxSize: options.queueMaxSize || 100
        };

        this.queue = [];
        this.activeRequests = 0;
        this.rateLimitCounter = 0;
        this.isProcessing = false;
        
        // Reset rate limit counter every minute
        setInterval(() => {
            this.rateLimitCounter = 0;
        }, 60000);
        
        this.startProcessing();
    }

    /**
     * Send webhook to WordPress
     */
    async sendWebhook(webhookUrl, secret, event, data) {
        return new Promise((resolve, reject) => {
            const webhookData = {
                webhookUrl,
                secret,
                event,
                data,
                resolve,
                reject,
                attempts: 0,
                createdAt: Date.now()
            };

            if (this.queue.length >= this.config.queueMaxSize) {
                return reject(new Error('Webhook queue is full'));
            }

            this.queue.push(webhookData);
            this.emit('webhook_queued', { event, data_id: data.id });
        });
    }

    /**
     * Start processing webhook queue
     */
    startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        
        const processQueue = async () => {
            while (this.queue.length > 0 && 
                   this.activeRequests < this.config.maxConcurrent &&
                   this.rateLimitCounter < this.config.rateLimit) {
                
                const webhook = this.queue.shift();
                this.processWebhook(webhook);
            }
            
            setTimeout(processQueue, 100);
        };
        
        processQueue();
    }

    /**
     * Process individual webhook
     */
    async processWebhook(webhook) {
        this.activeRequests++;
        this.rateLimitCounter++;
        
        try {
            const result = await this.executeWebhook(webhook);
            webhook.resolve(result);
            
            this.emit('webhook_success', {
                event: webhook.event,
                data_id: webhook.data.id,
                attempts: webhook.attempts + 1,
                duration: Date.now() - webhook.createdAt
            });
            
        } catch (error) {
            webhook.attempts++;
            
            if (webhook.attempts < this.config.retryAttempts) {
                // Exponential backoff
                const delay = this.config.retryDelay * Math.pow(2, webhook.attempts - 1);
                
                setTimeout(() => {
                    this.queue.unshift(webhook); // Add back to front of queue
                }, delay);
                
                this.emit('webhook_retry', {
                    event: webhook.event,
                    data_id: webhook.data.id,
                    attempt: webhook.attempts,
                    next_retry_in: delay,
                    error: error.message
                });
                
            } else {
                webhook.reject(error);
                
                this.emit('webhook_failed', {
                    event: webhook.event,
                    data_id: webhook.data.id,
                    attempts: webhook.attempts,
                    error: error.message,
                    duration: Date.now() - webhook.createdAt
                });
            }
        } finally {
            this.activeRequests--;
        }
    }

    /**
     * Execute webhook HTTP request
     */
    async executeWebhook(webhook) {
        const { webhookUrl, secret, event, data } = webhook;
        
        // Prepare payload
        const payload = {
            event: event,
            content_id: data.id,
            content: data,
            timestamp: Math.floor(Date.now() / 1000)
        };

        // Generate signature
        const signature = this.generateSignature(JSON.stringify(payload), secret);

        // Make HTTP request
        const response = await axios.post(webhookUrl, payload, {
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-CMS-Signature': `sha256=${signature}`,
                'X-CMS-Timestamp': payload.timestamp.toString(),
                'User-Agent': 'HeadlessCMS-Webhook/1.0.0'
            }
        });

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
            status: response.status,
            data: response.data,
            headers: response.headers
        };
    }

    /**
     * Generate HMAC signature for webhook
     */
    generateSignature(payload, secret) {
        return crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }

    /**
     * Send content webhook
     */
    async sendContentWebhook(webhookUrl, secret, event, content) {
        return this.sendWebhook(webhookUrl, secret, event, content);
    }

    /**
     * Send media webhook
     */
    async sendMediaWebhook(webhookUrl, secret, event, media) {
        const mediaWebhookUrl = webhookUrl.replace('/content', '/media');
        
        const payload = {
            event: event,
            media_id: media.id,
            media: media,
            timestamp: Math.floor(Date.now() / 1000)
        };

        const signature = this.generateSignature(JSON.stringify(payload), secret);

        const response = await axios.post(mediaWebhookUrl, payload, {
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-CMS-Signature': `sha256=${signature}`,
                'X-CMS-Timestamp': payload.timestamp.toString(),
                'User-Agent': 'HeadlessCMS-Webhook/1.0.0'
            }
        });

        return {
            status: response.status,
            data: response.data
        };
    }

    /**
     * Batch send multiple webhooks
     */
    async batchSendWebhooks(webhooks) {
        const promises = webhooks.map(webhook => 
            this.sendWebhook(
                webhook.url,
                webhook.secret,
                webhook.event,
                webhook.data
            ).catch(error => ({ error: error.message, webhook }))
        );

        const results = await Promise.all(promises);
        
        return {
            successful: results.filter(r => !r.error),
            failed: results.filter(r => r.error)
        };
    }

    /**
     * Test webhook endpoint
     */
    async testWebhook(webhookUrl, secret) {
        try {
            const testData = {
                id: 'test-' + Date.now(),
                title: 'Test Webhook',
                content: 'This is a test webhook payload',
                status: 'published',
                created_at: new Date().toISOString()
            };

            await this.sendWebhook(webhookUrl, secret, 'test', testData);
            
            return { success: true, message: 'Webhook test successful' };
        } catch (error) {
            return { 
                success: false, 
                message: `Webhook test failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Get queue statistics
     */
    getStats() {
        return {
            queue_length: this.queue.length,
            active_requests: this.activeRequests,
            rate_limit_used: this.rateLimitCounter,
            rate_limit_max: this.config.rateLimit,
            is_processing: this.isProcessing,
            config: { ...this.config }
        };
    }

    /**
     * Clear the webhook queue
     */
    clearQueue() {
        const clearedCount = this.queue.length;
        
        // Reject all pending webhooks
        this.queue.forEach(webhook => {
            webhook.reject(new Error('Queue cleared'));
        });
        
        this.queue = [];
        
        this.emit('queue_cleared', { cleared_count: clearedCount });
        
        return clearedCount;
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Pause webhook processing
     */
    pause() {
        this.isProcessing = false;
        this.emit('processing_paused');
    }

    /**
     * Resume webhook processing
     */
    resume() {
        if (!this.isProcessing) {
            this.startProcessing();
            this.emit('processing_resumed');
        }
    }
}

module.exports = WebhookSender;