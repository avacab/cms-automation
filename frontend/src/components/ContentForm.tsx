import { useState } from 'react'
import { ContentItem } from '../services/api'
import AIWritingAssistant from './AIWritingAssistant'
import AIContentGenerator from './AIContentGenerator'
import ContentAdaptationPanel from './ContentAdaptationPanel'
import {
  SparklesIcon,
  DocumentTextIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline'

interface ContentFormProps {
  onSubmit: (content: Partial<ContentItem>, publishingOptions?: PublishingOptions) => Promise<void>
  onCancel: () => void
  initialData?: Partial<ContentItem>
  isLoading?: boolean
}

interface PublishingOptions {
  publishToWordPress: boolean
  publishToLinkedIn: boolean
  companyBranding: string
  scheduleOption?: string
  customDateTime?: string
}

export default function ContentForm({ onSubmit, onCancel, initialData, isLoading = false }: ContentFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    content: initialData?.content || '',
    status: initialData?.status || 'draft' as const
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Publishing options state
  const [publishingOptions, setPublishingOptions] = useState<PublishingOptions>({
    publishToWordPress: false,
    publishToLinkedIn: false,
    companyBranding: 'haidrun',
    scheduleOption: 'tomorrow_12pm',
    customDateTime: undefined
  })
  
  // AI Assistant states
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showContentAdaptation, setShowContentAdaptation] = useState(false)
  const [aiSuggestions, setAISuggestions] = useState<any[]>([])
  
  // Mock data for AI features (in production, these would come from API)
  const mockBrandVoices = [
    { id: 'professional', name: 'Professional Voice', tone: ['professional', 'authoritative'] },
    { id: 'friendly', name: 'Friendly Voice', tone: ['friendly', 'conversational'] }
  ]
  
  const mockTemplates = [
    { id: 'blog-post', name: 'Blog Post', type: 'blog-post', description: 'Standard blog post structure' },
    { id: 'product-desc', name: 'Product Description', type: 'product-description', description: 'E-commerce product description' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required'
    }

    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      try {
        await onSubmit(formData, publishingOptions)
      } catch (error) {
        console.error('Form submission error:', error)
      }
    }
  }

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      // Auto-generate slug if it's empty or matches the previous auto-generated slug
      slug: !prev.slug || prev.slug === generateSlug(prev.title) ? generateSlug(title) : prev.slug
    }))
  }
  
  const handleContentChange = (content: string) => {
    setFormData(prev => ({ ...prev, content }))
  }
  
  const handleAISuggestionsChange = (suggestions: any[]) => {
    setAISuggestions(suggestions)
  }
  
  const handleContentGenerated = (content: string) => {
    setFormData(prev => ({ ...prev, content }))
    setShowAIGenerator(false)
  }

  return (
    <div className="space-y-6">
      {/* AI Tools Panel */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
          <SparklesIcon className="w-4 h-4 mr-2 text-purple-600" />
          AI Writing Tools
        </h3>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAIGenerator(!showAIGenerator)}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showAIGenerator 
                ? 'bg-purple-600 text-white' 
                : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'
            }`}
            type="button"
          >
            <DocumentTextIcon className="w-4 h-4 mr-2" />
            Content Generator
            {showAIGenerator ? <ChevronUpIcon className="w-4 h-4 ml-2" /> : <ChevronDownIcon className="w-4 h-4 ml-2" />}
          </button>
          
          <button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showAIAssistant 
                ? 'bg-purple-600 text-white' 
                : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'
            }`}
            type="button"
          >
            <SparklesIcon className="w-4 h-4 mr-2" />
            Writing Assistant
            {aiSuggestions.length > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {aiSuggestions.length}
              </span>
            )}
            {showAIAssistant ? <ChevronUpIcon className="w-4 h-4 ml-2" /> : <ChevronDownIcon className="w-4 h-4 ml-2" />}
          </button>
          
          <button
            onClick={() => setShowContentAdaptation(!showContentAdaptation)}
            className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              showContentAdaptation 
                ? 'bg-purple-600 text-white' 
                : 'bg-white text-purple-600 hover:bg-purple-50 border border-purple-200'
            }`}
            type="button"
            disabled={!formData.content.trim()}
          >
            <ArrowsRightLeftIcon className="w-4 h-4 mr-2" />
            Content Adaptation
            {showContentAdaptation ? <ChevronUpIcon className="w-4 h-4 ml-2" /> : <ChevronDownIcon className="w-4 h-4 ml-2" />}
          </button>
        </div>
      </div>

      {/* AI Content Generator */}
      {showAIGenerator && (
        <AIContentGenerator
          initialContent={formData.content}
          onContentGenerated={handleContentGenerated}
          availableTemplates={mockTemplates}
          availableBrandVoices={mockBrandVoices}
        />
      )}

      {/* Multi-Channel Publishing Options */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
          <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
          </svg>
          Multi-Channel Publishing
        </h3>
        
        <div className="space-y-4">
          {/* Company Branding Selection */}
          <div>
            <label htmlFor="companyBranding" className="block text-sm font-medium text-gray-700 mb-1">
              Company Brand
            </label>
            <select
              id="companyBranding"
              value={publishingOptions.companyBranding}
              onChange={(e) => setPublishingOptions(prev => ({ ...prev, companyBranding: e.target.value }))}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              disabled={isLoading}
            >
              <option value="haidrun">Haidrun</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          {/* Publishing Destinations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Publish To
            </label>
            <div className="space-y-2">
              {/* WordPress Publishing */}
              <div className="flex items-center">
                <input
                  id="publishToWordPress"
                  type="checkbox"
                  checked={publishingOptions.publishToWordPress}
                  onChange={(e) => setPublishingOptions(prev => ({ ...prev, publishToWordPress: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <label htmlFor="publishToWordPress" className="ml-2 block text-sm text-gray-900 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.109m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.135-2.85-.135-.582-.031-.661.854-.078.899 0 0 .541.075 1.116.105l1.659 4.537-2.329 6.99-3.877-11.527c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-.202 0-.438-.008-.69-.015C4.911 2.015 8.235 0 12.017 0c2.266 0 4.33.868 5.877 2.284-.037-.002-.074-.005-.11-.005-.633 0-1.082.558-1.082 1.156 0 .538.312.992.645 1.526.251.434.542 1.003.542 1.82 0 .565-.22 1.227-.808 2.415l-1.06 3.566-3.841-11.527c.645-.031 1.231-.106 1.231-.106.583-.075.515-.93-.066-.899 0 0-1.755.135-2.88.135M12.017 24c-.543 0-1.074-.056-1.593-.139L13.1 14.6l3.014 8.26c.02.048.041.094.062.139A11.968 11.968 0 0112.017 24"/>
                  </svg>
                  Haidrun Website (WordPress)
                </label>
              </div>

              {/* LinkedIn Publishing */}
              <div className="flex items-center">
                <input
                  id="publishToLinkedIn"
                  type="checkbox"
                  checked={publishingOptions.publishToLinkedIn}
                  onChange={(e) => setPublishingOptions(prev => ({ ...prev, publishToLinkedIn: e.target.checked }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  disabled={isLoading}
                />
                <label htmlFor="publishToLinkedIn" className="ml-2 block text-sm text-gray-900 flex items-center">
                  <svg className="w-4 h-4 mr-1 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn Company Page
                </label>
              </div>
            </div>
          </div>

          {/* Scheduling Options (only show for LinkedIn) */}
          {publishingOptions.publishToLinkedIn && (
            <div>
              <label htmlFor="scheduleOption" className="block text-sm font-medium text-gray-700 mb-1">
                Publishing Schedule
              </label>
              <select
                id="scheduleOption"
                value={publishingOptions.scheduleOption}
                onChange={(e) => setPublishingOptions(prev => ({ ...prev, scheduleOption: e.target.value, customDateTime: undefined }))}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={isLoading}
              >
                <option value="immediate">Publish immediately</option>
                <option value="tomorrow_9am">Tomorrow at 9 AM UTC</option>
                <option value="tomorrow_12pm">Tomorrow at 12 PM UTC (recommended)</option>
                <option value="tomorrow_5pm">Tomorrow at 5 PM UTC</option>
                <option value="custom">Custom date/time</option>
              </select>

              {/* Custom Date/Time Picker */}
              {publishingOptions.scheduleOption === 'custom' && (
                <div className="mt-2">
                  <label htmlFor="customDateTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Custom Date & Time (UTC)
                  </label>
                  <input
                    type="datetime-local"
                    id="customDateTime"
                    value={publishingOptions.customDateTime || ''}
                    onChange={(e) => setPublishingOptions(prev => ({ ...prev, customDateTime: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    disabled={isLoading}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select a future date and time in UTC timezone
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Publishing Info */}
          {(publishingOptions.publishToWordPress || publishingOptions.publishToLinkedIn) && (
            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-blue-700">
                    {publishingOptions.publishToWordPress && publishingOptions.publishToLinkedIn 
                      ? "Content will be published to both Haidrun website and LinkedIn company page with optimized formatting for each platform."
                      : publishingOptions.publishToWordPress 
                      ? "Content will be published to the Haidrun website."
                      : "Content will be posted to LinkedIn company page with professional formatting and optimal timing."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Form */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {initialData ? 'Edit Content' : 'Create New Content'}
          </h3>
        </div>
      
      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
        {/* Title Field */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
              errors.title ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter content title"
            disabled={isLoading}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          )}
        </div>

        {/* Slug Field */}
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
            Slug
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
              /
            </span>
            <input
              type="text"
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="mt-1 flex-1 block w-full px-3 py-2 border border-gray-300 rounded-none rounded-r-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="auto-generated-from-title"
              disabled={isLoading}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to auto-generate from title
          </p>
        </div>

        {/* Status Field */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'published' | 'draft' }))}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            disabled={isLoading}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>

        {/* Content Field with AI Assistant */}
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
            Content *
          </label>
          <div className="relative">
            <textarea
              id="content"
              rows={12}
              value={formData.content}
              onChange={(e) => handleContentChange(e.target.value)}
              className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
                errors.content ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Enter your content here or use AI tools to generate content..."
              disabled={isLoading}
            />
            {aiSuggestions.length > 0 && (
              <div className="absolute top-2 right-2">
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                  {aiSuggestions.length} suggestions
                </span>
              </div>
            )}
          </div>
          {errors.content && (
            <p className="mt-1 text-sm text-red-600">{errors.content}</p>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {initialData ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              initialData ? 'Update Content' : 'Create Content'
            )}
          </button>
        </div>
      </form>
      
      {/* AI Writing Assistant Sidebar */}
      {showAIAssistant && formData.content && (
        <div className="border-t pt-4">
          <AIWritingAssistant
            content={formData.content}
            onContentChange={handleContentChange}
            onSuggestionsChange={handleAISuggestionsChange}
            brandVoiceId="professional" // This would be selected by the user
          />
        </div>
      )}
    </div>

    {/* Content Adaptation Panel */}
    {showContentAdaptation && formData.content && (
      <ContentAdaptationPanel
        originalContent={formData.content}
        brandVoiceId="professional" // This would be selected by the user
      />
    )}
  </div>
  )
}