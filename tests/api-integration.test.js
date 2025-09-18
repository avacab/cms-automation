#!/usr/bin/env node

/**
 * API Integration Tests
 * Tests the backend API endpoints and frontend connectivity
 */

const API_BASE_URL = 'https://cms-automation-api.vercel.app';
const FRONTEND_URL = 'https://cms-automation-frontend.vercel.app';

class APITester {
  constructor() {
    this.results = [];
    this.failures = 0;
  }

  async test(name, testFn) {
    try {
      console.log(`🧪 Testing: ${name}`);
      const result = await testFn();
      this.results.push({ name, status: 'PASS', result });
      console.log(`✅ PASS: ${name}`);
      return result;
    } catch (error) {
      this.failures++;
      this.results.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ FAIL: ${name} - ${error.message}`);
      throw error;
    }
  }

  async fetch(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        'Origin': FRONTEND_URL,
        'User-Agent': 'API-Integration-Test/1.0',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  async runAllTests() {
    console.log('🚀 Starting API Integration Tests...\n');

    try {
      // Basic connectivity tests
      await this.test('API Health Check', async () => {
        const data = await this.fetch(`${API_BASE_URL}/health`);
        if (data.status !== 'healthy') throw new Error('API not healthy');
        return data;
      });

      await this.test('API Root Endpoint', async () => {
        const data = await this.fetch(`${API_BASE_URL}/`);
        if (!data.message) throw new Error('API root not responding properly');
        return data;
      });

      // CORS and frontend connectivity tests
      await this.test('Frontend Connectivity Test', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/debug/frontend-test`);
        if (!data.success) throw new Error('Frontend connectivity failed');
        return data;
      });

      await this.test('Environment Configuration', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/debug/env`);
        if (!data.has_supabase_url || !data.has_supabase_key) {
          throw new Error('Missing Supabase configuration');
        }
        if (data.storage_type !== 'supabase') {
          throw new Error('Storage type should be supabase');
        }
        return data;
      });

      // Content API tests
      await this.test('Content API - List All', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/content`);
        if (!Array.isArray(data.data)) throw new Error('Content data should be an array');
        if (data.data.length === 0) throw new Error('No content found - check Supabase data');
        return data;
      });

      await this.test('Content Types API', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/content-types`);
        if (!Array.isArray(data.data)) throw new Error('Content types should be an array');
        if (data.data.length === 0) throw new Error('No content types found');
        return data;
      });

      await this.test('Plugins API', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/plugins`);
        if (!Array.isArray(data.data)) throw new Error('Plugins should be an array');
        return data;
      });

      await this.test('Media API', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/media`);
        if (!Array.isArray(data.data)) throw new Error('Media should be an array');
        return data;
      });

      // System status tests
      await this.test('System Status', async () => {
        const data = await this.fetch(`${API_BASE_URL}/api/v1/system/status`);
        if (data.status !== 'operational') throw new Error('System not operational');
        return data;
      });

    } catch (error) {
      console.log(`\n💥 Test suite stopped due to critical failure: ${error.message}`);
    }

    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    this.results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.status}`);
      if (result.status === 'FAIL') {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('=' .repeat(50));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${this.results.length - this.failures}`);
    console.log(`Failed: ${this.failures}`);
    
    if (this.failures === 0) {
      console.log('🎉 All tests passed! API is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Check the errors above.');
      process.exit(1);
    }
  }
}

// Frontend simulation test
async function testFrontendSimulation() {
  console.log('\n🌐 Simulating Frontend Requests...');
  
  try {
    // Simulate the exact requests a frontend would make
    const tester = new APITester();
    
    const contentResponse = await tester.fetch(`${API_BASE_URL}/api/v1/content`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': FRONTEND_URL,
        'Referer': `${FRONTEND_URL}/content`
      }
    });

    console.log('✅ Frontend simulation successful');
    console.log(`📝 Found ${contentResponse.data.length} content items`);
    
    return contentResponse;
  } catch (error) {
    console.log(`❌ Frontend simulation failed: ${error.message}`);
    throw error;
  }
}

// Run tests if called directly
if (require.main === module) {
  (async () => {
    const tester = new APITester();
    await tester.runAllTests();
    await testFrontendSimulation();
  })();
}

module.exports = { APITester, testFrontendSimulation };