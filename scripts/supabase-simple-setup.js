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

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'apikey': SERVICE_KEY
};

async function createStorageBucket() {
  try {
    console.log('📝 Creating storage bucket...');
    
    const bucketConfig = {
      id: 'cms-media',
      name: 'cms-media',
      public: true,
      allowed_mime_types: [
        'image/jpeg',
        'image/png', 
        'image/gif',
        'image/webp',
        'video/mp4',
        'application/pdf',
        'text/plain'
      ],
      file_size_limit: 10485760
    };

    await axios.post(
      `${SUPABASE_URL}/storage/v1/bucket`,
      bucketConfig,
      {
        headers: {
          ...headers,
          'Authorization': `Bearer ${SERVICE_KEY}`
        }
      }
    );
    
    console.log('✅ Storage bucket created successfully');
  } catch (error) {
    if (error.response?.status === 409) {
      console.log('ℹ️  Storage bucket already exists');
    } else {
      console.error('❌ Error creating storage bucket:', error.response?.data || error.message);
    }
  }
}

async function testConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // Test basic connection
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/`, { headers });
    console.log('✅ Successfully connected to Supabase');
    
    // Test storage connection
    const storageResponse = await axios.get(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        ...headers,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    console.log('✅ Storage API accessible');
    
    return true;
  } catch (error) {
    console.error('❌ Connection test failed:', error.response?.data || error.message);
    return false;
  }
}

async function setupSupabaseBasic() {
  console.log('🚀 Starting basic Supabase setup...');
  console.log(`📡 Connecting to: ${SUPABASE_URL}`);
  
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.log('❌ Cannot proceed without connection');
      return;
    }
    
    console.log('\n💾 Setting up storage...');
    await createStorageBucket();
    
    console.log('\n📋 Manual steps required:');
    console.log('1. Go to https://supabase.com/dashboard/project/neezcjbguizmkbyglroe/sql/new');
    console.log('2. Copy the SQL from scripts/create-tables-manual.sql');
    console.log('3. Paste and run the SQL to create tables');
    console.log('4. Then run: node scripts/populate-data.js');
    
    console.log('\n🎉 Basic Supabase setup completed!');
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error.message);
    console.error('Please check your configuration and try again.');
    process.exit(1);
  }
}

if (require.main === module) {
  setupSupabaseBasic();
}

module.exports = { setupSupabaseBasic, loadConfig };