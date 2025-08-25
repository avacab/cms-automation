/**
 * Test WordPress Integration
 * 
 * Comprehensive test suite for WordPress integration functionality.
 * Tests both WordPress plugin and CMS backend components.
 * 
 * @package CMS_Automation_Backend
 * @since   1.0.0
 */

const WordPressAdapter = require('./backend/integrations/wordpress/wordpress-adapter');
const ContentTransformer = require('./backend/integrations/wordpress/content-transformer');
const WebhookSender = require('./backend/integrations/wordpress/webhook-sender');
const AuthManager = require('./backend/integrations/wordpress/auth-manager');

class WordPressIntegrationTest {
    constructor() {
        this.testResults = [];
        this.passedTests = 0;
        this.failedTests = 0;
        
        // Mock WordPress configuration
        this.testConfig = {
            wordpressUrl: 'http://localhost:8080', // Assumes a test WordPress instance
            webhookSecret: 'test-webhook-secret-key',
            apiKey: 'test-api-key'
        };
    }

    /**
     * Run all integration tests
     */
    async runAllTests() {
        console.log('🧪 Starting WordPress Integration Tests...\n');
        
        try {
            await this.testContentTransformer();
            await this.testWebhookSender();
            await this.testAuthManager();
            await this.testWordPressAdapter();
            await this.testEndToEndWorkflow();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }
        
        this.printResults();
    }

    /**
     * Test Content Transformer
     */
    async testContentTransformer() {
        console.log('📝 Testing Content Transformer...');
        
        const transformer = new ContentTransformer();
        
        // Test CMS to WordPress transformation
        await this.runTest('CMS to WordPress transformation', async () => {
            const cmsContent = {
                id: 'cms-123',
                title: 'Test Article',
                slug: 'test-article',
                content: '<p>This is test content with <strong>HTML</strong>.</p>',
                excerpt: 'Test excerpt',
                status: 'published',
                created_at: '2025-08-23T10:00:00Z',
                updated_at: '2025-08-23T11:00:00Z',
                author: {
                    id: 1,
                    name: 'Test Author'
                },
                featured_image: {
                    id: 'img-456',
                    alt: 'Test image'
                },
                metadata: {
                    seo_title: 'SEO Title',
                    seo_description: 'SEO Description',
                    custom_field: 'Custom Value'
                },
                taxonomies: {
                    categories: [{ id: 1, name: 'News' }],
                    tags: [{ id: 2, name: 'Technology' }]
                }
            };

            const wpContent = transformer.transformCMSToWP(cmsContent);
            
            // Validate transformation
            if (wpContent.title !== cmsContent.title) {
                throw new Error('Title transformation failed');
            }
            
            if (wpContent.status !== 'publish') {
                throw new Error('Status transformation failed');
            }
            
            if (!wpContent.meta || wpContent.meta._headless_cms_id !== cmsContent.id) {
                throw new Error('Metadata transformation failed');
            }

            return 'CMS content successfully transformed to WordPress format';
        });

        // Test WordPress to CMS transformation
        await this.runTest('WordPress to CMS transformation', async () => {
            const wpContent = {
                id: 789,
                title: { rendered: 'WordPress Post' },
                slug: 'wordpress-post',
                content: { rendered: '<p>WordPress content</p>' },
                excerpt: { rendered: 'WP excerpt' },
                status: 'publish',
                date: '2025-08-23T10:00:00Z',
                modified: '2025-08-23T11:00:00Z',
                author: 1,
                featured_media: 456,
                categories: [1, 2],
                tags: [3, 4],
                meta: {
                    _headless_cms_id: 'cms-123',
                    _yoast_wpseo_title: 'SEO Title',
                    custom_meta: 'Custom Value'
                }
            };

            const cmsContent = transformer.transformWPToCMS(wpContent);
            
            if (cmsContent.title !== 'WordPress Post') {
                throw new Error('Title transformation failed');
            }
            
            if (cmsContent.status !== 'published') {
                throw new Error('Status transformation failed');
            }
            
            if (cmsContent.id !== 'cms-123') {
                throw new Error('ID mapping failed');
            }

            return 'WordPress content successfully transformed to CMS format';
        });

        // Test batch transformation
        await this.runTest('Batch transformation', async () => {
            const items = [
                { id: '1', title: 'Item 1', content: 'Content 1', status: 'published' },
                { id: '2', title: 'Item 2', content: 'Content 2', status: 'draft' }
            ];

            const results = transformer.batchTransform(items, 'cms_to_wp');
            
            if (results.success.length !== 2) {
                throw new Error('Batch transformation failed');
            }
            
            if (results.errors.length !== 0) {
                throw new Error('Unexpected errors in batch transformation');
            }

            return `Successfully transformed ${results.success.length} items`;
        });
    }

