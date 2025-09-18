import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  apiStatus: 'unknown' | 'checking' | 'healthy' | 'error';
  debugInfo: any;
}

class DebugErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      apiStatus: 'unknown',
      debugInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary Caught Error:', error);
    console.error('🚨 Error Info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
      apiStatus: 'checking'
    });

    // Test API connectivity when error occurs
    this.checkAPIHealth();
  }

  checkAPIHealth = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Test basic connectivity
      const response = await fetch(`${API_BASE_URL}/api/v1/debug/frontend-test`, {
        method: 'GET',
        headers: {
          'Origin': window.location.origin,
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.setState({ 
          apiStatus: 'healthy',
          debugInfo: {
            api_response: data,
            current_url: window.location.href,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        throw new Error(`API responded with ${response.status}: ${response.statusText}`);
      }
    } catch (apiError) {
      console.error('🚨 API Health Check Failed:', apiError);
      this.setState({ 
        apiStatus: 'error',
        debugInfo: {
          api_error: apiError instanceof Error ? apiError.message : 'Unknown API error',
          current_url: window.location.href,
          user_agent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
                <h2 className="mt-6 text-lg font-medium text-gray-900">
                  🐛 Application Error Detected
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  The application encountered an error. Debug information is shown below.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {/* API Status */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">🌐 API Status</h3>
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${
                      this.state.apiStatus === 'healthy' ? 'bg-green-500' :
                      this.state.apiStatus === 'error' ? 'bg-red-500' :
                      this.state.apiStatus === 'checking' ? 'bg-yellow-500' :
                      'bg-gray-500'
                    }`}></div>
                    <span className="text-sm text-gray-700">
                      {this.state.apiStatus === 'healthy' ? 'API is responding' :
                       this.state.apiStatus === 'error' ? 'API is not responding' :
                       this.state.apiStatus === 'checking' ? 'Checking API...' :
                       'API status unknown'}
                    </span>
                  </div>
                </div>

                {/* Error Details */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">🚨 Error Details</h3>
                  <div className="bg-gray-50 rounded p-3 text-xs">
                    <p><strong>Error:</strong> {this.state.error?.message}</p>
                    <p><strong>Stack:</strong></p>
                    <pre className="mt-1 text-xs text-gray-600 overflow-auto max-h-32">
                      {this.state.error?.stack}
                    </pre>
                  </div>
                </div>

                {/* Debug Info */}
                {this.state.debugInfo && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">🔍 Debug Information</h3>
                    <div className="bg-gray-50 rounded p-3 text-xs">
                      <pre className="overflow-auto max-h-40">
                        {JSON.stringify(this.state.debugInfo, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Component Stack */}
                {this.state.errorInfo && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-2">⚛️ Component Stack</h3>
                    <div className="bg-gray-50 rounded p-3 text-xs">
                      <pre className="overflow-auto max-h-32">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex space-x-3">
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  🔄 Reload Page
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                >
                  🏠 Go Home
                </button>
                <button
                  onClick={this.checkAPIHealth}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                >
                  🔄 Test API
                </button>
              </div>

              {/* Troubleshooting Tips */}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">💡 Troubleshooting Tips</h3>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• Check browser console for additional errors</li>
                  <li>• Verify API is running at: {import.meta.env.VITE_API_URL}</li>
                  <li>• Check network requests in browser dev tools</li>
                  <li>• Try refreshing the page or clearing browser cache</li>
                  <li>• Check if CORS is properly configured</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default DebugErrorBoundary;