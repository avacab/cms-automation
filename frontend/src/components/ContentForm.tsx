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
  onSubmit: (content: Partial<ContentItem>) => Promise<void>
  onCancel: () => void
  initialData?: Partial<ContentItem>
  isLoading?: boolean
}

export default function ContentForm({ onSubmit, onCancel, initialData, isLoading = false }: ContentFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    slug: initialData?.slug || '',
    content: initialData?.content || '',
    status: initialData?.status || 'draft' as const
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  
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
        await onSubmit(formData)
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