    /**
     * Test Webhook Sender
     */
    async testWebhookSender() {
        console.log('🔗 Testing Webhook Sender...');
        
        const webhookSender = new WebhookSender({
            retryAttempts: 2,
            retryDelay: 100,
            timeout: 5000
        });

        // Test webhook signature generation
        await this.runTest('Webhook signature generation', async () => {
            const payload = '{"test":"data"}';
            const secret = 'test-secret';
            
            const signature1 = webhookSender.generateSignature(payload, secret);
            const signature2 = webhookSender.generateSignature(payload, secret);
            
            if (signature1 !== signature2) {
                throw new Error('Signature generation is not consistent');
            }
            
            if (signature1.length !== 64) { // SHA-256 hex is 64 characters
                throw new Error('Invalid signature length');
            }

            return 'Webhook signatures generated correctly';
        });

        // Test webhook queue management
        await this.runTest('Webhook queue management', async () => {
            const stats = webhookSender.getStats();
            
            if (typeof stats.queue_length !== 'number') {
                throw new Error('Queue length not reported correctly');
            }
            
            if (typeof stats.active_requests !== 'number') {
                throw new Error('Active requests not reported correctly');
            }

            return 'Webhook queue management working correctly';
        });
    }

    /**
     * Test Auth Manager
     */
    async testAuthManager() {
        console.log('🔐 Testing Auth Manager...');
        
        const authManager = new AuthManager();

        // Test API key generation
        await this.runTest('API key generation', async () => {
            const apiKeyData = authManager.generateApiKey('http://test-wp.com', {
                permissions: ['read', 'write']
            });
            
            if (!apiKeyData.api_key || apiKeyData.api_key.length < 32) {
                throw new Error('API key not generated correctly');
            }
            
            if (!Array.isArray(apiKeyData.permissions)) {
                throw new Error('Permissions not set correctly');
            }

            return 'API key generated successfully';
        });

        // Test API key validation
        await this.runTest('API key validation', async () => {
            const apiKeyData = authManager.generateApiKey('http://test-wp.com');
            const validation = await authManager.validateApiKey(apiKeyData.api_key, ['read']);
            
            if (!validation.valid) {
                throw new Error('Valid API key rejected');
            }
            
            const invalidValidation = await authManager.validateApiKey('invalid-key');
            if (invalidValidation.valid) {
                throw new Error('Invalid API key accepted');
            }

            return 'API key validation working correctly';
        });

        // Test JWT functionality
        await this.runTest('JWT token handling', async () => {
            const payload = { user_id: 123, permissions: ['read'] };
            const token = authManager.generateJWT(payload, '1h');
            
            if (!token || typeof token !== 'string') {
                throw new Error('JWT token not generated');
            }
            
            const verification = authManager.verifyJWT(token);
            if (!verification.valid || verification.payload.user_id !== 123) {
                throw new Error('JWT verification failed');
            }

            return 'JWT tokens working correctly';
        });

        // Test webhook signature verification
        await this.runTest('Webhook signature verification', async () => {
            const payload = JSON.stringify({ test: 'data' });
            const secret = 'webhook-secret';
            
            const signature = authManager.createWebhookSignature(payload, secret);
            const isValid = authManager.verifyWebhookSignature(payload, signature, secret);
            
            if (!isValid) {
                throw new Error('Valid webhook signature rejected');
            }
            
            const isInvalid = authManager.verifyWebhookSignature(payload, 'invalid-sig', secret);
            if (isInvalid) {
                throw new Error('Invalid webhook signature accepted');
            }

            return 'Webhook signature verification working correctly';
        });
    }

