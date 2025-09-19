import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export function UserMenu() {
  const { user, organization, organizations, logout, switchOrganization } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsOrgDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSwitchOrganization = async (orgId: string) => {
    try {
      await switchOrganization(orgId);
      setIsOrgDropdownOpen(false);
    } catch (error) {
      console.error('Failed to switch organization:', error);
    }
  };

  if (!user || !organization) {
    return null;
  }

  const getInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  const getRoleDisplay = (role: string) => {
    const roleMap = {
      owner: 'Owner',
      admin: 'Admin',
      editor: 'Editor',
      viewer: 'Viewer'
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Organization Selector */}
      {organizations.length > 1 && (
        <div className="mr-4">
          <button
            onClick={() => setIsOrgDropdownOpen(!isOrgDropdownOpen)}
            className="flex items-center text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
          >
            <span className="max-w-32 truncate">{organization.name}</span>
            <svg className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOrgDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrganization(org.id)}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      org.id === organization.id ? 'bg-gray-50 text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-gray-500">{getRoleDisplay(org.role)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Menu */}
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
      >
        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium">
          {getInitials(user.firstName, user.lastName, user.email)}
        </div>
        <div className="hidden md:block text-left">
          <div className="font-medium">
            {user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email
            }
          </div>
          <div className="text-xs text-gray-500">{getRoleDisplay(user.role)}</div>
        </div>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-900">
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : 'User'
                }
              </div>
              <div className="text-xs text-gray-500">{user.email}</div>
              <div className="text-xs text-gray-500 mt-1">
                {organization.name} • {getRoleDisplay(user.role)}
              </div>
            </div>

            <button
              onClick={() => setIsDropdownOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Profile Settings
            </button>

            <button
              onClick={() => setIsDropdownOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Organization Settings
            </button>

            <button
              onClick={() => setIsDropdownOpen(false)}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Billing & Plans
            </button>

            <div className="border-t border-gray-100">
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}