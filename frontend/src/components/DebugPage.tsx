import React, { useState, useEffect } from 'react';
import { contentService } from '../services/api';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  data?: any;
  error?: string;
  duration?: number;
}

export default function DebugPage() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [apiBaseUrl] = useState(import.meta.env.VITE_API_URL || 'http://localhost:5000');

  const updateTest = (name: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.name === name ? { ...test, ...updates } : test
    ));
  };

  const runTest = async (name: string, testFn: () => Promise<any>) => {
    const startTime = Date.now();
    updateTest(name, { status: 'pending' });
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      updateTest(name, { 
        status: 'success', 
        data: result, 
        duration 
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTest(name, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration 
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    // Initialize all tests
    const testList: TestResult[] = [
      { name: 'Basic Connectivity', status: 'pending' },
      { name: 'API Health Check', status: 'pending' },
      { name: 'Frontend Test Endpoint', status: 'pending' },
      { name: 'Environment Config', status: 'pending' },
      { name: 'Content API', status: 'pending' },
      { name: 'Content Types API', status: 'pending' },
      { name: 'Plugins API', status: 'pending' },
      { name: 'System Status', status: 'pending' },
      { name: 'CORS Headers', status: 'pending' }
    ];
    
    setTests(testList);

    // Test 1: Basic connectivity
    await runTest('Basic Connectivity', async () => {
      const response = await fetch(apiBaseUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });

    // Test 2: Health check
    await runTest('API Health Check', async () => {
      const response = await fetch(`${apiBaseUrl}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });

    // Test 3: Frontend test endpoint
    await runTest('Frontend Test Endpoint', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/debug/frontend-test`, {
        headers: {
          'Origin': window.location.origin,
          'Accept': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });

    // Test 4: Environment config
    await runTest('Environment Config', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/debug/env`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });

    // Test 5: Content API (using the service)
    await runTest('Content API', async () => {
      return await contentService.getContent();
    });

    // Test 6: Content Types API
    await runTest('Content Types API', async () => {
      return await contentService.getContentTypes();
    });

    // Test 7: Plugins API
    await runTest('Plugins API', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/plugins`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      return result.data || result;
    });

    // Test 8: System Status
    await runTest('System Status', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/system/status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    });

    // Test 9: CORS Headers
    await runTest('CORS Headers', async () => {
      const response = await fetch(`${apiBaseUrl}/api/v1/debug/frontend-test`, {
        method: 'OPTIONS',
        headers: {
          'Origin': window.location.origin,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Content-Type'
        }
      });
      
      return {
        status: response.status,
        headers: {
          'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
          'access-control-allow-methods': response.headers.get('access-control-allow-methods'),
          'access-control-allow-headers': response.headers.get('access-control-allow-headers'),
          'access-control-allow-credentials': response.headers.get('access-control-allow-credentials')
        }
      };
    });

    setIsRunning(false);
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">🔍 CMS Debug Dashboard</h1>
        <p className="text-gray-600">
          Comprehensive testing of frontend-backend connectivity and API functionality.
        </p>
      </div>

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">📋 Current Configuration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">API Base URL:</span>
            <span className="ml-2 font-mono bg-white px-2 py-1 rounded">{apiBaseUrl}</span>
          </div>
          <div>
            <span className="font-medium">Frontend URL:</span>
            <span className="ml-2 font-mono bg-white px-2 py-1 rounded">{window.location.origin}</span>
          </div>
          <div>
            <span className="font-medium">Environment:</span>
            <span className="ml-2 font-mono bg-white px-2 py-1 rounded">{import.meta.env.VITE_ENVIRONMENT || 'development'}</span>
          </div>
          <div>
            <span className="font-medium">User Agent:</span>
            <span className="ml-2 font-mono bg-white px-2 py-1 rounded text-xs">{navigator.userAgent.substring(0, 50)}...</span>
          </div>
        </div>
      </div>

      <div className="mb-6 flex space-x-4">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isRunning ? '🔄 Running Tests...' : '🚀 Run All Tests'}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
        >
          🔄 Refresh Page
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tests.map((test, index) => (
          <div key={test.name} className={`border rounded-lg p-4 ${
            test.status === 'success' ? 'border-green-200 bg-green-50' :
            test.status === 'error' ? 'border-red-200 bg-red-50' :
            'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">
                {getStatusIcon(test.status)} {test.name}
              </h3>
              <span className={`text-sm ${getStatusColor(test.status)}`}>
                {test.duration ? `${test.duration}ms` : ''}
              </span>
            </div>
            
            {test.error && (
              <div className="text-red-700 text-sm mb-2">
                <strong>Error:</strong> {test.error}
              </div>
            )}
            
            {test.data && (
              <details className="text-sm">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                  View Response Data
                </summary>
                <pre className="mt-2 bg-white p-2 rounded border text-xs overflow-auto max-h-40">
                  {JSON.stringify(test.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-yellow-900 mb-2">💡 Troubleshooting Guide</h2>
        <div className="text-sm text-yellow-800 space-y-2">
          <p><strong>If Content API fails:</strong> Check Supabase configuration and database tables</p>
          <p><strong>If CORS fails:</strong> Verify backend CORS_ORIGIN environment variable</p>
          <p><strong>If all tests fail:</strong> Check if backend API is running and accessible</p>
          <p><strong>White page issue:</strong> Usually caused by JavaScript errors or failed API calls</p>
        </div>
      </div>
    </div>
  );
}