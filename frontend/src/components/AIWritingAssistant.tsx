import React, { useState, useEffect, useRef } from 'react';
import { 
  SparklesIcon, 
  LightBulbIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface WritingSuggestion {
  id: string;
  type: 'grammar' | 'style' | 'tone' | 'clarity' | 'engagement' | 'seo' | 'brand-voice';
  severity: 'low' | 'medium' | 'high';
  position: { start: number; end: number };
  original: string;
  suggestion: string;
  reason: string;
  confidence: number;
}

interface BrandVoice {
  id: string;
  name: string;
  tone: string[];
  writingStyle: {
    formality: 'formal' | 'casual' | 'conversational';
    complexity: 'simple' | 'moderate' | 'complex';
  };
}

interface Template {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface AIWritingAssistantProps {
  content: string;
  onContentChange: (content: string) => void;
  onSuggestionsChange?: (suggestions: WritingSuggestion[]) => void;
  brandVoiceId?: string;
  templateId?: string;
  className?: string;
}

const AIWritingAssistant: React.FC<AIWritingAssistantProps> = ({
  content,
  onContentChange,
  onSuggestionsChange,
  brandVoiceId,
  templateId,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [selectedSuggestionTypes, setSelectedSuggestionTypes] = useState({
    grammar: true,
    style: true,
    seo: true,
    engagement: true,
    'brand-voice': true
  });
  
  const debounceTimer = useRef<NodeJS.Timeout>();

  // Debounced analysis
  useEffect(() => {
    if (!content || content.length < 10) {
      setSuggestions([]);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      analyzContent(content);
    }, 1000); // 1 second debounce

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [content, brandVoiceId, selectedSuggestionTypes]);

  const analyzContent = async (text: string) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('http://localhost:5000/api/v1/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text,
          brandVoiceId,
          options: selectedSuggestionTypes
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.data.suggestions || []);
        onSuggestionsChange?.(data.data.suggestions || []);
      }
    } catch (error) {
      console.error('Error analyzing content:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applySuggestion = (suggestion: WritingSuggestion) => {
    const beforeText = content.substring(0, suggestion.position.start);
    const afterText = content.substring(suggestion.position.end);
    const newContent = beforeText + suggestion.suggestion + afterText;
    
    onContentChange(newContent);
    
    // Remove the applied suggestion
    setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  };

  const dismissSuggestion = (suggestionId: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high': return ExclamationTriangleIcon;
      case 'medium': return InformationCircleIcon;
      default: return LightBulbIcon;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'grammar': return CheckCircleIcon;
      case 'seo': return SparklesIcon;
      default: return LightBulbIcon;
    }
  };

  const filteredSuggestions = suggestions.filter(s => 
    selectedSuggestionTypes[s.type as keyof typeof selectedSuggestionTypes]
  );

  return (
    <div className={`ai-writing-assistant ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-gray-900">AI Writing Assistant</span>
          {isAnalyzing && (
            <ArrowPathIcon className="w-4 h-4 text-purple-600 animate-spin" />
          )}
        </div>
        
        <button
          onClick={() => setShowSuggestions(!showSuggestions)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          {showSuggestions ? 'Hide' : 'Show'} Suggestions ({filteredSuggestions.length})
        </button>
      </div>

      {showSuggestions && (
        <div className="space-y-4">
          {/* Filter Controls */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-xs font-medium text-gray-700 mb-2">Suggestion Types:</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(selectedSuggestionTypes).map(([type, enabled]) => (
                <label key={type} className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setSelectedSuggestionTypes(prev => ({
                      ...prev,
                      [type]: e.target.checked
                    }))}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="ml-1 text-xs text-gray-600 capitalize">
                    {type.replace('-', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Suggestions List */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {content.length < 10 
                    ? 'Start writing to get AI suggestions...' 
                    : isAnalyzing 
                      ? 'Analyzing your content...'
                      : 'Great! No issues found in your content.'
                  }
                </p>
              </div>
            ) : (
              filteredSuggestions.map((suggestion) => {
                const SeverityIcon = getSeverityIcon(suggestion.severity);
                const TypeIcon = getTypeIcon(suggestion.type);
                
                return (
                  <div
                    key={suggestion.id}
                    className={`p-3 rounded-lg border ${getSeverityColor(suggestion.severity)}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <SeverityIcon className="w-4 h-4" />
                        <TypeIcon className="w-4 h-4" />
                        <span className="text-xs font-medium capitalize">
                          {suggestion.type.replace('-', ' ')}
                        </span>
                        <span className="text-xs opacity-75">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </span>
                      </div>
                      
                      <button
                        onClick={() => dismissSuggestion(suggestion.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm mb-2">
                        {typeof suggestion.reason === 'string' ? suggestion.reason : 'No reason provided'}
                      </p>
                      <div className="bg-white bg-opacity-50 p-2 rounded text-xs">
                        <div className="mb-1">
                          <span className="font-medium">Original:</span> "
                          {typeof suggestion.original === 'string' ? suggestion.original : 'N/A'}
                          "
                        </div>
                        <div>
                          <span className="font-medium">Suggested:</span> "
                          {typeof suggestion.suggestion === 'string' ? suggestion.suggestion : 'N/A'}
                          "
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      className="w-full bg-white bg-opacity-75 hover:bg-opacity-100 text-sm py-2 px-3 rounded transition-colors"
                    >
                      Apply Suggestion
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIWritingAssistant;