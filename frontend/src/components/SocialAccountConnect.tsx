import React, { useState, useEffect } from 'react';
import { LinkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

interface SocialAccountConnectProps {
  onConnectionComplete?: () => void;
}

const SocialAccountConnect: React.FC<SocialAccountConnectProps> = ({ onConnectionComplete }) => {
  const [step, setStep] = useState<'select-platform' | 'authorize' | 'select-page' | 'complete'>('select-platform');
  const [selectedPlatform, setSelectedPlatform] = useState<'facebook' | 'twitter' | 'linkedin' | 'instagram' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authState, setAuthState] = useState<string | null>(null);
  const [availablePages, setAvailablePages] = useState<FacebookPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      description: 'Connect your Facebook page to automatically post updates',
      color: 'bg-blue-600',
      available: true
    },
    {
      id: 'twitter',
      name: 'Twitter',
      description: 'Share updates and engage with your Twitter audience',
      color: 'bg-sky-400',
      available: false
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      description: 'Post professional updates to your LinkedIn network',
      color: 'bg-blue-700',
      available: false
    },
    {
      id: 'instagram',
      name: 'Instagram',
      description: 'Share visual content with your Instagram followers',
      color: 'bg-pink-500',
      available: false
    }
  ];

  useEffect(() => {
    // Check for OAuth callback in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError(`Authorization failed: ${error}`);
      setStep('select-platform');
    } else if (code && state) {
      handleOAuthCallback(code, state);
    }
  }, []);

  const selectPlatform = (platform: string) => {
    if (!platforms.find(p => p.id === platform)?.available) {
      setError(`${platform} integration is coming soon!`);
      return;
    }

    setSelectedPlatform(platform as any);
    setError(null);
    
    if (platform === 'facebook') {
      initiateFacebookAuth();
    }
  };

  const initiateFacebookAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch(`/api/v1/social/facebook/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await response.json();

      if (data.success) {
        setAuthUrl(data.data.authUrl);
        setAuthState(data.data.state);
        setStep('authorize');
      } else {
        setError(data.error?.message || 'Failed to generate authorization URL');
      }
    } catch (err) {
      setError('Error initiating Facebook authorization');
      console.error('Facebook auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setLoading(true);
      setError(null);

      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch('/api/v1/social/facebook/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          redirectUri,
          state
        })
      });

      const data = await response.json();

      if (data.success) {
        setAvailablePages(data.data.pages);
        setStep('select-page');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setError(data.error?.message || 'Failed to connect Facebook account');
        setStep('select-platform');
      }
    } catch (err) {
      setError('Error processing authorization callback');
      console.error('OAuth callback error:', err);
      setStep('select-platform');
    } finally {
      setLoading(false);
    }
  };

  const connectFacebookPage = async (pageId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Find the selected page
      const selectedPage = availablePages.find(page => page.id === pageId);
      if (!selectedPage) {
        setError('Selected page not found');
        return;
      }

      // Here you would typically save the page access token to your backend
      // For now, we'll simulate a successful connection
      setSelectedPageId(pageId);
      setStep('complete');

      if (onConnectionComplete) {
        onConnectionComplete();
      }
    } catch (err) {
      setError('Error connecting Facebook page');
      console.error('Page connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep('select-platform');
    setSelectedPlatform(null);
    setError(null);
    setAuthUrl(null);
    setAuthState(null);
    setAvailablePages([]);
    setSelectedPageId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {['Select Platform', 'Authorize', 'Configure', 'Complete'].map((stepName, index) => {
            const stepNumber = index + 1;
            const isActive = 
              (step === 'select-platform' && stepNumber === 1) ||
              (step === 'authorize' && stepNumber === 2) ||
              (step === 'select-page' && stepNumber === 3) ||
              (step === 'complete' && stepNumber === 4);
            const isCompleted = 
              (step === 'authorize' && stepNumber === 1) ||
              (step === 'select-page' && stepNumber <= 2) ||
              (step === 'complete' && stepNumber <= 3);

            return (
              <React.Fragment key={stepName}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isActive 
                      ? 'border-indigo-500 text-indigo-500' 
                      : 'border-gray-300 text-gray-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{stepNumber}</span>
                  )}
                </div>
                {index < 3 && (
                  <div className={`w-16 h-0.5 ${
                    isCompleted || (step === 'select-page' && stepNumber === 2) || (step === 'complete' && stepNumber <= 3)
                      ? 'bg-green-500' 
                      : 'bg-gray-300'
                  }`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex justify-center mt-2">
          <span className="text-sm font-medium text-gray-600">
            {step === 'select-platform' && 'Choose your social media platform'}
            {step === 'authorize' && 'Authorize the connection'}
            {step === 'select-page' && 'Select page or account'}
            {step === 'complete' && 'Connection complete'}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === 'select-platform' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Connect Social Media Account</h2>
            <p className="mt-2 text-gray-600">
              Choose a platform to connect and start automatically posting your content.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platforms.map((platform) => (
              <div
                key={platform.id}
                className={`relative rounded-lg border p-6 cursor-pointer transition-all ${
                  platform.available
                    ? 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                    : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                }`}
                onClick={() => selectPlatform(platform.id)}
              >
                <div className="flex items-center">
                  <div className={`w-10 h-10 rounded-lg ${platform.color} flex items-center justify-center mr-4`}>
                    <LinkIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {platform.name}
                      {!platform.available && (
                        <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                          Coming Soon
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{platform.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'authorize' && (
        <div className="text-center">
          <div className={`w-16 h-16 rounded-full ${selectedPlatform === 'facebook' ? 'bg-blue-600' : 'bg-gray-400'} flex items-center justify-center mx-auto mb-6`}>
            <LinkIcon className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authorize {selectedPlatform && platforms.find(p => p.id === selectedPlatform)?.name}
          </h2>
          
          <p className="text-gray-600 mb-8">
            Click the button below to open {selectedPlatform} in a new window and authorize the connection.
          </p>
          
          {authUrl && (
            <a
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <LinkIcon className="w-5 h-5 mr-2" />
              Authorize Connection
            </a>
          )}
          
          <div className="mt-4">
            <button
              onClick={startOver}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back to platform selection
            </button>
          </div>
        </div>
      )}

      {step === 'select-page' && availablePages.length > 0 && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Select Facebook Page</h2>
            <p className="mt-2 text-gray-600">
              Choose which Facebook page you want to connect for posting.
            </p>
          </div>
          
          <div className="space-y-4">
            {availablePages.map((page) => (
              <div
                key={page.id}
                className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
                onClick={() => connectFacebookPage(page.id)}
              >
                <div className="flex items-center">
                  {page.picture && (
                    <img
                      src={page.picture.data.url}
                      alt={page.name}
                      className="w-12 h-12 rounded-full mr-4"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">{page.name}</h3>
                    <p className="text-sm text-gray-500">{page.category}</p>
                  </div>
                  <div className="text-indigo-600">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={startOver}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Start over
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-6">
            <CheckCircleIcon className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Successfully Connected!
          </h2>
          
          <p className="text-gray-600 mb-8">
            Your {selectedPlatform} account has been successfully connected. 
            New posts will now be automatically scheduled for this platform.
          </p>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={startOver}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Connect Another Account
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialAccountConnect;