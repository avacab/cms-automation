/**
 * Content Creation Test Suite
 * 
 * This test suite ensures that content creation works correctly
 * and prevents type mismatches between frontend and backend.
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper functions
function generateTestContent(suffix = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    title: `Test Content ${suffix} ${timestamp} ${random}`,
    content: `This is test content created at ${new Date().toISOString()}`,
    status: 'draft'
  };
}

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function validateContentItem(item) {
  const errors = [];
  
  // Required fields
  if (!item.id || typeof item.id !== 'string') {
    errors.push('ID must be a string');
  }
  if (!isValidUUID(item.id)) {
    errors.push('ID must be a valid UUID');
  }
  if (!item.title || typeof item.title !== 'string') {
    errors.push('Title must be a non-empty string');
  }
  if (typeof item.content !== 'string') {
    errors.push('Content must be a string');
  }
  if (!['draft', 'published', 'archived'].includes(item.status)) {
    errors.push('Status must be draft, published, or archived');
  }
  
  // Timestamps
  if (!item.created_at || isNaN(new Date(item.created_at))) {
    errors.push('created_at must be a valid ISO timestamp');
  }
  if (!item.updated_at || isNaN(new Date(item.updated_at))) {
    errors.push('updated_at must be a valid ISO timestamp');
  }
  
  // Optional fields validation
  if (item.content_type_id && typeof item.content_type_id !== 'string') {
    errors.push('content_type_id must be a string if provided');
  }
  if (item.meta_description && typeof item.meta_description !== 'string') {
    errors.push('meta_description must be a string if provided');
  }
  if (item.tags && !Array.isArray(item.tags)) {
    errors.push('tags must be an array if provided');
  }
  if (item.published_at && isNaN(new Date(item.published_at))) {
    errors.push('published_at must be a valid ISO timestamp if provided');
  }
  
  return errors;
}

// Test suites
async function testHealthCheck() {
  console.log('\n=== Testing API Health Check ===');
  try {
    const response = await api.get('/health');
    console.log('✓ Health check passed');
    console.log(`  Status: ${response.data.status}`);
    console.log(`  Service: ${response.data.service}`);
    return true;
  } catch (error) {
    console.error('✗ Health check failed:', error.message);
    return false;
  }
}

async function testBasicContentCreation() {
  console.log('\n=== Testing Basic Content Creation ===');
  const testContent = generateTestContent('Basic');
  
  try {
    const response = await api.post('/api/v1/content', {
      content: testContent
    });
    
    const createdItem = response.data.data;
    const validationErrors = validateContentItem(createdItem);
    
    if (validationErrors.length > 0) {
      console.error('✗ Content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    console.log('✓ Content created successfully');
    console.log(`  ID: ${createdItem.id}`);
    console.log(`  Title: ${createdItem.title}`);
    console.log(`  Status: ${createdItem.status}`);
    return createdItem.id;
  } catch (error) {
    console.error('✗ Content creation failed:', error.response?.data || error.message);
    return false;
  }
}

async function testContentWithAllFields() {
  console.log('\n=== Testing Content Creation with All Fields ===');
  const testContent = {
    title: `Full Content Test ${Date.now()}`,
    content: 'This content has all possible fields filled',
    status: 'published',
    meta_description: 'This is a meta description for SEO',
    featured_image: 'https://example.com/image.jpg',
    tags: ['test', 'full-fields', 'validation']
  };
  
  try {
    const response = await api.post('/api/v1/content', {
      content: testContent
    });
    
    const createdItem = response.data.data;
    const validationErrors = validateContentItem(createdItem);
    
    if (validationErrors.length > 0) {
      console.error('✗ Full content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    // Check that all fields were saved correctly
    if (createdItem.meta_description !== testContent.meta_description) {
      console.error('✗ Meta description not saved correctly');
      return false;
    }
    if (createdItem.featured_image !== testContent.featured_image) {
      console.error('✗ Featured image not saved correctly');
      return false;
    }
    if (!Array.isArray(createdItem.tags) || createdItem.tags.length !== 3) {
      console.error('✗ Tags not saved correctly');
      return false;
    }
    if (createdItem.status !== 'published') {
      console.error('✗ Status not saved correctly');
      return false;
    }
    if (!createdItem.published_at) {
      console.error('✗ Published timestamp not set for published content');
      return false;
    }
    
    console.log('✓ Full content created successfully');
    console.log(`  ID: ${createdItem.id}`);
    console.log(`  Published at: ${createdItem.published_at}`);
    return createdItem.id;
  } catch (error) {
    console.error('✗ Full content creation failed:', error.response?.data || error.message);
    return false;
  }
}

async function testDuplicateSlugPrevention() {
  console.log('\n=== Testing Duplicate Slug Prevention ===');
  const baseTitle = `Duplicate Test ${Date.now()}`;
  
  try {
    // Create first content item
    const response1 = await api.post('/api/v1/content', {
      content: { title: baseTitle, content: 'First content' }
    });
    
    // Try to create second content item with same title (should generate same slug)
    try {
      await api.post('/api/v1/content', {
        content: { title: baseTitle, content: 'Second content' }
      });
      console.error('✗ Duplicate slug was allowed (should have been prevented)');
      return false;
    } catch (duplicateError) {
      if (duplicateError.response?.status === 409) {
        console.log('✓ Duplicate slug correctly prevented');
        console.log(`  Error: ${duplicateError.response.data.message}`);
        return true;
      } else {
        console.error('✗ Unexpected error for duplicate:', duplicateError.message);
        return false;
      }
    }
  } catch (error) {
    console.error('✗ Duplicate slug test setup failed:', error.message);
    return false;
  }
}

async function testContentRetrieval(contentId) {
  console.log('\n=== Testing Content Retrieval ===');
  
  if (!contentId) {
    console.error('✗ No content ID provided for retrieval test');
    return false;
  }
  
  try {
    // Test getting specific content
    const response = await api.get(`/api/v1/content/${contentId}`);
    const item = response.data.data;
    
    const validationErrors = validateContentItem(item);
    if (validationErrors.length > 0) {
      console.error('✗ Retrieved content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    console.log('✓ Content retrieved successfully');
    console.log(`  ID: ${item.id}`);
    console.log(`  Title: ${item.title}`);
    
    // Test getting all content
    const allResponse = await api.get('/api/v1/content');
    const allItems = allResponse.data.data;
    
    if (!Array.isArray(allItems)) {
      console.error('✗ Get all content should return an array');
      return false;
    }
    
    const foundItem = allItems.find(item => item.id === contentId);
    if (!foundItem) {
      console.error('✗ Created content not found in all content list');
      return false;
    }
    
    console.log('✓ Content found in all content list');
    console.log(`  Total items: ${allItems.length}`);
    
    return true;
  } catch (error) {
    console.error('✗ Content retrieval failed:', error.response?.data || error.message);
    return false;
  }
}

async function testContentUpdate(contentId) {
  console.log('\n=== Testing Content Update ===');
  
  if (!contentId) {
    console.error('✗ No content ID provided for update test');
    return false;
  }
  
  try {
    const updatedContent = {
      title: `Updated Content ${Date.now()}`,
      content: 'This content has been updated',
      status: 'published',
      meta_description: 'Updated meta description'
    };
    
    const response = await api.put(`/api/v1/content/${contentId}`, {
      content: updatedContent
    });
    
    const updatedItem = response.data.data;
    const validationErrors = validateContentItem(updatedItem);
    
    if (validationErrors.length > 0) {
      console.error('✗ Updated content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    // Verify updates were applied
    if (updatedItem.title !== updatedContent.title) {
      console.error('✗ Title was not updated correctly');
      return false;
    }
    if (updatedItem.content !== updatedContent.content) {
      console.error('✗ Content was not updated correctly');
      return false;
    }
    if (updatedItem.status !== updatedContent.status) {
      console.error('✗ Status was not updated correctly');
      return false;
    }
    
    // Check that updated_at timestamp was changed
    if (!updatedItem.updated_at || updatedItem.updated_at === updatedItem.created_at) {
      console.error('✗ updated_at timestamp was not properly set');
      return false;
    }
    
    console.log('✓ Content updated successfully');
    console.log(`  New title: ${updatedItem.title}`);
    console.log(`  Updated at: ${updatedItem.updated_at}`);
    
    return true;
  } catch (error) {
    console.error('✗ Content update failed:', error.response?.data || error.message);
    return false;
  }
}

async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===');
  
  try {
    // Test missing title
    await api.post('/api/v1/content', {
      content: { content: 'Content without title' }
    });
    console.error('✗ Missing title validation should have failed');
    return false;
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✓ Missing title correctly rejected');
    } else {
      console.error('✗ Unexpected error for missing title:', error.message);
      return false;
    }
  }
  
  try {
    // Test getting non-existent content
    await api.get('/api/v1/content/non-existent-id');
    console.error('✗ Non-existent content should return 404');
    return false;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('✓ Non-existent content correctly returns 404');
      return true;
    } else {
      console.error('✗ Unexpected error for non-existent content:', error.message);
      return false;
    }
  }
}

async function testContentTypeCompatibility() {
  console.log('\n=== Testing Content Types Compatibility ===');
  
  try {
    const response = await api.get('/api/v1/content-types');
    const contentTypes = response.data.data;
    
    if (!Array.isArray(contentTypes)) {
      console.error('✗ Content types should return an array');
      return false;
    }
    
    for (const contentType of contentTypes) {
      if (!contentType.id || typeof contentType.id !== 'string') {
        console.error('✗ Content type ID must be a string');
        return false;
      }
      if (!isValidUUID(contentType.id)) {
        console.error('✗ Content type ID must be a valid UUID');
        return false;
      }
      if (!contentType.name || typeof contentType.name !== 'string') {
        console.error('✗ Content type name must be a string');
        return false;
      }
      if (!Array.isArray(contentType.fields)) {
        console.error('✗ Content type fields must be an array');
        return false;
      }
    }
    
    console.log('✓ Content types structure validated');
    console.log(`  Found ${contentTypes.length} content types`);
    
    return true;
  } catch (error) {
    console.error('✗ Content types test failed:', error.response?.data || error.message);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 Starting Content Creation Test Suite');
  console.log('=====================================');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Basic Content Creation', fn: testBasicContentCreation },
    { name: 'Content with All Fields', fn: testContentWithAllFields },
    { name: 'Duplicate Slug Prevention', fn: testDuplicateSlugPrevention },
    { name: 'Error Handling', fn: testErrorHandling },
    { name: 'Content Types Compatibility', fn: testContentTypeCompatibility }
  ];
  
  let createdContentId = null;
  
  for (const test of tests) {
    results.total++;
    try {
      const result = await test.fn(createdContentId);
      if (result) {
        results.passed++;
        if (test.name === 'Basic Content Creation' && typeof result === 'string') {
          createdContentId = result;
        }
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`✗ ${test.name} threw an error:`, error.message);
      results.failed++;
    }
  }
  
  // Run dependent tests if we have a content ID
  if (createdContentId) {
    const dependentTests = [
      { name: 'Content Retrieval', fn: () => testContentRetrieval(createdContentId) },
      { name: 'Content Update', fn: () => testContentUpdate(createdContentId) }
    ];
    
    for (const test of dependentTests) {
      results.total++;
      try {
        const result = await test.fn();
        if (result) {
          results.passed++;
        } else {
          results.failed++;
        }
      } catch (error) {
        console.error(`✗ ${test.name} threw an error:`, error.message);
        results.failed++;
      }
    }
  }
  
  // Print results
  console.log('\n📊 Test Results');
  console.log('===============');
  console.log(`Total tests: ${results.total}`);
  console.log(`✓ Passed: ${results.passed}`);
  console.log(`✗ Failed: ${results.failed}`);
  console.log(`Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! Content creation is working correctly.');
    process.exit(0);
  }
}

// Export for use in other test files
module.exports = {
  generateTestContent,
  validateContentItem,
  isValidUUID,
  api,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}