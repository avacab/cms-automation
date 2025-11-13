import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { useContent, useApiHealth } from './hooks/useContent'
import { usePlugins, usePlugin } from './hooks/usePlugins'
import ContentCard from './components/ContentCard'
import PluginCard from './components/PluginCard'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorDisplay from './components/ErrorDisplay'
import ContentForm from './components/ContentForm'
import LandingPage from './components/LandingPage'
import DebugErrorBoundary from './components/DebugErrorBoundary'
import DebugPage from './components/DebugPage'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/authStore'
import { ContentItem, Plugin, contentService } from './services/api'
import './App.css'

function Header() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white shadow sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Headless CMS Platform
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Powered by modern API architecture
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {isAuthenticated && (
              <nav className="flex space-x-4">
                <Link
                  to="/"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Home
                </Link>
                <Link
                  to="/home"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  to="/content"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Content
                </Link>
                <Link
                  to="/plugins"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Plugins
                </Link>
                <Link
                  to="/api-status"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  API Status
                </Link>
                <Link
                  to="/debug"
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  🔍 Debug
                </Link>
              </nav>
            )}
            {isAuthenticated && (
              <div className="flex items-center space-x-4 border-l border-gray-300 pl-4">
                <span className="text-sm text-gray-600">
                  {user?.userId}
                </span>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Header />
        
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <DebugErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              } />
              <Route path="/content" element={
                <ProtectedRoute>
                  <ContentPage />
                </ProtectedRoute>
              } />
              <Route path="/plugins" element={
                <ProtectedRoute>
                  <PluginsPage />
                </ProtectedRoute>
              } />
              <Route path="/plugins/:id" element={
                <ProtectedRoute>
                  <PluginDetailPage />
                </ProtectedRoute>
              } />
              <Route path="/api-status" element={
                <ProtectedRoute>
                  <ApiStatusPage />
                </ProtectedRoute>
              } />
              <Route path="/debug" element={
                <ProtectedRoute>
                  <DebugPage />
                </ProtectedRoute>
              } />
            </Routes>
          </DebugErrorBoundary>
        </main>
      </div>
    </Router>
  )
}

