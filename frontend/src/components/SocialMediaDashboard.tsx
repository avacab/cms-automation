import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, CheckCircleIcon, XCircleIcon, ClockIcon, PlayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { contentService } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

interface SocialPost {
  id: string;
  content_id: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  scheduled_time: string;
  published_time?: string;
  platform_post_id?: string;
  post_data: {
    message: string;
    url?: string;
    imageUrl?: string;
  };
  error_message?: string;
  social_accounts?: {
    platform: string;
    account_name: string;
  };
}

interface SocialAccount {
  id: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram';
  account_name: string;
  is_active: boolean;
}

interface Analytics {
  total_posts: number;
  published_posts: number;
  failed_posts: number;
  scheduled_posts: number;
  platform_breakdown: Record<string, number>;
  success_rate: number;
}

const SocialMediaDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'scheduled' | 'accounts'>('overview');
  const [scheduledPosts, setScheduledPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load analytics, scheduled posts, and accounts
      const [analyticsRes, scheduledRes] = await Promise.all([
        fetch(`/api/v1/social/analytics?timeRange=${timeRange}`),
        fetch('/api/v1/social/posts/upcoming')
      ]);

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        if (analyticsData.success) {
          setAnalytics(analyticsData.data);
        }
      }

      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json();
        if (scheduledData.success) {
          setScheduledPosts(scheduledData.data);
        }
      }

    } catch (err) {
      setError('Failed to load social media dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const publishPostNow = async (postId: string) => {
    try {
      const response = await fetch(`/api/v1/social/posts/${postId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the scheduled posts
        loadDashboardData();
      } else {
        setError(data.error?.message || 'Failed to publish post');
      }
    } catch (err) {
      setError('Error publishing post');
      console.error('Publish error:', err);
    }
  };

  const cancelScheduledPost = async (postId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled post?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/social/posts/${postId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the scheduled posts
        loadDashboardData();
      } else {
        setError(data.error?.message || 'Failed to cancel post');
      }
    } catch (err) {
      setError('Error canceling post');
      console.error('Cancel error:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'scheduled':
        return <ClockIcon className="w-5 h-5 text-blue-500" />;
      case 'cancelled':
        return <XCircleIcon className="w-5 h-5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      facebook: 'bg-blue-600',
      twitter: 'bg-sky-400',
      linkedin: 'bg-blue-700',
      instagram: 'bg-pink-500'
    };
    return colors[platform as keyof typeof colors] || 'bg-gray-500';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Social Media Dashboard</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage your social media posts and scheduling across all platforms.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mt-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: null },
                { id: 'scheduled', name: 'Scheduled Posts', icon: ClockIcon },
                { id: 'accounts', name: 'Accounts', icon: null }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon && <tab.icon className="w-4 h-4 mr-2" />}
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div>
              {/* Analytics Cards */}
              {analytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Total Posts</h3>
                    <div className="text-3xl font-bold text-indigo-600">{analytics.total_posts}</div>
                    <div className="flex items-center mt-2">
                      <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="text-sm text-gray-500 bg-transparent border-none p-0"
                      >
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                      </select>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Published</h3>
                    <div className="text-3xl font-bold text-green-600">{analytics.published_posts}</div>
                    <div className="text-sm text-gray-500 mt-2">Successfully posted</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Scheduled</h3>
                    <div className="text-3xl font-bold text-blue-600">{analytics.scheduled_posts}</div>
                    <div className="text-sm text-gray-500 mt-2">Waiting to publish</div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Success Rate</h3>
                    <div className="text-3xl font-bold text-purple-600">{analytics.success_rate.toFixed(1)}%</div>
                    <div className="text-sm text-gray-500 mt-2">Posts published successfully</div>
                  </div>
                </div>
              )}

              {/* Platform Breakdown */}
              {analytics && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Breakdown</h3>
                  <div className="space-y-4">
                    {Object.entries(analytics.platform_breakdown).map(([platform, count]) => (
                      <div key={platform} className="flex items-center">
                        <div className={`w-4 h-4 rounded-full ${getPlatformColor(platform)} mr-3`}></div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-900 capitalize">{platform}</span>
                            <span className="text-sm text-gray-500">{count} posts</span>
                          </div>
                          <div className="mt-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getPlatformColor(platform)}`}
                              style={{ width: `${analytics.total_posts ? (count / analytics.total_posts) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'scheduled' && (
            <div>
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Scheduled Posts</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {scheduledPosts.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No scheduled posts</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Posts will appear here when they're scheduled for publishing.
                      </p>
                    </div>
                  ) : (
                    scheduledPosts.map((post) => (
                      <div key={post.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full ${getPlatformColor(post.platform)} mr-3`}></div>
                              <span className="text-sm font-medium text-gray-900 capitalize">
                                {post.platform}
                              </span>
                              {post.social_accounts && (
                                <span className="ml-2 text-sm text-gray-500">
                                  ({post.social_accounts.account_name})
                                </span>
                              )}
                              <div className="ml-3">
                                {getStatusIcon(post.status)}
                              </div>
                            </div>
                            <div className="mt-2">
                              <p className="text-sm text-gray-700 line-clamp-2">
                                {post.post_data.message}
                              </p>
                              {post.post_data.url && (
                                <a
                                  href={post.post_data.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-indigo-600 hover:text-indigo-500 mt-1 inline-block"
                                >
                                  View Original Post
                                </a>
                              )}
                            </div>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <span>Scheduled for: {formatDateTime(post.scheduled_time)}</span>
                              {post.published_time && (
                                <span className="ml-4">Published: {formatDateTime(post.published_time)}</span>
                              )}
                            </div>
                            {post.error_message && (
                              <div className="mt-2 text-sm text-red-600">
                                Error: {post.error_message}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            {post.status === 'scheduled' && (
                              <>
                                <button
                                  onClick={() => publishPostNow(post.id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                  <PlayIcon className="w-4 h-4 mr-1" />
                                  Publish Now
                                </button>
                                <button
                                  onClick={() => cancelScheduledPost(post.id)}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  <TrashIcon className="w-4 h-4 mr-1" />
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div>
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Connected Accounts</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Manage your social media account connections.
                  </p>
                </div>
                <div className="px-6 py-4">
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-lg mb-4">🔗</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Account Management</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Social media accounts are managed through the backend API. Use the API endpoints to connect and manage your social media accounts.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Available Platforms</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['Facebook', 'Twitter', 'LinkedIn', 'Instagram'].map((platform) => (
                          <div key={platform} className="text-center">
                            <div className={`w-8 h-8 rounded-full ${getPlatformColor(platform.toLowerCase())} mx-auto mb-2`}></div>
                            <span className="text-xs text-gray-600">{platform}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SocialMediaDashboard;