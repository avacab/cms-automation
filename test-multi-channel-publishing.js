#!/usr/bin/env node

/**
 * Test script for multi-channel publishing flow
 * Tests the complete workflow: Frontend → Backend → WordPress + LinkedIn
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';
const TEST_CONTENT = {
  title: 'Haidrun Announces Strategic Partnership with Leading Tech Innovators',
  content: `
**Introduction**

Haidrun, a leading innovator in the technology sector, is excited to announce a strategic partnership with several prominent technology companies. This collaboration aims to drive innovation, enhance our technological capabilities, and deliver exceptional value to our customers and stakeholders.

**Partnership Details**

This partnership brings together industry leaders to create cutting-edge solutions that will transform how businesses approach technology integration. The collaboration focuses on:

1. **Advanced Technology Development** - Combining expertise to develop next-generation solutions
2. **Market Expansion** - Leveraging combined networks to reach new markets
3. **Innovation Acceleration** - Sharing resources and knowledge to accelerate innovation cycles
4. **Customer Value Creation** - Delivering enhanced value propositions to customers

**Impact on Haidrun's Future**

This strategic partnership positions Haidrun at the forefront of technological innovation. We expect this collaboration to significantly enhance our product offerings and accelerate our growth trajectory in the coming years.

**Conclusion**

We are thrilled about this partnership and the opportunities it presents for Haidrun, our partners, and our customers. This collaboration represents our commitment to innovation and excellence in everything we do.
  `.trim(),
  slug: 'haidrun-strategic-partnership-announcement',
  status: 'published'
};

const PUBLISHING_OPTIONS = {
  publishToWordPress: true,
  publishToLinkedIn: true,
  companyBranding: 'haidrun'
};

async function testMultiChannelPublishing() {
  console.log('🚀 Testing Multi-Channel Publishing Flow');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Check API status
    console.log('📊 Step 1: Checking API status...');
    const statusResponse = await axios.get(`${API_BASE_URL}/api/v1/content-publishing/status`);
    
    if (!statusResponse.data.success) {
      throw new Error('API not ready for testing');
    }
    
    console.log('✅ API Status:', {
      ready: statusResponse.data.data.ready,
      wordpress_webhooks: statusResponse.data.data.wordpress_webhooks,
      orchestrator_healthy: statusResponse.data.data.orchestrator_healthy
    });
    
    // Step 2: Test multi-channel publishing
    console.log('\n📝 Step 2: Publishing content to multiple channels...');
    const publishResponse = await axios.post(`${API_BASE_URL}/api/v1/content-publishing/multi-channel`, {
      content: TEST_CONTENT,
      publishing_options: PUBLISHING_OPTIONS
    });
    
    if (!publishResponse.data.success) {
      throw new Error(`Publishing failed: ${publishResponse.data.error?.message}`);
    }
    
    const results = publishResponse.data.data;
    console.log('✅ Content created:', {
      id: results.content.id,
      title: results.content.title,
      status: results.content.status
    });
    
    // Step 3: Check WordPress publishing result
    if (PUBLISHING_OPTIONS.publishToWordPress) {
      console.log('\n🌐 Step 3: WordPress Publishing Result:');
      const wpResult = results.publishing_results.wordpress;
      if (wpResult) {
        console.log(wpResult.success ? '✅' : '❌', 'WordPress:', wpResult.message);
        if (wpResult.post_id) {
          console.log('   WordPress Post ID:', wpResult.post_id);
        }
        if (wpResult.error) {
          console.log('   Error:', wpResult.error);
        }
      } else {
        console.log('❌ No WordPress result returned');
      }
    }
    
    // Step 4: Check LinkedIn publishing result
    if (PUBLISHING_OPTIONS.publishToLinkedIn) {
      console.log('\n💼 Step 4: LinkedIn Publishing Result:');
      const linkedinResult = results.publishing_results.linkedin;
      if (linkedinResult) {
        console.log(linkedinResult.success ? '✅' : '❌', 'LinkedIn:', linkedinResult.message);
        if (linkedinResult.social_post_id) {
          console.log('   Social Post ID:', linkedinResult.social_post_id);
        }
        if (linkedinResult.mapping_id) {
          console.log('   Mapping ID:', linkedinResult.mapping_id);
        }
        if (linkedinResult.error) {
          console.log('   Error:', linkedinResult.error);
        }
      } else {
        console.log('❌ No LinkedIn result returned');
      }
    }
    
    // Step 5: Check pending social posts
    console.log('\n⏰ Step 5: Checking pending social posts...');
    const pendingResponse = await axios.get(`${API_BASE_URL}/api/v1/content-publishing/pending`);
    
    if (pendingResponse.data.success) {
      const pendingPosts = pendingResponse.data.data.pending_posts;
      console.log(`✅ Found ${pendingPosts.length} pending social posts`);
      
      pendingPosts.forEach((post, index) => {
        console.log(`   ${index + 1}. ${post.platform} - Scheduled: ${post.scheduled_time}`);
      });
    }
    
    // Step 6: Get orchestrator stats
    console.log('\n📈 Step 6: Orchestrator Statistics:');
    const statsResponse = await axios.get(`${API_BASE_URL}/api/v1/content-publishing/orchestrator/stats`);
    
    if (statsResponse.data.success) {
      const stats = statsResponse.data.data;
      console.log('✅ Orchestrator Stats:', {
        total_posts: stats.total_posts,
        scheduled_posts: stats.scheduled_posts,
        published_posts: stats.published_posts,
        failed_posts: stats.failed_posts,
        platforms: stats.platforms
      });
    }
    
    console.log('\n🎉 Multi-channel publishing test completed successfully!');
    console.log('=' .repeat(50));
    
    // Summary
    console.log('\n📋 Test Summary:');
    console.log(`✅ Content created: ${results.content.title}`);
    console.log(`✅ WordPress: ${results.publishing_results.wordpress?.success ? 'Success' : 'Failed'}`);
    console.log(`✅ LinkedIn: ${results.publishing_results.linkedin?.success ? 'Success' : 'Failed'}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Helper function to simulate a delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
if (require.main === module) {
  testMultiChannelPublishing().catch(console.error);
}

module.exports = { testMultiChannelPublishing };