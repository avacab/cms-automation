/**
 * Frontend Integration Test Suite
 * 
 * Tests the frontend components and their interaction with the backend API
 * to prevent type mismatches and ensure proper functionality.
 */

const { JSDOM } = require('jsdom');
const axios = require('axios');

// Mock environment for frontend testing
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Simulate frontend API service behavior
class FrontendAPIService {
  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async createContent(contentData) {
    try {
      const response = await this.api.post('/api/v1/content', {
        content: contentData
      });
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to create content: ${error.response?.data?.message || error.message}`);
    }
  }

  async getContent() {
    try {
      const response = await this.api.get('/api/v1/content');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get content: ${error.response?.data?.message || error.message}`);
    }
  }

  async getContentItem(id) {
    try {
      const response = await this.api.get(`/api/v1/content/${id}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get content item: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateContent(id, contentData) {
    try {
      const response = await this.api.put(`/api/v1/content/${id}`, {
        content: contentData
      });
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to update content: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteContent(id) {
    try {
      const response = await this.api.delete(`/api/v1/content/${id}`);
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to delete content: ${error.response?.data?.message || error.message}`);
    }
  }

  async getContentTypes() {
    try {
      const response = await this.api.get('/api/v1/content-types');
      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get content types: ${error.response?.data?.message || error.message}`);
    }
  }
}

// Frontend validation functions (matching expected frontend behavior)
function validateFrontendContentItem(item) {
  const errors = [];
  
  // Check types that frontend expects
  if (typeof item.id !== 'string') {
    errors.push(`ID should be string, got ${typeof item.id}`);
  }
  
  if (typeof item.title !== 'string') {
    errors.push(`Title should be string, got ${typeof item.title}`);
  }
  
  if (typeof item.content !== 'string') {
    errors.push(`Content should be string, got ${typeof item.content}`);
  }
  
  if (!['draft', 'published', 'archived'].includes(item.status)) {
    errors.push(`Status should be draft/published/archived, got ${item.status}`);
  }
  
  // Check required timestamps
  if (typeof item.created_at !== 'string' || isNaN(new Date(item.created_at))) {
    errors.push('created_at should be a valid ISO string');
  }
  
  if (typeof item.updated_at !== 'string' || isNaN(new Date(item.updated_at))) {
    errors.push('updated_at should be a valid ISO string');
  }
  
  // Check optional fields
  if (item.tags !== undefined && !Array.isArray(item.tags)) {
    errors.push('tags should be an array if provided');
  }
  
  if (item.published_at !== undefined && (typeof item.published_at !== 'string' || isNaN(new Date(item.published_at)))) {
    errors.push('published_at should be a valid ISO string if provided');
  }
  
  return errors;
}

function validateFrontendContentType(contentType) {
  const errors = [];
  
  if (typeof contentType.id !== 'string') {
    errors.push(`ContentType ID should be string, got ${typeof contentType.id}`);
  }
  
  if (typeof contentType.name !== 'string') {
    errors.push(`ContentType name should be string, got ${typeof contentType.name}`);
  }
  
  if (!Array.isArray(contentType.fields)) {
    errors.push('ContentType fields should be an array');
  } else {
    contentType.fields.forEach((field, index) => {
      if (typeof field.name !== 'string') {
        errors.push(`Field ${index} name should be string`);
      }
      if (typeof field.label !== 'string') {
        errors.push(`Field ${index} label should be string`);
      }
      if (typeof field.required !== 'boolean') {
        errors.push(`Field ${index} required should be boolean`);
      }
      const validTypes = ['text', 'textarea', 'richtext', 'number', 'boolean', 'date', 'image', 'select'];
      if (!validTypes.includes(field.type)) {
        errors.push(`Field ${index} type should be one of: ${validTypes.join(', ')}`);
      }
    });
  }
  
  return errors;
}

// Simulate form data that would come from the frontend
function createFormData(overrides = {}) {
  return {
    title: `Frontend Test ${Date.now()}`,
    content: 'This content was created from the frontend form',
    status: 'draft',
    meta_description: 'Test meta description',
    tags: ['frontend', 'test'],
    ...overrides
  };
}

// Test functions
async function testFrontendContentCreation() {
  console.log('\n=== Testing Frontend Content Creation ===');
  const apiService = new FrontendAPIService();
  const formData = createFormData();
  
  try {
    const createdItem = await apiService.createContent(formData);
    
    // Validate that the response matches frontend expectations
    const validationErrors = validateFrontendContentItem(createdItem);
    if (validationErrors.length > 0) {
      console.error('✗ Frontend content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    // Verify the data matches what was sent
    if (createdItem.title !== formData.title) {
      console.error('✗ Title mismatch between form and response');
      return false;
    }
    
    if (createdItem.content !== formData.content) {
      console.error('✗ Content mismatch between form and response');
      return false;
    }
    
    console.log('✓ Frontend content creation successful');
    console.log(`  Created ID: ${createdItem.id}`);
    return createdItem;
  } catch (error) {
    console.error('✗ Frontend content creation failed:', error.message);
    return false;
  }
}

async function testFrontendContentList() {
  console.log('\n=== Testing Frontend Content List ===');
  const apiService = new FrontendAPIService();
  
  try {
    const contentList = await apiService.getContent();
    
    if (!Array.isArray(contentList)) {
      console.error('✗ Content list should be an array');
      return false;
    }
    
    // Validate each item in the list
    for (let i = 0; i < contentList.length; i++) {
      const item = contentList[i];
      const validationErrors = validateFrontendContentItem(item);
      if (validationErrors.length > 0) {
        console.error(`✗ Content item ${i} validation failed:`);
        validationErrors.forEach(error => console.error(`  - ${error}`));
        return false;
      }
    }
    
    console.log('✓ Frontend content list validation passed');
    console.log(`  Total items: ${contentList.length}`);
    return contentList;
  } catch (error) {
    console.error('✗ Frontend content list failed:', error.message);
    return false;
  }
}

async function testFrontendContentUpdate(contentItem) {
  console.log('\n=== Testing Frontend Content Update ===');
  const apiService = new FrontendAPIService();
  
  if (!contentItem || !contentItem.id) {
    console.error('✗ No content item provided for update test');
    return false;
  }
  
  try {
    const updateData = {
      title: `Updated ${contentItem.title}`,
      content: 'This content has been updated from frontend',
      status: 'published',
      meta_description: 'Updated meta description'
    };
    
    const updatedItem = await apiService.updateContent(contentItem.id, updateData);
    
    // Validate the response
    const validationErrors = validateFrontendContentItem(updatedItem);
    if (validationErrors.length > 0) {
      console.error('✗ Updated content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    // Verify updates were applied
    if (updatedItem.title !== updateData.title) {
      console.error('✗ Title update not applied correctly');
      return false;
    }
    
    if (updatedItem.status !== updateData.status) {
      console.error('✗ Status update not applied correctly');
      return false;
    }
    
    // Check that published_at was set when status changed to published
    if (updatedItem.status === 'published' && !updatedItem.published_at) {
      console.error('✗ published_at should be set when status is published');
      return false;
    }
    
    console.log('✓ Frontend content update successful');
    console.log(`  Updated title: ${updatedItem.title}`);
    return updatedItem;
  } catch (error) {
    console.error('✗ Frontend content update failed:', error.message);
    return false;
  }
}

async function testFrontendContentTypes() {
  console.log('\n=== Testing Frontend Content Types ===');
  const apiService = new FrontendAPIService();
  
  try {
    const contentTypes = await apiService.getContentTypes();
    
    if (!Array.isArray(contentTypes)) {
      console.error('✗ Content types should be an array');
      return false;
    }
    
    // Validate each content type
    for (let i = 0; i < contentTypes.length; i++) {
      const contentType = contentTypes[i];
      const validationErrors = validateFrontendContentType(contentType);
      if (validationErrors.length > 0) {
        console.error(`✗ Content type ${i} validation failed:`);
        validationErrors.forEach(error => console.error(`  - ${error}`));
        return false;
      }
    }
    
    console.log('✓ Frontend content types validation passed');
    console.log(`  Total types: ${contentTypes.length}`);
    
    // Test that we can use these content types in content creation
    if (contentTypes.length > 0) {
      const firstType = contentTypes[0];
      const contentWithType = await apiService.createContent({
        title: `Content with type ${Date.now()}`,
        content: 'Content using a specific content type',
        content_type_id: firstType.id
      });
      
      if (contentWithType.content_type_id !== firstType.id) {
        console.error('✗ Content type ID not set correctly');
        return false;
      }
      
      console.log('✓ Content creation with content type successful');
    }
    
    return contentTypes;
  } catch (error) {
    console.error('✗ Frontend content types test failed:', error.message);
    return false;
  }
}

async function testFrontendErrorHandling() {
  console.log('\n=== Testing Frontend Error Handling ===');
  const apiService = new FrontendAPIService();
  
  try {
    // Test missing required field
    await apiService.createContent({
      content: 'Content without title'
    });
    console.error('✗ Should have failed with missing title');
    return false;
  } catch (error) {
    if (error.message.includes('Title is required') || error.message.includes('Bad Request')) {
      console.log('✓ Missing title error handled correctly');
    } else {
      console.error('✗ Unexpected error for missing title:', error.message);
      return false;
    }
  }
  
  try {
    // Test getting non-existent content
    await apiService.getContentItem('non-existent-id');
    console.error('✗ Should have failed with non-existent ID');
    return false;
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Not Found')) {
      console.log('✓ Non-existent content error handled correctly');
    } else {
      console.error('✗ Unexpected error for non-existent content:', error.message);
      return false;
    }
  }
  
  return true;
}

async function testAIContentGeneration() {
  console.log('\n=== Testing AI Content Generation Integration ===');
  const apiService = new FrontendAPIService();
  
  // Simulate AI-generated content (as would come from the AI service)
  const aiGeneratedContent = {
    title: `AI Generated Content ${Date.now()}`,
    content: 'This is content that was generated by AI and should work with the frontend',
    status: 'draft',
    meta_description: 'AI-generated meta description for SEO optimization',
    tags: ['ai-generated', 'test', 'automation']
  };
  
  try {
    const createdItem = await apiService.createContent(aiGeneratedContent);
    
    // Validate AI-generated content follows same rules
    const validationErrors = validateFrontendContentItem(createdItem);
    if (validationErrors.length > 0) {
      console.error('✗ AI-generated content validation failed:');
      validationErrors.forEach(error => console.error(`  - ${error}`));
      return false;
    }
    
    // Test that AI content can be updated normally
    const updatedAIContent = await apiService.updateContent(createdItem.id, {
      status: 'published',
      content: 'AI content that was manually edited'
    });
    
    if (updatedAIContent.status !== 'published') {
      console.error('✗ AI content update failed');
      return false;
    }
    
    console.log('✓ AI content generation integration successful');
    console.log(`  AI Content ID: ${createdItem.id}`);
    return createdItem;
  } catch (error) {
    console.error('✗ AI content generation integration failed:', error.message);
    return false;
  }
}

// Main test runner
async function runFrontendIntegrationTests() {
  console.log('🎨 Starting Frontend Integration Test Suite');
  console.log('==========================================');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  const tests = [
    { name: 'Frontend Content Creation', fn: testFrontendContentCreation },
    { name: 'Frontend Content List', fn: testFrontendContentList },
    { name: 'Frontend Content Types', fn: testFrontendContentTypes },
    { name: 'Frontend Error Handling', fn: testFrontendErrorHandling },
    { name: 'AI Content Generation', fn: testAIContentGeneration }
  ];
  
  let createdContent = null;
  
  for (const test of tests) {
    results.total++;
    try {
      const result = await test.fn();
      if (result) {
        results.passed++;
        if (test.name === 'Frontend Content Creation' && result.id) {
          createdContent = result;
        }
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error(`✗ ${test.name} threw an error:`, error.message);
      results.failed++;
    }
  }
  
  // Run dependent tests
  if (createdContent) {
    results.total++;
    try {
      const updateResult = await testFrontendContentUpdate(createdContent);
      if (updateResult) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error('✗ Frontend Content Update threw an error:', error.message);
      results.failed++;
    }
  }
  
  // Print results
  console.log('\n📊 Frontend Integration Test Results');
  console.log('===================================');
  console.log(`Total tests: ${results.total}`);
  console.log(`✓ Passed: ${results.passed}`);
  console.log(`✗ Failed: ${results.failed}`);
  console.log(`Success rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  
  if (results.failed > 0) {
    console.log('\n⚠️  Some frontend integration tests failed.');
    return false;
  } else {
    console.log('\n🎉 All frontend integration tests passed!');
    return true;
  }
}

// Export for use in other test files
module.exports = {
  FrontendAPIService,
  validateFrontendContentItem,
  validateFrontendContentType,
  createFormData,
  runFrontendIntegrationTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runFrontendIntegrationTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Frontend integration test suite failed:', error);
    process.exit(1);
  });
}