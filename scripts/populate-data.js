#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config', 'supabase-test.env');

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`Configuration file not found: ${CONFIG_FILE}`);
  }
  
  const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
  const config = {};
  
  configContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  return config;
}

const config = loadConfig();
const SUPABASE_URL = config.SUPABASE_URL;
const SERVICE_KEY = config.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing required configuration: SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const apiBaseURL = `${SUPABASE_URL}/rest/v1`;
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY
};

async function insertSampleData() {
  try {
    console.log('📝 Inserting content types...');
    
    const contentTypes = [
      {
        id: 'blog-post',
        name: 'Blog Post',
        description: 'Standard blog post content type',
        schema: {
          title: { type: 'string', required: true },
          content: { type: 'text', required: true },
          excerpt: { type: 'string' },
          featured_image: { type: 'string' },
          tags: { type: 'array' }
        },
        is_active: true
      },
      {
        id: 'product',
        name: 'Product',
        description: 'E-commerce product content type',
        schema: {
          name: { type: 'string', required: true },
          description: { type: 'text', required: true },
          price: { type: 'number' },
          images: { type: 'array' },
          category: { type: 'string' }
        },
        is_active: true
      },
      {
        id: 'landing-page',
        name: 'Landing Page',
        description: 'Marketing landing page content type',
        schema: {
          title: { type: 'string', required: true },
          subtitle: { type: 'string' },
          hero_image: { type: 'string' },
          sections: { type: 'array' }
        },
        is_active: true
      }
    ];

    for (const contentType of contentTypes) {
      try {
        await axios.post(`${apiBaseURL}/content_types`, contentType, { headers });
        console.log(`✅ Content type '${contentType.name}' created`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`ℹ️  Content type '${contentType.name}' already exists`);
        } else {
          console.error(`❌ Error creating content type '${contentType.name}':`, error.response?.data);
        }
      }
    }

    console.log('📝 Inserting sample content items...');
    
    const contentItems = [
      {
        id: 'welcome-post-001',
        content_type_id: 'blog-post',
        title: 'Welcome to Our CMS Platform',
        content: {
          title: 'Welcome to Our CMS Platform',
          content: 'This is a sample blog post demonstrating the capabilities of our headless CMS. You can create, edit, and manage content through our intuitive interface.',
          excerpt: 'A sample blog post showcasing CMS capabilities',
          tags: ['welcome', 'cms', 'sample']
        },
        status: 'published',
        published_at: new Date().toISOString()
      },
      {
        id: 'sample-product-001',
        content_type_id: 'product',
        title: 'Premium Coffee Beans',
        content: {
          name: 'Premium Coffee Beans',
          description: 'Ethically sourced premium coffee beans from high-altitude regions',
          price: 24.99,
          category: 'beverages',
          images: []
        },
        status: 'published',
        published_at: new Date().toISOString()
      },
      {
        id: 'main-landing-001',
        content_type_id: 'landing-page',
        title: 'Main Landing Page',
        content: {
          title: 'Transform Your Digital Experience',
          subtitle: 'Build powerful websites and applications with our headless CMS',
          sections: [
            {
              type: 'hero',
              content: 'Empower your team with flexible content management'
            },
            {
              type: 'features',
              content: 'API-first architecture, Developer-friendly, Scalable infrastructure'
            }
          ]
        },
        status: 'draft'
      }
    ];

    for (const item of contentItems) {
      try {
        await axios.post(`${apiBaseURL}/content_items`, item, { headers });
        console.log(`✅ Content item '${item.title}' created`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log(`ℹ️  Content item '${item.title}' already exists`);
        } else {
          console.error(`❌ Error creating content item '${item.title}':`, error.response?.data);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error inserting sample data:', error.response?.data || error.message);
    throw error;
  }
}

async function verifySetup() {
  try {
    console.log('🔍 Verifying database setup...');
    
    const contentTypesResponse = await axios.get(`${apiBaseURL}/content_types?select=*`, { headers });
    console.log(`✅ Found ${contentTypesResponse.data.length} content types`);
    
    const contentItemsResponse = await axios.get(`${apiBaseURL}/content_items?select=*`, { headers });
    console.log(`✅ Found ${contentItemsResponse.data.length} content items`);
    
    const bucketsResponse = await axios.get(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        ...headers,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    console.log(`✅ Found ${bucketsResponse.data.length} storage buckets`);
    
    console.log('🎉 Database verification completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error during verification:', error.response?.data || error.message);
    return false;
  }
}

async function populateData() {
  console.log('🚀 Populating Supabase with sample data...');
  console.log(`📡 Connecting to: ${SUPABASE_URL}`);
  
  try {
    await insertSampleData();
    
    console.log('\n🔍 Verifying setup...');
    const isValid = await verifySetup();
    
    if (isValid) {
      console.log('\n🎉 Sample data population completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Install @supabase/supabase-js package');
      console.log('2. Create SupabaseService integration');
      console.log('3. Update environment configuration');
      console.log('4. Test the integration');
    } else {
      console.log('\n⚠️  Data population completed with some verification warnings');
    }
    
  } catch (error) {
    console.error('\n💥 Population failed:', error.message);
    console.error('Please check that tables exist and try again.');
    process.exit(1);
  }
}

if (require.main === module) {
  populateData();
}

module.exports = { populateData, loadConfig };