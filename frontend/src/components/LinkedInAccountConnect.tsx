import React, { useState, useEffect } from 'react';
import { LinkIcon, CheckCircleIcon, ExclamationTriangleIcon, BuildingOfficeIcon, UserIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  profilePicture?: {
    displayImage: string;
  };
  vanityName?: string;
}

interface LinkedInOrganization {
  id: string;
  name: string;
  vanityName?: string;
  logoV2?: {
    original: string;
  };
}

interface LinkedInAccountConnectProps {
  onConnectionComplete?: () => void;
}

const LinkedInAccountConnect: React.FC<LinkedInAccountConnectProps> = ({ onConnectionComplete }) => {
  const [step, setStep] = useState<'authorize' | 'select-account' | 'complete'>('authorize');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authState, setAuthState] = useState<string | null>(null);
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [organizations, setOrganizations] = useState<LinkedInOrganization[]>([]);
  const [selectedAccountType, setSelectedAccountType] = useState<'personal' | 'organization'>('personal');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    // Check for OAuth callback in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      setError(`Authorization failed: ${error}`);
      setStep('authorize');
    } else if (code && state) {
      handleOAuthCallback(code, state);
    } else {
      initializeLinkedInAuth();
    }
  }, []);

  const initializeLinkedInAuth = async () => {
    try {
      setLoading(true);
      setError(null);

      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch(`/api/v1/linkedin/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`);
      const data = await response.json();

      if (data.success) {
        setAuthUrl(data.data.authUrl);
        setAuthState(data.data.state);
      } else {
        setError(data.error?.message || 'Failed to generate authorization URL');
      }
    } catch (err) {
      setError('Error initiating LinkedIn authorization');
      console.error('LinkedIn auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setLoading(true);
      setError(null);

      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const response = await fetch('/api/v1/linkedin/connect', {
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
        setProfile(data.data.profile);
        setOrganizations(data.data.organizations || []);
        setStep('select-account');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        setError(data.error?.message || 'Failed to connect LinkedIn account');
        setStep('authorize');
      }
    } catch (err) {
      setError('Error processing authorization callback');
      console.error('OAuth callback error:', err);
      setStep('authorize');
    } finally {
      setLoading(false);
    }
  };

  const completeConnection = async () => {
    try {
      setLoading(true);
      setError(null);

      // Here you would typically save the connection preferences
      // For now, we'll just simulate a successful connection
      setStep('complete');

      if (onConnectionComplete) {
        onConnectionComplete();
      }
    } catch (err) {
      setError('Error completing LinkedIn connection');
      console.error('Connection completion error:', err);
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStep('authorize');
    setError(null);
    setProfile(null);
    setOrganizations([]);
    setSelectedAccountType('personal');
    setSelectedOrganizationId(null);
    initializeLinkedInAuth();
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
          {['Authorize', 'Select Account', 'Complete'].map((stepName, index) => {
            const stepNumber = index + 1;
            const isActive = 
              (step === 'authorize' && stepNumber === 1) ||
              (step === 'select-account' && stepNumber === 2) ||
              (step === 'complete' && stepNumber === 3);
            const isCompleted = 
              (step === 'select-account' && stepNumber === 1) ||
              (step === 'complete' && stepNumber <= 2);

            return (
              <React.Fragment key={stepName}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  isCompleted 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : isActive 
                      ? 'border-blue-500 text-blue-500' 
                      : 'border-gray-300 text-gray-300'
                }`}>
                  {isCompleted ? (
                    <CheckCircleIcon className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{stepNumber}</span>
                  )}
                </div>
                {index < 2 && (
                  <div className={`w-16 h-0.5 ${
                    isCompleted || (step === 'complete' && stepNumber === 2)
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
            {step === 'authorize' && 'Authorize LinkedIn connection'}
            {step === 'select-account' && 'Select posting account'}
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
      {step === 'authorize' && (
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-blue-700 flex items-center justify-center mx-auto mb-6">
            <LinkIcon className="w-8 h-8 text-white" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Connect Your LinkedIn Account
          </h2>
          
          <p className="text-gray-600 mb-8">
            Connect your LinkedIn profile to automatically share your content with your professional network.
          </p>
          
          <div className="bg-blue-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-blue-900 mb-4">What you'll be able to do:</h3>
            <ul className="text-left text-blue-800 space-y-2">
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                Post to your personal LinkedIn profile
              </li>
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                Post to company pages you manage
              </li>
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                Schedule posts for optimal engagement times
              </li>
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-blue-600 mr-2" />
                Track post performance and analytics
              </li>
            </ul>
          </div>
          
          {authUrl && (
            <a
              href={authUrl}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <LinkIcon className="w-5 h-5 mr-2" />
              Connect LinkedIn Account
            </a>
          )}
          
          <div className="mt-4">
            <button
              onClick={startOver}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
        </div>
      )}

      {step === 'select-account' && (
        <div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Select Posting Account</h2>
            <p className="mt-2 text-gray-600">
              Choose how you want to post to LinkedIn.
            </p>
          </div>
          
          <div className="space-y-4">
            {/* Personal Profile Option */}
            {profile && (
              <div
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  selectedAccountType === 'personal'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedAccountType('personal')}
              >
                <div className="flex items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center mr-4">
                    <UserIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      Personal Profile
                    </h3>
                    <p className="text-sm text-gray-500">
                      {profile.firstName} {profile.lastName}
                      {profile.vanityName && ` (@${profile.vanityName})`}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">
                      Post to your personal LinkedIn timeline
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="radio"
                      name="accountType"
                      value="personal"
                      checked={selectedAccountType === 'personal'}
                      onChange={() => setSelectedAccountType('personal')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Organization Options */}
            {organizations.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Or post as a company page:
                </h3>
                <div className="space-y-3">
                  {organizations.map((org) => (
                    <div
                      key={org.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedAccountType === 'organization' && selectedOrganizationId === org.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedAccountType('organization');
                        setSelectedOrganizationId(org.id);
                      }}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded bg-blue-700 flex items-center justify-center mr-3">
                          <BuildingOfficeIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-md font-medium text-gray-900">{org.name}</h4>
                          {org.vanityName && (
                            <p className="text-sm text-gray-500">@{org.vanityName}</p>
                          )}
                        </div>
                        <div className="ml-4">
                          <input
                            type="radio"
                            name="accountType"
                            value={`organization-${org.id}`}
                            checked={selectedAccountType === 'organization' && selectedOrganizationId === org.id}
                            onChange={() => {
                              setSelectedAccountType('organization');
                              setSelectedOrganizationId(org.id);
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-8 flex justify-between">
            <button
              onClick={startOver}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ← Start over
            </button>
            <button
              onClick={completeConnection}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Complete Connection
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
            LinkedIn Connected Successfully!
          </h2>
          
          <p className="text-gray-600 mb-6">
            Your LinkedIn account has been connected. You're now ready to automatically share your content with your professional network.
          </p>

          <div className="bg-green-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-medium text-green-900 mb-4">What happens next:</h3>
            <ul className="text-left text-green-800 space-y-2">
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                New blog posts will be automatically scheduled for LinkedIn
              </li>
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                Posts will be published at optimal times (12:00 PM UTC)
              </li>
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                You can manage and track posts from your dashboard
              </li>
              <li className="flex items-center">
                <CheckCircleIcon className="w-5 h-5 text-green-600 mr-2" />
                {selectedAccountType === 'personal' 
                  ? 'Posts will appear on your personal profile'
                  : `Posts will appear on ${organizations.find(o => o.id === selectedOrganizationId)?.name}`
                }
              </li>
            </ul>
          </div>
          
          <div className="flex justify-center space-x-4">
            <button
              onClick={startOver}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Connect Another Account
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkedInAccountConnect;