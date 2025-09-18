import React, { useState, useEffect } from 'react';
import {
  ArrowsRightLeftIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ShareIcon,
  DocumentDuplicateIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

interface AdaptationFormat {
  format: string;
  description: string;
  constraints: {
    maxLength?: number;
    tone?: string;
    includeHashtags?: boolean;
    includeEmojis?: boolean;
  };
}

interface ContentAdaptation {
  format: string;
  platform?: string;
  text: string;
  metadata: {
    length: number;
    tone: string;
    confidence: number;
  };
}

interface ContentAdaptationPanelProps {
  originalContent: string;
  onAdaptationComplete?: (adaptations: ContentAdaptation[]) => void;
  brandVoiceId?: string;
  className?: string;
}

const ContentAdaptationPanel: React.FC<ContentAdaptationPanelProps> = ({
  originalContent,
  onAdaptationComplete,
  brandVoiceId,
  className = ''
}) => {
  const [availableFormats, setAvailableFormats] = useState<AdaptationFormat[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [isAdapting, setIsAdapting] = useState(false);
  const [adaptations, setAdaptations] = useState<ContentAdaptation[]>([]);
  const [showCustomConstraints, setShowCustomConstraints] = useState<Record<string, boolean>>({});
  const [customConstraints, setCustomConstraints] = useState<Record<string, any>>({});

  // Fetch available formats on component mount
  useEffect(() => {
    fetchAvailableFormats();
  }, []);

  const fetchAvailableFormats = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/adapt/formats`);
      if (response.ok) {
        const data = await response.json();
        setAvailableFormats(data.data.formats || []);
      }
    } catch (error) {
      console.error('Error fetching formats:', error);
    }
  };

  const toggleFormat = (format: string) => {
    setSelectedFormats(prev => 
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const toggleCustomConstraints = (format: string) => {
    setShowCustomConstraints(prev => ({
      ...prev,
      [format]: !prev[format]
    }));
  };

  const updateCustomConstraint = (format: string, key: string, value: any) => {
    setCustomConstraints(prev => ({
      ...prev,
      [format]: {
        ...prev[format],
        [key]: value
      }
    }));
  };

  const adaptContent = async () => {
    if (selectedFormats.length === 0) {
      alert('Please select at least one format for adaptation');
      return;
    }

    if (!originalContent.trim()) {
      alert('Please provide content to adapt');
      return;
    }

    setIsAdapting(true);
    try {
      const targetFormats = selectedFormats.map(format => ({
        format,
        constraints: customConstraints[format] || {}
      }));

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_BASE_URL}/api/v1/ai/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: originalContent,
          targetFormats,
          brandVoiceId
        })
      });

      if (response.ok) {
        const data = await response.json();
        const results = data.data.adaptations || [];
        setAdaptations(results);
        onAdaptationComplete?.(results);
      } else {
        throw new Error('Failed to adapt content');
      }
    } catch (error) {
      console.error('Error adapting content:', error);
      alert('Failed to adapt content. Please try again.');
    } finally {
      setIsAdapting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const getFormatIcon = (format: string) => {
    const iconMap: Record<string, string> = {
      'twitter': '🐦',
      'linkedin': '💼',
      'facebook': '📘',
      'instagram': '📸',
      'email-subject': '📧',
      'email-preview': '👁️',
      'meta-description': '🔍',
      'blog-excerpt': '📝',
      'press-release': '📰',
      'product-tagline': '🏷️'
    };
    return iconMap[format] || '📄';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConstraintDisplay = (format: AdaptationFormat) => {
    const constraints = [];
    if (format.constraints.maxLength) {
      constraints.push(`${format.constraints.maxLength} chars max`);
    }
    if (format.constraints.tone) {
      constraints.push(`${format.constraints.tone} tone`);
    }
    if (format.constraints.includeHashtags) {
      constraints.push('hashtags');
    }
    if (format.constraints.includeEmojis) {
      constraints.push('emojis');
    }
    return constraints.join(', ');
  };

  return (
    <div className={`content-adaptation-panel bg-white border border-gray-200 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <ArrowsRightLeftIcon className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Content Adaptation</h3>
        </div>
        
        <div className="text-sm text-gray-500">
          {originalContent.length} characters to adapt
        </div>
      </div>

      {/* Original Content Preview */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Original Content
        </label>
        <div className="bg-gray-50 p-3 rounded-lg border max-h-32 overflow-y-auto">
          <p className="text-sm text-gray-800 line-clamp-4">
            {originalContent || 'No content provided for adaptation'}
          </p>
        </div>
      </div>

      {/* Format Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Adaptation Formats
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {availableFormats.map(format => (
            <div key={format.format} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-start justify-between">
                <label className="flex items-start space-x-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(format.format)}
                    onChange={() => toggleFormat(format.format)}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getFormatIcon(format.format)}</span>
                      <span className="font-medium text-gray-900 capitalize">
                        {format.format.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {format.description}
                    </p>
                    {getConstraintDisplay(format) && (
                      <p className="text-xs text-blue-600 mt-1">
                        {getConstraintDisplay(format)}
                      </p>
                    )}
                  </div>
                </label>
                
                {selectedFormats.includes(format.format) && (
                  <button
                    onClick={() => toggleCustomConstraints(format.format)}
                    className="text-xs text-gray-500 hover:text-gray-700 ml-2"
                  >
                    {showCustomConstraints[format.format] ? 'Hide' : 'Custom'}
                  </button>
                )}
              </div>

              {/* Custom Constraints */}
              {selectedFormats.includes(format.format) && showCustomConstraints[format.format] && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600">Max Length (override)</label>
                    <input
                      type="number"
                      placeholder={format.constraints.maxLength?.toString()}
                      value={customConstraints[format.format]?.maxLength || ''}
                      onChange={(e) => updateCustomConstraint(format.format, 'maxLength', parseInt(e.target.value) || undefined)}
                      className="w-full mt-1 px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={customConstraints[format.format]?.includeHashtags ?? format.constraints.includeHashtags}
                        onChange={(e) => updateCustomConstraint(format.format, 'includeHashtags', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs text-gray-600">Hashtags</span>
                    </label>
                    
                    <label className="flex items-center space-x-1">
                      <input
                        type="checkbox"
                        checked={customConstraints[format.format]?.includeEmojis ?? format.constraints.includeEmojis}
                        onChange={(e) => updateCustomConstraint(format.format, 'includeEmojis', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-xs text-gray-600">Emojis</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Adapt Button */}
      <button
        onClick={adaptContent}
        disabled={isAdapting || selectedFormats.length === 0 || !originalContent.trim()}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mb-6"
      >
        {isAdapting ? (
          <SparklesIcon className="w-5 h-5 animate-pulse" />
        ) : (
          <ArrowsRightLeftIcon className="w-5 h-5" />
        )}
        <span>
          {isAdapting ? 'Adapting Content...' : `Adapt to ${selectedFormats.length} Format${selectedFormats.length !== 1 ? 's' : ''}`}
        </span>
      </button>

      {/* Results */}
      {adaptations.length > 0 && (
        <div className="border-t pt-6">
          <div className="flex items-center space-x-2 mb-4">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <h4 className="font-medium text-gray-900">Adapted Content</h4>
            <span className="text-sm text-gray-500">({adaptations.length} versions)</span>
          </div>
          
          <div className="space-y-4">
            {adaptations.map((adaptation, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getFormatIcon(adaptation.format)}</span>
                    <span className="font-medium capitalize">
                      {adaptation.format.replace('-', ' ')}
                      {adaptation.platform && ` (${adaptation.platform})`}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-medium ${getConfidenceColor(adaptation.metadata.confidence)}`}>
                      {Math.round(adaptation.metadata.confidence * 100)}% confidence
                    </span>
                    
                    <button
                      onClick={() => copyToClipboard(adaptation.text)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-3 rounded text-sm text-gray-800 mb-3">
                  {adaptation.text}
                </div>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span>{adaptation.metadata.length} characters</span>
                    <span>Tone: {adaptation.metadata.tone}</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => copyToClipboard(adaptation.text)}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800"
                    >
                      <DocumentDuplicateIcon className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    
                    <button className="flex items-center space-x-1 text-green-600 hover:text-green-800">
                      <ShareIcon className="w-3 h-3" />
                      <span>Use</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentAdaptationPanel;