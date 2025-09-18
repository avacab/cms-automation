import React, { useState, useEffect, useRef } from 'react';
import { 
  BeakerIcon,
  ChartBarIcon,
  UserGroupIcon,
  SparklesIcon,
  PlayIcon,
  PauseIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import AIWritingAssistant from './AIWritingAssistant';

interface BlogVariation {
  id: string;
  name: string;
  title: string;
  content: string;
  excerpt: string;
  trafficAllocation: number;
  isControl?: boolean;
}

interface ExperimentMetric {
  name: string;
  type: 'conversion' | 'revenue' | 'engagement';
  eventName: string;
  goalValue?: number;
}

interface ExperimentConfig {
  name: string;
  description?: string;
  baseContentId?: number;
  variations: BlogVariation[];
  metrics: ExperimentMetric[];
  audienceConditions?: any[];
  trafficAllocation: number;
  startDate?: Date;
  endDate?: Date;
}

interface OptimizelyBlogEditorProps {
  initialContent?: {
    title: string;
    content: string;
    excerpt: string;
  };
  onSave?: (content: any) => void;
  onPublish?: (content: any, experiment?: ExperimentConfig) => void;
  onCreateExperiment?: (config: ExperimentConfig) => void;
  brandVoiceId?: string;
  className?: string;
}

const OptimizelyBlogEditor: React.FC<OptimizelyBlogEditorProps> = ({
  initialContent,
  onSave,
  onPublish,
  onCreateExperiment,
  brandVoiceId,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'experiment' | 'results'>('editor');
  const [variations, setVariations] = useState<BlogVariation[]>([]);
  const [activeVariation, setActiveVariation] = useState<string>('');
  const [experimentConfig, setExperimentConfig] = useState<ExperimentConfig>({
    name: '',
    description: '',
    variations: [],
    metrics: [],
    trafficAllocation: 100
  });
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [experimentResults, setExperimentResults] = useState<any>(null);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Initialize with control variation
  useEffect(() => {
    if (initialContent && variations.length === 0) {
      const controlVariation: BlogVariation = {
        id: 'control',
        name: 'Control (Original)',
        title: initialContent.title,
        content: initialContent.content,
        excerpt: initialContent.excerpt,
        trafficAllocation: 100,
        isControl: true
      };
      
      setVariations([controlVariation]);
      setActiveVariation('control');
      setExperimentConfig(prev => ({
        ...prev,
        variations: [controlVariation]
      }));
    }
  }, [initialContent, variations.length]);

  const handleContentChange = (field: 'title' | 'content' | 'excerpt', value: string) => {
    setVariations(prev => prev.map(variation => 
      variation.id === activeVariation 
        ? { ...variation, [field]: value }
        : variation
    ));
  };

  const generateVariations = async (count: number = 2, strategy: string = 'audience') => {
    setIsGeneratingVariations(true);
    
    try {
      const baseVariation = variations.find(v => v.isControl);
      if (!baseVariation) return;

      const response = await fetch('/api/optimizely/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseContent: {
            title: baseVariation.title,
            content: baseVariation.content,
            excerpt: baseVariation.excerpt
          },
          variationCount: count,
          strategy: strategy, // 'audience', 'tone', 'structure', 'cta'
          brandVoiceId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newVariations = data.variations.map((variation: any, index: number) => ({
          id: `variation_${index + 1}`,
          name: `Variation ${String.fromCharCode(65 + index)}`,
          title: variation.title,
          content: variation.content,
          excerpt: variation.excerpt,
          trafficAllocation: Math.floor(100 / (count + 1)),
          isControl: false
        }));

        // Update traffic allocation for control
        const updatedControl = { 
          ...baseVariation, 
          trafficAllocation: 100 - (newVariations.length * Math.floor(100 / (count + 1)))
        };

        const allVariations = [updatedControl, ...newVariations];
        setVariations(allVariations);
        setExperimentConfig(prev => ({
          ...prev,
          variations: allVariations
        }));
      }
    } catch (error) {
      console.error('Error generating variations:', error);
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  const updateTrafficAllocation = (variationId: string, allocation: number) => {
    const updatedVariations = variations.map(v => 
      v.id === variationId ? { ...v, trafficAllocation: allocation } : v
    );
    
    // Ensure allocations sum to 100%
    const totalAllocation = updatedVariations.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (totalAllocation !== 100) {
      // Adjust other variations proportionally
      const difference = 100 - totalAllocation;
      const otherVariations = updatedVariations.filter(v => v.id !== variationId);
      if (otherVariations.length > 0) {
        const adjustmentPerVariation = difference / otherVariations.length;
        updatedVariations.forEach(v => {
          if (v.id !== variationId) {
            v.trafficAllocation = Math.max(0, v.trafficAllocation + adjustmentPerVariation);
          }
        });
      }
    }
    
    setVariations(updatedVariations);
    setExperimentConfig(prev => ({ ...prev, variations: updatedVariations }));
  };

  const addMetric = () => {
    const newMetric: ExperimentMetric = {
      name: '',
      type: 'conversion',
      eventName: ''
    };
    setExperimentConfig(prev => ({
      ...prev,
      metrics: [...prev.metrics, newMetric]
    }));
  };

  const updateMetric = (index: number, field: keyof ExperimentMetric, value: any) => {
    setExperimentConfig(prev => ({
      ...prev,
      metrics: prev.metrics.map((metric, i) => 
        i === index ? { ...metric, [field]: value } : metric
      )
    }));
  };

  const removeMetric = (index: number) => {
    setExperimentConfig(prev => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index)
    }));
  };

  const createExperiment = async () => {
    if (!experimentConfig.name) {
      alert('Please enter an experiment name');
      return;
    }

    const config = {
      ...experimentConfig,
      variations: variations
    };

    try {
      onCreateExperiment?.(config);
    } catch (error) {
      console.error('Error creating experiment:', error);
    }
  };

  const publishContent = () => {
    const activeVariationData = variations.find(v => v.id === activeVariation);
    if (!activeVariationData) return;

    const publishData = {
      title: activeVariationData.title,
      content: activeVariationData.content,
      excerpt: activeVariationData.excerpt,
      variations: variations.length > 1 ? variations : undefined
    };

    onPublish?.(publishData, variations.length > 1 ? experimentConfig : undefined);
  };

  const currentVariation = variations.find(v => v.id === activeVariation);

  return (
    <div className={`optimizely-blog-editor ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <BeakerIcon className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Optimizely Blog Editor</h2>
            {variations.length > 1 && (
              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">
                {variations.length} Variations
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSave?.(currentVariation)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Save Draft
            </button>
            <button
              onClick={publishContent}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700"
            >
              {variations.length > 1 ? 'Publish Experiment' : 'Publish'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'editor'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Content Editor
          </button>
          <button
            onClick={() => setActiveTab('experiment')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'experiment'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            A/B Testing
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'results'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            disabled={!experimentResults}
          >
            Results
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'editor' && (
          <div className="flex flex-1">
            {/* Variation Selector */}
            {variations.length > 1 && (
              <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Variations</h3>
                  <div className="space-y-2">
                    {variations.map((variation) => (
                      <button
                        key={variation.id}
                        onClick={() => setActiveVariation(variation.id)}
                        className={`w-full text-left p-3 rounded-lg border ${
                          activeVariation === variation.id
                            ? 'border-purple-200 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {variation.name}
                          </span>
                          {variation.isControl && (
                            <CheckCircleIcon className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <div className="text-xs text-gray-500">
                          {variation.trafficAllocation}% traffic
                        </div>
                        <div className="text-xs text-gray-600 mt-1 truncate">
                          {variation.title}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Editor */}
            <div className="flex-1 flex flex-col">
              <div className="flex-1 p-6">
                {currentVariation && (
                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                      </label>
                      <input
                        type="text"
                        value={currentVariation.title}
                        onChange={(e) => handleContentChange('title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Enter blog post title..."
                      />
                    </div>

                    {/* Excerpt */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Excerpt
                      </label>
                      <textarea
                        value={currentVariation.excerpt}
                        onChange={(e) => handleContentChange('excerpt', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Brief description of the blog post..."
                      />
                    </div>

                    {/* Content */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content
                      </label>
                      <textarea
                        value={currentVariation.content}
                        onChange={(e) => handleContentChange('content', e.target.value)}
                        rows={20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                        placeholder="Write your blog post content..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* AI Writing Assistant */}
              <div className="border-t border-gray-200">
                <AIWritingAssistant
                  content={currentVariation?.content || ''}
                  onContentChange={(content) => handleContentChange('content', content)}
                  brandVoiceId={brandVoiceId}
                  className="p-4"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'experiment' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Experiment Setup */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Experiment Configuration</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Experiment Name
                      </label>
                      <input
                        type="text"
                        value={experimentConfig.name}
                        onChange={(e) => setExperimentConfig(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        placeholder="e.g., Holiday Shopping Tips A/B Test"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Traffic Allocation
                      </label>
                      <select
                        value={experimentConfig.trafficAllocation}
                        onChange={(e) => setExperimentConfig(prev => ({ ...prev, trafficAllocation: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value={25}>25% of traffic</option>
                        <option value={50}>50% of traffic</option>
                        <option value={75}>75% of traffic</option>
                        <option value={100}>100% of traffic</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={experimentConfig.description}
                      onChange={(e) => setExperimentConfig(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Describe the experiment goals and hypothesis..."
                    />
                  </div>
                </div>
              </div>

              {/* Variation Generation */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Content Variations</h3>
                  <button
                    onClick={() => generateVariations(2, 'audience')}
                    disabled={isGeneratingVariations}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    <span>{isGeneratingVariations ? 'Generating...' : 'Generate AI Variations'}</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {variations.map((variation, index) => (
                    <div key={variation.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-medium text-gray-900">
                            {variation.name}
                          </span>
                          {variation.isControl && (
                            <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                              Control
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600">Traffic:</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={variation.trafficAllocation}
                            onChange={(e) => updateTrafficAllocation(variation.id, parseInt(e.target.value) || 0)}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-600">%</span>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Title:</strong> {typeof variation.title === 'string' ? variation.title : 'Untitled'}
                      </div>
                      <div className="text-sm text-gray-600">
                        <strong>Excerpt:</strong> {typeof variation.excerpt === 'string' ? variation.excerpt : 'No excerpt'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Success Metrics */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Success Metrics</h3>
                  <button
                    onClick={addMetric}
                    className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100"
                  >
                    Add Metric
                  </button>
                </div>

                <div className="space-y-4">
                  {experimentConfig.metrics.map((metric, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
                      <input
                        type="text"
                        value={metric.name}
                        onChange={(e) => updateMetric(index, 'name', e.target.value)}
                        placeholder="Metric name"
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      />
                      <select
                        value={metric.type}
                        onChange={(e) => updateMetric(index, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="conversion">Conversion</option>
                        <option value="revenue">Revenue</option>
                        <option value="engagement">Engagement</option>
                      </select>
                      <input
                        type="text"
                        value={metric.eventName}
                        onChange={(e) => updateMetric(index, 'eventName', e.target.value)}
                        placeholder="Event name"
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                      />
                      <button
                        onClick={() => removeMetric(index)}
                        className="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create Experiment Button */}
              <div className="flex justify-center">
                <button
                  onClick={createExperiment}
                  className="flex items-center space-x-2 px-6 py-3 text-base font-medium text-white bg-purple-600 border border-transparent rounded-lg hover:bg-purple-700"
                >
                  <PlayIcon className="w-5 h-5" />
                  <span>Create & Start Experiment</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'results' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="text-center py-12">
                <ChartBarIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Experiment Results Yet</h3>
                <p className="text-gray-600">
                  Start an experiment to see performance metrics and statistical analysis here.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OptimizelyBlogEditor;