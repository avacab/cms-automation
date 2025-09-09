import React, { useState } from 'react';
import {
  SparklesIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  LightBulbIcon,
  PencilIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';

interface GenerationOptions {
  type: 'complete' | 'continue' | 'rewrite' | 'improve' | 'adapt';
  brandVoiceId?: string;
  templateId?: string;
  maxTokens?: number;
  temperature?: number;
  targetLength?: number;
  targetTone?: string[];
  keywords?: string[];
}

interface Template {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface BrandVoice {
  id: string;
  name: string;
  tone: string[];
}

interface AIContentGeneratorProps {
  initialContent?: string;
  onContentGenerated: (content: string) => void;
  availableTemplates?: Template[];
  availableBrandVoices?: BrandVoice[];
  className?: string;
}

const AIContentGenerator: React.FC<AIContentGeneratorProps> = ({
  initialContent = '',
  onContentGenerated,
  availableTemplates = [],
  availableBrandVoices = [],
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationType, setGenerationType] = useState<GenerationOptions['type']>('complete');
  const [prompt, setPrompt] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedBrandVoice, setSelectedBrandVoice] = useState('');
  const [targetLength, setTargetLength] = useState(500);
  const [temperature, setTemperature] = useState(0.7);
  const [keywords, setKeywords] = useState('');
  const [targetTones, setTargetTones] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState('');
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const availableTones = [
    'professional', 'casual', 'friendly', 'formal', 'conversational',
    'enthusiastic', 'authoritative', 'empathetic', 'persuasive', 'educational'
  ];

  const generateContent = async () => {
    if (generationType === 'complete' && !prompt.trim()) {
      alert('Please enter a prompt for content generation');
      return;
    }

    if ((generationType === 'continue' || generationType === 'rewrite' || generationType === 'improve') && !initialContent.trim()) {
      alert('Please provide initial content for this operation');
      return;
    }

    setIsGenerating(true);
    try {
      const requestBody = {
        type: generationType,
        input: {
          prompt: generationType === 'complete' ? prompt : undefined,
          text: (generationType !== 'complete') ? initialContent : undefined,
          context: getContextForType()
        },
        options: {
          brandVoiceId: selectedBrandVoice || undefined,
          templateId: selectedTemplate || undefined,
          maxTokens: Math.min(4000, targetLength * 2),
          temperature,
          targetLength,
          targetTone: targetTones.length > 0 ? targetTones : undefined,
          keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(k => k) : undefined
        }
      };

      const response = await fetch('http://localhost:5003/api/v1/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.data;
        setGeneratedContent(result.text);
        setAlternatives(result.alternatives || []);
      } else {
        throw new Error('Failed to generate content');
      }
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getContextForType = () => {
    switch (generationType) {
      case 'continue':
        return 'Continue writing this content in the same style and tone';
      case 'rewrite':
        return `Rewrite this content to be more ${targetTones.join(' and ')}`;
      case 'improve':
        return 'Improve this content for clarity, engagement, and effectiveness';
      case 'adapt':
        return 'Adapt this content for different formats and platforms';
      default:
        return '';
    }
  };

  const useGeneration = (content: string) => {
    onContentGenerated(content);
    setGeneratedContent('');
    setAlternatives([]);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const toggleTone = (tone: string) => {
    setTargetTones(prev => 
      prev.includes(tone) 
        ? prev.filter(t => t !== tone)
        : [...prev, tone]
    );
  };

  return (
    <div className={`ai-content-generator bg-white border border-gray-200 rounded-lg p-6 max-w-full overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="w-6 h-6 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Content Generator</h3>
        </div>
        
        <button
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
        </button>
      </div>

      {/* Generation Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Generation Type
        </label>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { value: 'complete', label: 'Create New', icon: DocumentTextIcon },
            { value: 'continue', label: 'Continue', icon: ArrowTopRightOnSquareIcon },
            { value: 'rewrite', label: 'Rewrite', icon: PencilIcon },
            { value: 'improve', label: 'Improve', icon: LightBulbIcon },
            { value: 'adapt', label: 'Adapt', icon: ArrowPathIcon }
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setGenerationType(value as GenerationOptions['type'])}
              className={`flex flex-col items-center p-3 rounded-lg border text-xs ${
                generationType === value
                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input (for complete generation) */}
      {generationType === 'complete' && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what content you want to generate..."
            className="w-full p-3 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            rows={3}
          />
        </div>
      )}

      {/* Template Selection */}
      {availableTemplates.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Template (Optional)
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">No template</option>
            {availableTemplates.map(template => (
              <option key={template.id} value={template.id}>
                {template.name} ({template.type})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Brand Voice Selection */}
      {availableBrandVoices.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Brand Voice (Optional)
          </label>
          <select
            value={selectedBrandVoice}
            onChange={(e) => setSelectedBrandVoice(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">No brand voice</option>
            {availableBrandVoices.map(voice => (
              <option key={voice.id} value={voice.id}>
                {voice.name} ({voice.tone.join(', ')})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-900">Advanced Options</h4>
          
          {/* Target Length */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Length: {targetLength} words
            </label>
            <input
              type="range"
              min="100"
              max="2000"
              step="50"
              value={targetLength}
              onChange={(e) => setTargetLength(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Creativity: {temperature} (0 = focused, 1 = creative)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Target Tones */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Tones
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTones.map(tone => (
                <button
                  key={tone}
                  onClick={() => toggleTone(tone)}
                  className={`px-3 py-1 rounded-full text-xs ${
                    targetTones.includes(tone)
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Keywords (comma-separated)
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="keyword1, keyword2, keyword3"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateContent}
        disabled={isGenerating}
        className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mb-6"
      >
        {isGenerating ? (
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
        ) : (
          <SparklesIcon className="w-5 h-5" />
        )}
        <span>
          {isGenerating ? 'Generating...' : `Generate ${generationType === 'complete' ? 'Content' : generationType.charAt(0).toUpperCase() + generationType.slice(1)}`}
        </span>
      </button>

      {/* Generated Content */}
      {generatedContent && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Generated Content</h4>
            <div className="flex space-x-2">
              <button
                onClick={() => copyToClipboard(generatedContent)}
                className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                <span>Copy</span>
              </button>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4 max-w-full overflow-hidden">
            <div className="whitespace-pre-wrap text-sm text-gray-800 text-left break-words overflow-wrap-anywhere">
              {generatedContent}
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => useGeneration(generatedContent)}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700"
            >
              Use This Content
            </button>
            
            <button
              onClick={generateContent}
              className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
            >
              Generate Again
            </button>
          </div>

          {/* Alternatives */}
          {alternatives.length > 0 && (
            <div className="mt-6">
              <h5 className="font-medium text-gray-900 mb-3">Alternative Versions</h5>
              <div className="space-y-3">
                {alternatives.map((alt, index) => (
                  <div key={index} className="bg-gray-50 p-3 rounded-lg max-w-full overflow-hidden">
                    <div className="text-sm text-gray-800 mb-2 text-left whitespace-pre-wrap break-words overflow-wrap-anywhere">
                      {alt}
                    </div>
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => copyToClipboard(alt)}
                        className="text-xs text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                      >
                        <ClipboardDocumentIcon className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                      
                      <button
                        onClick={() => useGeneration(alt)}
                        className="text-xs bg-green-600 text-white py-1 px-2 rounded hover:bg-green-700"
                      >
                        Use This
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIContentGenerator;