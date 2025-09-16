import React, { useState } from 'react';
import { 
  CogIcon, 
  KeyIcon, 
  GlobeAltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

interface WixPluginConfigProps {
  onSave?: (settings: WixPluginSettings) => void;
  onClose?: () => void;
  initialSettings?: WixPluginSettings;
}

interface WixPluginSettings {
  api_base_url: string;
  api_key: string;
  brand_voice_id: string;
  enable_suggestions: boolean;
  enable_generation: boolean;
  enable_adaptation: boolean;
  rate_limits: {
    suggestions: number;
    generation: number;
  };
}

const WixPluginConfig: React.FC<WixPluginConfigProps> = ({
  onSave,
  onClose,
  initialSettings = {
    api_base_url: 'http://localhost:5000/api/v1/ai',
    api_key: '',
    brand_voice_id: '',
    enable_suggestions: true,
    enable_generation: true,
    enable_adaptation: true,
    rate_limits: {
      suggestions: 30,
      generation: 10
    }
  }
}) => {
  const [settings, setSettings] = useState<WixPluginSettings>(initialSettings);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setSettings(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof WixPluginSettings] as any,
          [child]: value
        }
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const testConnection = async () => {
    if (!settings.api_key.trim()) {
      setTestStatus('error');
      setTestMessage('API key is required for testing connection');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing connection...');

    try {
      const response = await fetch(`${settings.api_base_url}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTestStatus('success');
        setTestMessage(`Connection successful! Service: ${data.service}, Model: ${data.config?.model}`);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSave = () => {
    onSave?.(settings);
  };

  const downloadPluginFiles = () => {
    // Create a link to download the Wix plugin files
    window.open('/integrations/wix-plugin/', '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CogIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Wix AI Writing Assistant</h2>
              <p className="text-gray-600">Configure your Wix plugin settings</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Form */}
        <div className="space-y-6">
          {/* API Settings */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <KeyIcon className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">API Configuration</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Base URL
                </label>
                <input
                  type="url"
                  value={settings.api_base_url}
                  onChange={(e) => handleInputChange('api_base_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="http://localhost:5000/api/v1/ai"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.api_key}
                  onChange={(e) => handleInputChange('api_key', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your API key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Brand Voice ID (Optional)
                </label>
                <input
                  type="text"
                  value={settings.brand_voice_id}
                  onChange={(e) => handleInputChange('brand_voice_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Leave empty for default voice"
                />
              </div>

              <button
                onClick={testConnection}
                disabled={testStatus === 'testing'}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <GlobeAltIcon className="w-4 h-4" />
                <span>{testStatus === 'testing' ? 'Testing...' : 'Test Connection'}</span>
              </button>

              {/* Test Status */}
              {testStatus !== 'idle' && (
                <div className={`p-3 rounded-md flex items-center space-x-2 ${
                  testStatus === 'success' ? 'bg-green-50 text-green-800' :
                  testStatus === 'error' ? 'bg-red-50 text-red-800' :
                  'bg-blue-50 text-blue-800'
                }`}>
                  {testStatus === 'success' ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : testStatus === 'error' ? (
                    <ExclamationTriangleIcon className="w-5 h-5" />
                  ) : (
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span className="text-sm">{testMessage}</span>
                </div>
              )}
            </div>
          </div>

          {/* Feature Settings */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Settings</h3>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.enable_suggestions}
                  onChange={(e) => handleInputChange('enable_suggestions', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Enable Writing Suggestions</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.enable_generation}
                  onChange={(e) => handleInputChange('enable_generation', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Enable Content Generation</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={settings.enable_adaptation}
                  onChange={(e) => handleInputChange('enable_adaptation', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm text-gray-700">Enable Content Adaptation</span>
              </label>
            </div>
          </div>

          {/* Rate Limits */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limits (per minute)</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suggestions Limit: {settings.rate_limits.suggestions}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={settings.rate_limits.suggestions}
                  onChange={(e) => handleInputChange('rate_limits.suggestions', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Generation Limit: {settings.rate_limits.generation}
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  value={settings.rate_limits.generation}
                  onChange={(e) => handleInputChange('rate_limits.generation', parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 font-medium"
          >
            Save Configuration
          </button>
        </div>

        {/* Documentation & Setup Guide */}
        <div className="space-y-6">
          {/* Quick Setup */}
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <DocumentTextIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Quick Setup Guide</h3>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</div>
                <div>
                  <p className="font-medium">Download Plugin Files</p>
                  <p className="text-gray-600">Get the Wix plugin files from your CMS platform</p>
                  <button
                    onClick={downloadPluginFiles}
                    className="mt-2 inline-flex items-center text-blue-600 hover:text-blue-800 text-xs"
                  >
                    <ArrowTopRightOnSquareIcon className="w-3 h-3 mr-1" />
                    Download Plugin
                  </button>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</div>
                <div>
                  <p className="font-medium">Upload to Wix</p>
                  <p className="text-gray-600">In Wix Editor, go to Dev Mode and upload the plugin files to your public folder</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</div>
                <div>
                  <p className="font-medium">Configure API</p>
                  <p className="text-gray-600">Set your API key and base URL in the settings above</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</div>
                <div>
                  <p className="font-medium">Test & Use</p>
                  <p className="text-gray-600">Test the connection and start enhancing your Wix content with AI</p>
                </div>
              </div>
            </div>
          </div>

          {/* Features Overview */}
          <div className="bg-green-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Features</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span>AI Content Generation</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span>Real-time Writing Suggestions</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span>Brand Voice Consistency</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span>Multi-format Content Adaptation</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span>One-click Content Enhancement</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                <span>Batch Processing</span>
              </div>
            </div>
          </div>

          {/* Support */}
          <div className="bg-gray-100 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Need Help?</h3>
            
            <div className="space-y-2 text-sm text-gray-700">
              <p>📚 <a href="/docs/wix-plugin" className="text-blue-600 hover:underline">View Documentation</a></p>
              <p>💬 <a href="/support" className="text-blue-600 hover:underline">Contact Support</a></p>
              <p>🐛 <a href="/issues" className="text-blue-600 hover:underline">Report Issues</a></p>
              <p>📹 <a href="/tutorials/wix-setup" className="text-blue-600 hover:underline">Video Tutorial</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WixPluginConfig;