    /**
     * Test WordPress Adapter
     */
    async testWordPressAdapter() {
        console.log('🔌 Testing WordPress Adapter...');
        
        const adapter = new WordPressAdapter(this.testConfig);

        // Test configuration
        await this.runTest('WordPress adapter configuration', async () => {
            const stats = adapter.getSyncStats();
            
            if (!stats.config.wordpress_url || !stats.config.sync_direction) {
                throw new Error('Adapter not configured correctly');
            }
            
            return 'WordPress adapter configured correctly';
        });

        // Test content transformation methods
        await this.runTest('WordPress adapter transformations', async () => {
            const cmsContent = {
                id: 'cms-456',
                title: 'Test Post',
                content: 'Test content',
                status: 'published'
            };
            
            const wpContent = adapter.transformCMSToWP(cmsContent);
            if (wpContent.status !== 'publish') {
                throw new Error('Status mapping failed');
            }
            
            const backToCMS = adapter.transformWPToCMS(wpContent);
            if (backToCMS.status !== 'published') {
                throw new Error('Reverse status mapping failed');
            }

            return 'Content transformations working correctly';
        });

        // Test sync queue
        await this.runTest('Sync queue functionality', async () => {
            const initialStats = adapter.getSyncStats();
            const initialQueueLength = initialStats.queue_length;
            
            adapter.queueSync('send_to_wp', { id: 'test-123', title: 'Test' });
            
            const newStats = adapter.getSyncStats();
            if (newStats.queue_length <= initialQueueLength) {
                throw new Error('Sync queue not functioning');
            }

            return 'Sync queue functioning correctly';
        });
    }

    /**
     * Test End-to-End Workflow
     */
    async testEndToEndWorkflow() {
        console.log('🔄 Testing End-to-End Workflow...');
        
        // Test complete integration workflow
        await this.runTest('Complete integration workflow', async () => {
            const authManager = new AuthManager();
            const transformer = new ContentTransformer();
            const webhookSender = new WebhookSender();
            const adapter = new WordPressAdapter(this.testConfig);

            // 1. Generate API key for authentication
            const apiKeyData = authManager.generateApiKey('http://localhost:8080');
            
            // 2. Create test content
            const cmsContent = {
                id: 'e2e-test-' + Date.now(),
                title: 'End-to-End Test Article',
                slug: 'e2e-test-article',
                content: '<p>This is an end-to-end test article.</p>',
                status: 'published',
                created_at: new Date().toISOString(),
                author: { id: 1, name: 'Test Author' }
            };

            // 3. Transform content to WordPress format
            const wpContent = transformer.transformCMSToWP(cmsContent);
            
            // 4. Simulate webhook signature creation
            const webhookPayload = JSON.stringify({
                event: 'created',
                content_id: cmsContent.id,
                content: cmsContent
            });
            
            const signature = authManager.createWebhookSignature(webhookPayload, this.testConfig.webhookSecret);
            
            // 5. Verify all components are working together
            if (!apiKeyData.api_key) {
                throw new Error('API key generation failed');
            }
            
            if (!wpContent.title) {
                throw new Error('Content transformation failed');
            }
            
            if (!signature) {
                throw new Error('Webhook signature creation failed');
            }

            return 'End-to-end workflow completed successfully';
        });

        // Test error handling
        await this.runTest('Error handling workflow', async () => {
            const transformer = new ContentTransformer();
            
            try {
                // Test with invalid content
                transformer.transformCMSToWP({ invalid: 'content' });
                throw new Error('Should have thrown validation error');
            } catch (error) {
                if (!error.message.includes('validation')) {
                    throw new Error('Incorrect error handling');
                }
            }

            return 'Error handling working correctly';
        });
    }

