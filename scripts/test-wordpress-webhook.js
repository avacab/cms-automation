#!/usr/bin/env node

/**
 * Test WordPress webhook with proper HMAC signature
 */

const https = require('https');
const crypto = require('crypto');

const WORDPRESS_URL = 'https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/content';
const WEBHOOK_SECRET = process.env.HAIDRUN_WORDPRESS_WEBHOOK_SECRET || 'test-secret';

const testContent = {
  event: 'created',
  content_id: 'test-' + Date.now(),
  content: {
    id: 'test-' + Date.now(),
    title: 'Test Post from Webhook Script',
    content: 'This is a test post to verify WordPress webhook is working.',
    slug: 'test-webhook-post',
    status: 'published',
    type: 'post',
    meta: {
      source: 'headless_cms',
      created_at: new Date().toISOString()
    }
  }
};

async function testWordPressWebhook() {
  try {
    console.log('🧪 Testing WordPress webhook...\n');
    console.log('URL:', WORDPRESS_URL);
    console.log('Secret:', WEBHOOK_SECRET.substring(0, 20) + '...\n');

    const body = JSON.stringify(testContent);
    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    const timestamp = Math.floor(Date.now() / 1000);

    console.log('📝 Request body:', JSON.stringify(testContent, null, 2));
    console.log('\n🔐 Signature:', `sha256=${signature}`);
    console.log('⏰ Timestamp:', timestamp, '\n');

    const result = await makeRequest(WORDPRESS_URL, 'POST', testContent, {
      'X-CMS-Signature': `sha256=${signature}`,
      'X-CMS-Timestamp': timestamp.toString()
    });

    console.log('✅ Response:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

function makeRequest(url, method, data, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'CMS-Automation-Test/1.0',
        ...customHeaders
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve(responseBody);
          }
        } else {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.response = responseBody;
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

testWordPressWebhook();
