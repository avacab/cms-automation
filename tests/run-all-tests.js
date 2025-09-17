#!/usr/bin/env node

/**
 * Test Suite Runner
 * 
 * Runs all test suites and provides comprehensive reporting
 * to ensure content creation works correctly.
 */

const { runAllTests: runContentTests } = require('./content-creation.test.js');
const { runFrontendIntegrationTests } = require('./frontend-integration.test.js');
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CI_MODE = process.argv.includes('--ci');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function colorize(text, color) {
  if (CI_MODE) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

async function checkServices() {
  console.log(colorize('\n🔍 Checking Services', 'bold'));
  console.log('==================');
  
  let allServicesUp = true;
  
  // Check Backend API
  try {
    const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
    if (response.status === 200) {
      console.log(colorize('✓ Backend API is running', 'green'));
      console.log(`  URL: ${API_BASE_URL}`);
      console.log(`  Status: ${response.data.status}`);
    }
  } catch (error) {
    console.log(colorize('✗ Backend API is not running', 'red'));
    console.log(`  URL: ${API_BASE_URL}`);
    console.log(`  Error: ${error.message}`);
    allServicesUp = false;
  }
  
  // Check if database/storage is accessible
  try {
    const response = await axios.get(`${API_BASE_URL}/api/v1/content`, { timeout: 5000 });
    if (response.status === 200) {
      console.log(colorize('✓ Content storage is accessible', 'green'));
      console.log(`  Content items found: ${response.data.data.length}`);
    }
  } catch (error) {
    console.log(colorize('✗ Content storage is not accessible', 'red'));
    console.log(`  Error: ${error.message}`);
    allServicesUp = false;
  }
  
  // Note about frontend (not blocking for API tests)
  console.log(colorize('ℹ Frontend URL (for reference):', 'cyan'));
  console.log(`  ${FRONTEND_URL}`);
  
  return allServicesUp;
}

async function waitForServices() {
  console.log(colorize('\n⏳ Waiting for services to be ready...', 'yellow'));
  
  const maxAttempts = 30;
  const delay = 2000;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: 5000 });
      if (response.status === 200) {
        console.log(colorize('✓ Services are ready!', 'green'));
        return true;
      }
    } catch (error) {
      if (attempt < maxAttempts) {
        console.log(colorize(`  Attempt ${attempt}/${maxAttempts} - waiting...`, 'yellow'));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.log(colorize('✗ Services did not become ready in time', 'red'));
  return false;
}

function printHeader() {
  console.log(colorize('\n🧪 CMS Content Creation Test Suite', 'bold'));
  console.log(colorize('===================================', 'bold'));
  console.log('This test suite validates that content creation works correctly');
  console.log('and prevents type mismatches between frontend and backend.\n');
  
  console.log(colorize('Test Coverage:', 'blue'));
  console.log('• Backend API functionality');
  console.log('• Content CRUD operations');
  console.log('• Type compatibility');
  console.log('• Error handling');
  console.log('• Frontend integration');
  console.log('• AI content generation');
}

async function runTestSuite(name, testFunction, color = 'blue') {
  console.log(colorize(`\n🎯 ${name}`, 'bold'));
  console.log('='.repeat(name.length + 3));
  
  const startTime = Date.now();
  
  try {
    const result = await testFunction();
    const duration = Date.now() - startTime;
    
    if (result) {
      console.log(colorize(`\n✅ ${name} - PASSED`, 'green'));
      console.log(colorize(`   Duration: ${duration}ms`, 'cyan'));
      return { name, status: 'passed', duration, error: null };
    } else {
      console.log(colorize(`\n❌ ${name} - FAILED`, 'red'));
      console.log(colorize(`   Duration: ${duration}ms`, 'cyan'));
      return { name, status: 'failed', duration, error: 'Test returned false' };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(colorize(`\n💥 ${name} - ERROR`, 'red'));
    console.log(colorize(`   Duration: ${duration}ms`, 'cyan'));
    console.log(colorize(`   Error: ${error.message}`, 'red'));
    return { name, status: 'error', duration, error: error.message };
  }
}

function generateReport(results, totalDuration) {
  console.log(colorize('\n📊 Final Test Report', 'bold'));
  console.log('===================');
  
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    errors: results.filter(r => r.status === 'error').length
  };
  
  console.log(colorize(`\nSummary:`, 'bold'));
  console.log(`  Total test suites: ${summary.total}`);
  console.log(colorize(`  ✅ Passed: ${summary.passed}`, 'green'));
  console.log(colorize(`  ❌ Failed: ${summary.failed}`, summary.failed > 0 ? 'red' : 'green'));
  console.log(colorize(`  💥 Errors: ${summary.errors}`, summary.errors > 0 ? 'red' : 'green'));
  console.log(`  Total duration: ${totalDuration}ms`);
  
  const successRate = ((summary.passed / summary.total) * 100).toFixed(1);
  console.log(colorize(`  Success rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow'));
  
  // Detailed results
  console.log(colorize('\nDetailed Results:', 'bold'));
  results.forEach(result => {
    const statusColor = result.status === 'passed' ? 'green' : 'red';
    const statusIcon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '💥';
    console.log(`  ${statusIcon} ${colorize(result.name, statusColor)} (${result.duration}ms)`);
    if (result.error && result.status !== 'passed') {
      console.log(colorize(`      Error: ${result.error}`, 'red'));
    }
  });
  
  // Recommendations
  if (summary.failed > 0 || summary.errors > 0) {
    console.log(colorize('\n⚠️  Recommendations:', 'yellow'));
    console.log('• Check that the backend API server is running');
    console.log('• Verify database/file storage is accessible');
    console.log('• Ensure all dependencies are installed');
    console.log('• Review the detailed error messages above');
    console.log('• Run individual test suites for more specific debugging');
  } else {
    console.log(colorize('\n🎉 All tests passed!', 'green'));
    console.log('Your CMS content creation is working perfectly.');
    console.log('Frontend and backend types are compatible.');
  }
  
  return summary.failed === 0 && summary.errors === 0;
}

function printUsage() {
  console.log('\nUsage:');
  console.log('  npm run test        # Run all tests');
  console.log('  npm run test:all    # Same as above');
  console.log('  npm run test:content    # Run only content creation tests');
  console.log('  npm run test:frontend   # Run only frontend integration tests');
  console.log('  npm run test:ci     # Run in CI mode (no colors)');
  console.log('  npm run test:watch  # Run tests and watch for changes');
}

async function main() {
  const startTime = Date.now();
  
  // Handle help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  printHeader();
  
  // Check if services are running
  const servicesReady = await checkServices();
  
  if (!servicesReady) {
    console.log(colorize('\n⏳ Services not ready, attempting to wait...', 'yellow'));
    const waitResult = await waitForServices();
    
    if (!waitResult) {
      console.log(colorize('\n❌ Cannot proceed without backend services', 'red'));
      console.log('\nTo fix this:');
      console.log('1. Start the backend API server:');
      console.log('   cd backend/api && npm run dev');
      console.log('2. Wait for the server to start');
      console.log('3. Run the tests again');
      process.exit(1);
    }
  }
  
  // Run test suites
  const results = [];
  
  // Content Creation Tests
  results.push(await runTestSuite(
    'Content Creation Tests',
    runContentTests,
    'green'
  ));
  
  // Frontend Integration Tests  
  results.push(await runTestSuite(
    'Frontend Integration Tests',
    runFrontendIntegrationTests,
    'blue'
  ));
  
  const totalDuration = Date.now() - startTime;
  const success = generateReport(results, totalDuration);
  
  // Exit with appropriate code
  process.exit(success ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(colorize('\n💥 Unhandled Promise Rejection:', 'red'));
  console.error(error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(colorize('\n💥 Uncaught Exception:', 'red'));
  console.error(error);
  process.exit(1);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error(colorize('Test runner failed:', 'red'), error);
    process.exit(1);
  });
}

module.exports = {
  main,
  checkServices,
  waitForServices,
  runTestSuite,
  generateReport
};