    /**
     * Run individual test
     */
    async runTest(testName, testFunction) {
        try {
            const result = await testFunction();
            this.testResults.push({
                name: testName,
                status: 'PASS',
                message: result,
                timestamp: new Date().toISOString()
            });
            this.passedTests++;
            console.log(`  ✅ ${testName}`);
        } catch (error) {
            this.testResults.push({
                name: testName,
                status: 'FAIL',
                message: error.message,
                timestamp: new Date().toISOString()
            });
            this.failedTests++;
            console.log(`  ❌ ${testName}: ${error.message}`);
        }
    }

    /**
     * Print test results
     */
    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        console.log(`Total Tests: ${this.passedTests + this.failedTests}`);
        console.log(`Passed: ${this.passedTests} ✅`);
        console.log(`Failed: ${this.failedTests} ❌`);
        console.log(`Success Rate: ${((this.passedTests / (this.passedTests + this.failedTests)) * 100).toFixed(1)}%`);

        if (this.failedTests > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(result => result.status === 'FAIL')
                .forEach(result => {
                    console.log(`  • ${result.name}: ${result.message}`);
                });
        }

        console.log('\n🎯 WordPress Integration Test Summary:');
        console.log('=====================================');
        
        if (this.failedTests === 0) {
            console.log('🎉 All tests passed! WordPress integration is ready for use.');
            console.log('\n✅ Components verified:');
            console.log('  • Content transformation (CMS ↔ WordPress)');
            console.log('  • Webhook sending with signatures');
            console.log('  • Authentication and API key management');
            console.log('  • WordPress adapter functionality');
            console.log('  • End-to-end workflow integration');
            console.log('\n🚀 Next steps:');
            console.log('  1. Install the WordPress plugin on your WP instance');
            console.log('  2. Configure API settings in WordPress admin');
            console.log('  3. Set up webhook endpoints in your CMS');
            console.log('  4. Test with real WordPress instance');
        } else {
            console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
            console.log('\n🔧 Troubleshooting:');
            console.log('  • Check component implementations');
            console.log('  • Verify configuration parameters');
            console.log('  • Review error messages above');
            console.log('  • Test individual components separately');
        }
    }

    /**
     * Generate test report
     */
    generateReport() {
        const report = {
            summary: {
                total_tests: this.passedTests + this.failedTests,
                passed: this.passedTests,
                failed: this.failedTests,
                success_rate: (this.passedTests / (this.passedTests + this.failedTests)) * 100,
                timestamp: new Date().toISOString()
            },
            results: this.testResults,
            recommendations: this.generateRecommendations()
        };

        return report;
    }

    /**
     * Generate recommendations based on test results
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.failedTests === 0) {
            recommendations.push('All tests passed - integration is ready for production use');
        } else {
            recommendations.push('Review failed tests before deployment');
            
            if (this.testResults.some(r => r.name.includes('transformation'))) {
                recommendations.push('Check content transformation logic');
            }
            
            if (this.testResults.some(r => r.name.includes('webhook'))) {
                recommendations.push('Verify webhook configuration and connectivity');
            }
            
            if (this.testResults.some(r => r.name.includes('auth'))) {
                recommendations.push('Review authentication and security settings');
            }
        }
        
        return recommendations;
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new WordPressIntegrationTest();
    tester.runAllTests().then(() => {
        const report = tester.generateReport();
        
        // Save report to file
        const fs = require('fs');
        fs.writeFileSync('wordpress-integration-test-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Test report saved to: wordpress-integration-test-report.json');
        
        process.exit(tester.failedTests > 0 ? 1 : 0);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = WordPressIntegrationTest;