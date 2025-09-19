import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';

// Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  planType: 'free' | 'pro' | 'enterprise';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  organizations: Array<{ id: string; name: string; slug: string; role: string }>;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  organizationId?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

// Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; organization: Organization; organizations: any[]; tokens: AuthTokens } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'TOKEN_REFRESH'; payload: { accessToken: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SWITCH_ORGANIZATION'; payload: { organization: Organization } };

// Initial state
const initialState: AuthState = {
  user: null,
  organization: null,
  organizations: [],
  tokens: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        organization: action.payload.organization,
        organizations: action.payload.organizations,
        tokens: action.payload.tokens,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      };
    case 'AUTH_ERROR':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
      };
    case 'TOKEN_REFRESH':
      return {
        ...state,
        tokens: state.tokens ? { ...state.tokens, accessToken: action.payload.accessToken } : null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SWITCH_ORGANIZATION':
      return {
        ...state,
        organization: action.payload.organization,
      };
    default:
      return state;
  }
}

// Context
interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API Base URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Storage helpers
const TOKEN_STORAGE_KEY = 'cms_auth_tokens';
const USER_STORAGE_KEY = 'cms_user_data';

const saveToStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

const getFromStorage = (key: string) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to read from localStorage:', error);
    return null;
  }
};

const removeFromStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to remove from localStorage:', error);
  }
};

// API helpers
const apiCall = async (endpoint: string, options: RequestInit = {}): Promise<any> => {
  const url = `${API_BASE_URL}/api/v1${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'API request failed');
  }

  return data;
};

const authenticatedApiCall = async (endpoint: string, accessToken: string, options: RequestInit = {}): Promise<any> => {
  return apiCall(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });
};

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Load stored auth data on mount
  useEffect(() => {
    const storedTokens = getFromStorage(TOKEN_STORAGE_KEY);
    const storedUserData = getFromStorage(USER_STORAGE_KEY);

    if (storedTokens && storedUserData) {
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: storedUserData.user,
          organization: storedUserData.organization,
          organizations: storedUserData.organizations || [],
          tokens: storedTokens,
        },
      });

      // Verify token is still valid
      verifyAndRefreshToken(storedTokens.accessToken);
    }
  }, []);

  // Auto-refresh token before expiry
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (state.tokens?.accessToken) {
      // Refresh token every 10 minutes (tokens expire in 15 minutes)
      refreshInterval = setInterval(() => {
        refreshToken();
      }, 10 * 60 * 1000);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [state.tokens?.accessToken]);

  const verifyAndRefreshToken = async (accessToken: string) => {
    try {
      await authenticatedApiCall('/auth/me', accessToken);
    } catch (error) {
      // Token is invalid, try to refresh
      await refreshToken();
    }
  };

  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      if (response.success) {
        const { user, organization, organizations, tokens } = response.data;

        // Store tokens and user data
        saveToStorage(TOKEN_STORAGE_KEY, tokens);
        saveToStorage(USER_STORAGE_KEY, { user, organization, organizations });

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, organization, organizations, tokens },
        });
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
    } catch (error) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error instanceof Error ? error.message : 'Login failed',
      });
      throw error;
    }
  };

  const register = async (data: RegisterData) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const response = await apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.success) {
        const { user, organization, tokens } = response.data;

        // Store tokens and user data
        saveToStorage(TOKEN_STORAGE_KEY, tokens);
        saveToStorage(USER_STORAGE_KEY, { user, organization, organizations: [{ id: organization.id, name: organization.name, slug: organization.slug, role: 'owner' }] });

        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { 
            user, 
            organization, 
            organizations: [{ id: organization.id, name: organization.name, slug: organization.slug, role: 'owner' }], 
            tokens 
          },
        });
      } else {
        throw new Error(response.error?.message || 'Registration failed');
      }
    } catch (error) {
      dispatch({
        type: 'AUTH_ERROR',
        payload: error instanceof Error ? error.message : 'Registration failed',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (state.tokens?.refreshToken) {
        await authenticatedApiCall('/auth/logout', state.tokens.accessToken, {
          method: 'POST',
          body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear storage regardless of API call success
      removeFromStorage(TOKEN_STORAGE_KEY);
      removeFromStorage(USER_STORAGE_KEY);
      dispatch({ type: 'LOGOUT' });
    }
  };

  const refreshToken = async () => {
    if (!state.tokens?.refreshToken) {
      dispatch({ type: 'LOGOUT' });
      return;
    }

    try {
      const response = await apiCall('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: state.tokens.refreshToken }),
      });

      if (response.success) {
        const newTokens = {
          ...state.tokens,
          accessToken: response.data.accessToken,
        };

        saveToStorage(TOKEN_STORAGE_KEY, newTokens);
        dispatch({ type: 'TOKEN_REFRESH', payload: { accessToken: response.data.accessToken } });
      } else {
        throw new Error('Token refresh failed');
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Force logout on refresh failure
      logout();
    }
  };

  const switchOrganization = async (organizationId: string) => {
    if (!state.tokens?.accessToken) return;

    try {
      // Re-login with specific organization
      const currentUser = state.user;
      if (!currentUser) return;

      // Find the organization in user's organizations
      const targetOrg = state.organizations.find(org => org.id === organizationId);
      if (!targetOrg) {
        throw new Error('Organization not found');
      }

      // For now, we'll just switch locally. In a full implementation,
      // you might want to get a new token with the new organization context
      const newOrganization: Organization = {
        id: targetOrg.id,
        name: targetOrg.name,
        slug: targetOrg.slug,
        planType: 'free', // This should come from API
      };

      dispatch({
        type: 'SWITCH_ORGANIZATION',
        payload: { organization: newOrganization },
      });

      // Update stored user data
      const storedUserData = getFromStorage(USER_STORAGE_KEY);
      if (storedUserData) {
        storedUserData.organization = newOrganization;
        saveToStorage(USER_STORAGE_KEY, storedUserData);
      }
    } catch (error) {
      console.error('Failed to switch organization:', error);
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const hasPermission = (permission: string): boolean => {
    return state.user?.permissions.includes(permission) || false;
  };

  const hasRole = (roles: string | string[]): boolean => {
    if (!state.user?.role) return false;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return allowedRoles.includes(state.user.role);
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshToken,
    clearError,
    switchOrganization,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}