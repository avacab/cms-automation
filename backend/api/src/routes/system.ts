import { Router, Request, Response } from 'express';
import { StorageFactory } from '../services/StorageFactory.js';

const router = Router();

// Get system status and storage information
router.get('/status', async (req: Request, res: Response) => {
  try {
    const factory = StorageFactory.getInstance();
    const storageInfo = await factory.getStorageInfo();

    const systemStatus = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      storage: storageInfo,
      version: '1.0.0',
      features: {
        supabase_ready: storageInfo.type === 'supabase' && storageInfo.status === 'connected',
        local_storage: storageInfo.type === 'local',
        ai_integration: !!process.env.OPENAI_API_KEY
      }
    };

    res.json(systemStatus);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get system status',
      error: error.message
    });
  }
});

// Get setup instructions for Supabase
router.get('/setup/supabase', (req: Request, res: Response) => {
  const instructions = {
    title: 'Supabase Setup Instructions',
    status: 'manual_setup_required',
    steps: [
      {
        step: 1,
        title: 'Create Database Tables',
        description: 'Execute SQL schema in Supabase dashboard',
        action: {
          url: 'https://supabase.com/dashboard/project/neezcjbguizmkbyglroe/sql/new',
          sql_file: 'scripts/create-tables-manual.sql',
          instructions: 'Copy the SQL from the file and run it in the Supabase SQL editor'
        }
      },
      {
        step: 2,
        title: 'Populate Sample Data',
        description: 'Insert initial content types and sample data',
        action: {
          command: 'node scripts/populate-data.js',
          instructions: 'Run this command after creating the database tables'
        }
      },
      {
        step: 3,
        title: 'Switch Environment',
        description: 'Update environment to use Supabase storage',
        action: {
          env_var: 'NODE_ENV=supabase-test',
          instructions: 'Set environment variable or create .env file with supabase-test configuration'
        }
      },
      {
        step: 4,
        title: 'Verify Setup',
        description: 'Check system status to confirm Supabase connection',
        action: {
          endpoint: '/api/v1/system/status',
          instructions: 'Call this endpoint to verify Supabase connection is working'
        }
      }
    ],
    configuration: {
      current_storage: process.env.STORAGE_TYPE || 'local',
      supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
    }
  };

  res.json(instructions);
});

// Test endpoint to verify storage functionality
router.get('/test/storage', async (req: Request, res: Response) => {
  try {
    const factory = StorageFactory.getInstance();
    const unified = factory.createUnifiedService();

    // Test basic operations
    const contentTypes = await unified.getContentTypes();
    const contentItems = await unified.getContentItems();

    res.json({
      test: 'storage_functionality',
      status: 'success',
      results: {
        content_types_count: contentTypes.length,
        content_items_count: contentItems.length,
        storage_type: process.env.STORAGE_TYPE || 'local'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      test: 'storage_functionality',
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;