function HomePage() {
  const { content, loading, error, refresh } = useContent()

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <LoadingSpinner text="Loading content from API..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <ErrorDisplay 
          title="Failed to load content"
          message={error}
          onRetry={refresh}
        />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Welcome Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your CMS
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Your headless content management system is live and serving content via API
        </p>
      </div>

      {/* Content Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">
            Published Content ({content.length})
          </h3>
          <button
            onClick={refresh}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {content.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No content available</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating your first content item.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.map((item) => (
              <ContentCard 
                key={item.id} 
                content={item}
                onClick={(content) => {
                  console.log('Content clicked:', content)
                  // TODO: Navigate to content detail page
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* API Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-blue-900 mb-2">
          Live API Connection
        </h4>
        <p className="text-blue-700 text-sm">
          This content is being fetched in real-time from: 
          <code className="ml-1 px-2 py-1 bg-blue-100 rounded text-xs">
            GET /api/v1/content
          </code>
        </p>
      </div>
    </div>
  )
}

function ContentPage() {
  const { content, contentTypes, loading, error, refresh } = useContent()
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateContent = async (contentData: Partial<ContentItem>, publishingOptions?: any) => {
    setIsSubmitting(true)
    try {
      if (publishingOptions && (publishingOptions.publishToLinkedIn || publishingOptions.publishToWordPress)) {
        // Use multi-channel publishing endpoint
        await contentService.createContentWithPublishing(contentData, publishingOptions)
      } else {
        // Use regular content creation
        await contentService.createContent(contentData)
      }
      setShowCreateForm(false)
      refresh() // Reload content list
    } catch (error) {
      console.error('Failed to create content:', error)
      alert('Failed to create content. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateContent = async (contentData: Partial<ContentItem>) => {
    if (!editingContent) return
    
    setIsSubmitting(true)
    try {
      await contentService.updateContent(editingContent.id, contentData)
      setEditingContent(null)
      setSelectedContent(null)
      refresh() // Reload content list
    } catch (error) {
      console.error('Failed to update content:', error)
      alert('Failed to update content. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteContent = async (id: number) => {
    if (!confirm('Are you sure you want to delete this content item?')) return
    
    try {
      await contentService.deleteContent(id)
      if (selectedContent?.id === id) {
        setSelectedContent(null)
      }
      refresh() // Reload content list
    } catch (error) {
      console.error('Failed to delete content:', error)
      alert('Failed to delete content. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <LoadingSpinner text="Loading content management..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <ErrorDisplay 
          title="Content Management Error"
          message={error}
          onRetry={refresh}
        />
      </div>
    )
  }

  if (showCreateForm) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Content</h2>
          <p className="text-gray-600">Add a new content item to your CMS</p>
        </div>
        
        <ContentForm
          onSubmit={handleCreateContent}
          onCancel={() => setShowCreateForm(false)}
          isLoading={isSubmitting}
        />
      </div>
    )
  }

  if (editingContent) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Edit Content</h2>
          <p className="text-gray-600">Update your content item</p>
        </div>
        
        <ContentForm
          onSubmit={handleUpdateContent}
          onCancel={() => setEditingContent(null)}
          initialData={editingContent}
          isLoading={isSubmitting}
        />
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Content Management</h2>
            <p className="text-gray-600">Manage and view all your content items</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Create New Content
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Content List */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">All Content ({content.length})</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {content.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No content items</h3>
                  <p className="mt-1 text-sm text-gray-500">Get started by creating your first content item.</p>
                  <div className="mt-6">
                    <button
                      onClick={() => setShowCreateForm(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Create Content
                    </button>
                  </div>
                </div>
              ) : (
                content.map((item) => (
                  <div 
                    key={item.id}
                    className={`px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                      selectedContent?.id === item.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedContent(item)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {typeof item.title === 'string' ? item.title : 'Untitled'}
                        </h4>
                        <p className="text-sm text-gray-500 mt-1">
                          /{typeof item.slug === 'string' ? item.slug : 'no-slug'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'published' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {typeof item.status === 'string' ? item.status : 'unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Content Detail */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Content Details</h3>
            </div>
            <div className="px-6 py-4">
              {selectedContent ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Title</label>
                    <p className="text-sm text-gray-900">
                      {typeof selectedContent.title === 'string' ? selectedContent.title : 'Untitled'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Slug</label>
                    <p className="text-sm text-gray-900">
                      /{typeof selectedContent.slug === 'string' ? selectedContent.slug : 'no-slug'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="text-sm text-gray-900">
                      {typeof selectedContent.status === 'string' ? selectedContent.status : 'unknown'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Content</label>
                    <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md max-h-32 overflow-y-auto">
                      {typeof selectedContent.content === 'string' 
                        ? selectedContent.content 
                        : typeof selectedContent.content === 'object' && selectedContent.content !== null
                          ? JSON.stringify(selectedContent.content, null, 2)
                          : 'No content available'
                      }
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedContent.created_at).toLocaleString()}
                    </p>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="pt-4 border-t border-gray-200 space-y-2">
                    <button
                      onClick={() => setEditingContent(selectedContent)}
                      className="w-full inline-flex justify-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Edit Content
                    </button>
                    <button
                      onClick={() => handleDeleteContent(selectedContent.id)}
                      className="w-full inline-flex justify-center px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Delete Content
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-8">
                  Select a content item to view details
                </p>
              )}
            </div>
          </div>

          {/* Content Types */}
          <div className="bg-white shadow rounded-lg mt-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Content Types</h3>
            </div>
            <div className="px-6 py-4">
              <div className="space-y-3">
                {Array.isArray(contentTypes) && contentTypes.length > 0 ? (
                  contentTypes.map((type) => (
                    <div key={type.id || Math.random()} className="border border-gray-200 rounded-md p-3">
                      <h4 className="text-sm font-medium text-gray-900">{type.name || 'Unnamed Type'}</h4>
                      <p className="text-xs text-gray-500">/{type.slug || 'no-slug'}</p>
                      <div className="mt-2">
                        <p className="text-xs text-gray-400">Fields: {type.fields?.length || (type.schema ? Object.keys(type.schema).length : 0)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 text-center py-4">
                    {Array.isArray(contentTypes) ? 'No content types found' : 'Loading content types...'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ApiStatusPage() {
  const { isHealthy, loading, checkHealth } = useApiHealth()
  const [count, setCount] = useState(0)

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Status</h2>
        <p className="text-gray-600">Monitor the health and connectivity of your CMS API</p>
      </div>

      {/* API Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {loading ? (
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                ) : (
                  <div className={`h-8 w-8 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-red-400'}`}>
                    {isHealthy ? (
                      <svg className="h-5 w-5 text-white m-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 text-white m-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">API Health</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {loading ? 'Checking...' : isHealthy ? 'Healthy' : 'Unhealthy'}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-6 py-3">
            <button
              onClick={checkHealth}
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              Check again →
            </button>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Frontend Status</dt>
                  <dd className="text-lg font-medium text-gray-900">Running</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">API Endpoints</h3>
          <p className="text-sm text-gray-500 mt-1">Complete CRUD API for content management</p>
        </div>
        <div className="divide-y divide-gray-200">
          {/* Content CRUD Operations */}
          <div className="px-6 py-3 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900">Content Management</h4>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                  GET
                </span>
                <code className="text-sm text-gray-900">/api/v1/content</code>
              </div>
              <span className="text-sm text-gray-500">Get all content items</span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                  GET
                </span>
                <code className="text-sm text-gray-900">/api/v1/content/:id</code>
              </div>
              <span className="text-sm text-gray-500">Get specific content item</span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-3">
                  POST
                </span>
                <code className="text-sm text-gray-900">/api/v1/content</code>
              </div>
              <span className="text-sm text-gray-500">Create new content item</span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mr-3">
                  PUT
                </span>
                <code className="text-sm text-gray-900">/api/v1/content/:id</code>
              </div>
              <span className="text-sm text-gray-500">Update existing content item</span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-3">
                  DELETE
                </span>
                <code className="text-sm text-gray-900">/api/v1/content/:id</code>
              </div>
              <span className="text-sm text-gray-500">Delete content item</span>
            </div>
          </div>
          
          {/* Content Types */}
          <div className="px-6 py-3 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900">Content Types</h4>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                  GET
                </span>
                <code className="text-sm text-gray-900">/api/v1/content-types</code>
              </div>
              <span className="text-sm text-gray-500">Get available content types</span>
            </div>
          </div>
          
          {/* Media */}
          <div className="px-6 py-3 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900">Media</h4>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                  GET
                </span>
                <code className="text-sm text-gray-900">/api/v1/media</code>
              </div>
              <span className="text-sm text-gray-500">Get media files</span>
            </div>
          </div>
          
          {/* System */}
          <div className="px-6 py-3 bg-gray-50">
            <h4 className="text-sm font-semibold text-gray-900">System</h4>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                  GET
                </span>
                <code className="text-sm text-gray-900">/health</code>
              </div>
              <span className="text-sm text-gray-500">API health check</span>
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-3">
                  GET
                </span>
                <code className="text-sm text-gray-900">/</code>
              </div>
              <span className="text-sm text-gray-500">API information and docs</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* API Usage Examples */}
      <div className="bg-white shadow rounded-lg mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">API Usage Examples</h3>
          <p className="text-sm text-gray-500 mt-1">Code examples for common operations</p>
        </div>
        <div className="px-6 py-4 space-y-6">
          {/* Create Content Example */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Create New Content</h4>
            <div className="bg-gray-900 rounded-md p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100">
                <code>{`curl -X POST http://localhost:5000/api/v1/content \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": {
      "title": "My New Article",
      "content": "Article content here...",
      "status": "published"
    }
  }'`}</code>
              </pre>
            </div>
          </div>

          {/* Update Content Example */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Update Existing Content</h4>
            <div className="bg-gray-900 rounded-md p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100">
                <code>{`curl -X PUT http://localhost:5000/api/v1/content/1 \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": {
      "title": "Updated Article Title",
      "content": "Updated content...",
      "status": "draft"
    }
  }'`}</code>
              </pre>
            </div>
          </div>

          {/* JavaScript Example */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">JavaScript/React Usage</h4>
            <div className="bg-gray-900 rounded-md p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100">
                <code>{`import { contentService } from './services/api'

// Create content
const newContent = await contentService.createContent({
  title: "My Article",
  content: "Content here...",
  status: "published"
})

// Update content
const updated = await contentService.updateContent(1, {
  title: "Updated Title"
})

// Delete content
await contentService.deleteContent(1)`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Development Tools */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Development Tools</h3>
        </div>
        <div className="px-6 py-4">
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">Development Counter:</p>
              <div className="space-x-2">
                <button
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  onClick={() => setCount(count + 1)}
                >
                  Count: {count}
                </button>
                <button
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                  onClick={() => setCount(0)}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PluginsPage() {
  const { plugins, loading, error, refresh, activatePlugin, deactivatePlugin, getPluginStats } = usePlugins()
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <LoadingSpinner text="Loading plugins..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <ErrorDisplay 
          title="Failed to load plugins"
          message={error}
          onRetry={refresh}
        />
      </div>
    )
  }

  const stats = getPluginStats()
  
  // Filter plugins
  const filteredPlugins = plugins.filter(plugin => {
    if (filterType !== 'all' && plugin.type !== filterType) return false
    if (filterStatus !== 'all' && plugin.status !== filterStatus) return false
    return true
  })

  const handlePluginAction = async (plugin: Plugin, action: 'activate' | 'deactivate') => {
    try {
      if (action === 'activate') {
        await activatePlugin(plugin.id)
      } else {
        await deactivatePlugin(plugin.id)
      }
      refresh() // Refresh to get updated data
    } catch (error) {
      console.error(`Failed to ${action} plugin:`, error)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Plugins</h2>
            <p className="text-gray-600">Manage integrations and extensions for your CMS</p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14-7l2 7-2 7H5l2-7-2-7h14z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Plugins</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.total}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-green-400"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.active}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-gray-400"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Inactive</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.inactive}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-6 w-6 rounded-full bg-red-400"></div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Errors</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.error}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-4">
          <div>
            <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              id="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Types</option>
              <option value="integration">Integration</option>
              <option value="authentication">Authentication</option>
              <option value="storage">Storage</option>
              <option value="workflow">Workflow</option>
              <option value="utility">Utility</option>
            </select>
          </div>

          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlugins.map((plugin) => (
          <div key={plugin.id} className="relative">
            <PluginCard 
              plugin={plugin}
              onClick={(plugin) => setSelectedPlugin(plugin)}
            />
            
            {/* Quick Actions */}
            <div className="absolute top-4 right-4 flex space-x-2">
              {plugin.status === 'active' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePluginAction(plugin, 'deactivate')
                  }}
                  className="inline-flex items-center px-2 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-red-50 hover:bg-red-100"
                >
                  Deactivate
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePluginAction(plugin, 'activate')
                  }}
                  className="inline-flex items-center px-2 py-1 border border-green-300 text-xs font-medium rounded text-green-700 bg-green-50 hover:bg-green-100"
                >
                  Activate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14-7l2 7-2 7H5l2-7-2-7h14z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No plugins found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your filters or check back later.</p>
        </div>
      )}

      {/* Plugin Detail Modal/Sidebar - Simple version for now */}
      {selectedPlugin && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedPlugin(null)}></div>
            
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {typeof selectedPlugin.name === 'string' ? selectedPlugin.name : 'Unnamed Plugin'}
                </h3>
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">
                    {typeof selectedPlugin.description === 'string' ? selectedPlugin.description : 'No description available'}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">Version:</span>
                    <p className="text-gray-900">
                      {typeof selectedPlugin.version === 'string' ? selectedPlugin.version : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Type:</span>
                    <p className="text-gray-900 capitalize">
                      {typeof selectedPlugin.type === 'string' ? selectedPlugin.type : 'unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Status:</span>
                    <p className="text-gray-900 capitalize">
                      {typeof selectedPlugin.status === 'string' ? selectedPlugin.status : 'unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Author:</span>
                    <p className="text-gray-900">{selectedPlugin.author || 'Unknown'}</p>
                  </div>
                </div>

                {selectedPlugin.features && selectedPlugin.features.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-500">Features:</span>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedPlugin.features.map((feature, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlugin.endpoints && selectedPlugin.endpoints.length > 0 && (
                  <div>
                    <span className="font-medium text-gray-500">API Endpoints:</span>
                    <div className="mt-2 space-y-2">
                      {selectedPlugin.endpoints.map((endpoint, index) => (
                        <div key={index} className="bg-gray-50 p-2 rounded text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800 mr-2">
                            {endpoint.method}
                          </span>
                          <code className="text-gray-700">{endpoint.path}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedPlugin(null)}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
                {selectedPlugin.config_url && (
                  <button className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                    Configure
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PluginDetailPage() {
  // This would be implemented for individual plugin detail pages
  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">Plugin Detail</h2>
      <p className="text-gray-600">Individual plugin detail page - coming soon!</p>
    </div>
  )
}

export default App