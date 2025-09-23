/**
 * AI Writing Assistant Wix Plugin
 * Integrates with your CMS Automation Platform AI service
 */

import wixData from 'wix-data';
import wixLocation from 'wix-location';
import { session } from 'wix-storage';

// Configuration
const AI_API_BASE_URL = 'https://your-domain.com/api/v1'; // Replace with your actual domain
const AI_API_KEY = 'your-api-key'; // This should be set by the user during plugin setup

class AIWritingAssistant {
  constructor() {
    this.apiKey = session.getItem('ai-writing-assistant-api-key');
    this.brandVoiceId = session.getItem('ai-brand-voice-id');
    this.isInitialized = false;
  }

  /**
   * Initialize the AI Writing Assistant
   * @param {string} apiKey - API key for the AI service
   * @param {string} brandVoiceId - Optional brand voice ID
   */
  async initialize(apiKey, brandVoiceId = null) {
    this.apiKey = apiKey;
    this.brandVoiceId = brandVoiceId;
    
    // Store credentials securely
    session.setItem('ai-writing-assistant-api-key', apiKey);
    if (brandVoiceId) {
      session.setItem('ai-brand-voice-id', brandVoiceId);
    }
    
    this.isInitialized = true;
    
    // Test API connection
    try {
      await this.testConnection();
      console.log('AI Writing Assistant initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize AI Writing Assistant:', error);
      return false;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    const response = await fetch(`${AI_API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('API connection failed');
    }

    return await response.json();
  }

  /**
   * Generate content using AI
   * @param {Object} options - Generation options
   * @param {string} options.type - Generation type ('complete', 'continue', 'rewrite', 'improve')
   * @param {string} options.prompt - Content prompt for 'complete' type
   * @param {string} options.text - Existing text for other types
   * @param {number} options.targetLength - Target length in words
   * @param {number} options.temperature - Creativity level (0-1)
   * @param {string[]} options.targetTones - Target tones
   * @param {string[]} options.keywords - SEO keywords
   */
  async generateContent(options) {
    if (!this.isInitialized) {
      throw new Error('AI Writing Assistant not initialized. Call initialize() first.');
    }

    const requestBody = {
      type: options.type || 'complete',
      input: {
        prompt: options.prompt,
        text: options.text,
        context: options.context || ''
      },
      options: {
        brandVoiceId: this.brandVoiceId,
        targetLength: options.targetLength || 300,
        temperature: options.temperature || 0.7,
        targetTone: options.targetTones,
        keywords: options.keywords
      }
    };

    try {
      const response = await fetch(`${AI_API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Content generation failed:', error);
      throw error;
    }
  }

  /**
   * Get writing suggestions for existing content
   * @param {string} content - Content to analyze
   * @param {Object} options - Suggestion options
   */
  async getWritingSuggestions(content, options = {}) {
    if (!this.isInitialized) {
      throw new Error('AI Writing Assistant not initialized. Call initialize() first.');
    }

    const requestBody = {
      content: content,
      brandVoiceId: this.brandVoiceId,
      options: {
        includeGrammar: options.includeGrammar !== false,
        includeSEO: options.includeSEO !== false,
        includeEngagement: options.includeEngagement !== false,
        includeBrandVoice: options.includeBrandVoice !== false
      }
    };

    try {
      const response = await fetch(`${AI_API_BASE_URL}/suggestions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.data.suggestions;
    } catch (error) {
      console.error('Getting suggestions failed:', error);
      throw error;
    }
  }

  /**
   * Adapt content for different formats/platforms
   * @param {string} originalText - Original content
   * @param {Array} targetFormats - Array of target formats
   */
  async adaptContent(originalText, targetFormats) {
    if (!this.isInitialized) {
      throw new Error('AI Writing Assistant not initialized. Call initialize() first.');
    }

    const requestBody = {
      originalText: originalText,
      targetFormats: targetFormats,
      brandVoiceId: this.brandVoiceId
    };

    try {
      const response = await fetch(`${AI_API_BASE_URL}/adapt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.data.adaptations;
    } catch (error) {
      console.error('Content adaptation failed:', error);
      throw error;
    }
  }

  /**
   * Get available adaptation formats
   */
  async getAvailableFormats() {
    if (!this.isInitialized) {
      throw new Error('AI Writing Assistant not initialized. Call initialize() first.');
    }

    try {
      const response = await fetch(`${AI_API_BASE_URL}/adapt/formats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get available formats');
      }

      const data = await response.json();
      return data.data.formats;
    } catch (error) {
      console.error('Getting formats failed:', error);
      throw error;
    }
  }
}

// Wix-specific integration functions

/**
 * Auto-enhance text elements on the page
 * @param {string} elementId - Wix element ID
 * @param {Object} options - Enhancement options
 */
export async function enhanceWixTextElement(elementId, options = {}) {
  const aiAssistant = new AIWritingAssistant();
  
  // Get existing API key from session or prompt user
  const apiKey = session.getItem('ai-writing-assistant-api-key');
  if (!apiKey) {
    console.error('API key not found. Please initialize the AI Writing Assistant first.');
    return;
  }
  
  await aiAssistant.initialize(apiKey);
  
  // Get the text element
  const element = $w(elementId);
  const originalText = element.text;
  
  if (!originalText || originalText.length < 10) {
    console.warn('Text too short for enhancement');
    return;
  }

  try {
    // Get suggestions for improvement
    const suggestions = await aiAssistant.getWritingSuggestions(originalText, options);
    
    if (suggestions && suggestions.length > 0) {
      // Apply the first high-confidence suggestion automatically
      const highConfidenceSuggestions = suggestions.filter(s => s.confidence > 0.8);
      
      if (highConfidenceSuggestions.length > 0) {
        const suggestion = highConfidenceSuggestions[0];
        const improvedText = originalText.substring(0, suggestion.position.start) + 
                           suggestion.suggestion + 
                           originalText.substring(suggestion.position.end);
        
        element.text = improvedText;
        
        // Store original text for undo functionality
        session.setItem(`original-text-${elementId}`, originalText);
        
        console.log(`Enhanced text element ${elementId}`);
        return {
          original: originalText,
          enhanced: improvedText,
          suggestions: suggestions
        };
      }
    }
  } catch (error) {
    console.error('Failed to enhance text element:', error);
  }
}

/**
 * Generate content for a Wix text element based on a prompt
 * @param {string} elementId - Wix element ID
 * @param {string} prompt - Content prompt
 * @param {Object} options - Generation options
 */
export async function generateContentForElement(elementId, prompt, options = {}) {
  const aiAssistant = new AIWritingAssistant();
  
  const apiKey = session.getItem('ai-writing-assistant-api-key');
  if (!apiKey) {
    console.error('API key not found. Please initialize the AI Writing Assistant first.');
    return;
  }
  
  await aiAssistant.initialize(apiKey);
  
  try {
    const result = await aiAssistant.generateContent({
      type: 'complete',
      prompt: prompt,
      ...options
    });
    
    // Set the generated content to the element
    const element = $w(elementId);
    element.text = result.text;
    
    console.log(`Generated content for element ${elementId}`);
    return result;
  } catch (error) {
    console.error('Failed to generate content:', error);
    throw error;
  }
}

/**
 * Batch process multiple text elements on a page
 * @param {string[]} elementIds - Array of element IDs
 * @param {Object} options - Processing options
 */
export async function batchEnhanceElements(elementIds, options = {}) {
  const results = [];
  
  for (const elementId of elementIds) {
    try {
      const result = await enhanceWixTextElement(elementId, options);
      results.push({ elementId, result, success: true });
    } catch (error) {
      results.push({ elementId, error: error.message, success: false });
    }
  }
  
  return results;
}

/**
 * Setup function for Wix site owners
 * @param {string} apiKey - AI service API key
 * @param {string} brandVoiceId - Optional brand voice ID
 */
export async function setupAIWritingAssistant(apiKey, brandVoiceId = null) {
  const aiAssistant = new AIWritingAssistant();
  const success = await aiAssistant.initialize(apiKey, brandVoiceId);
  
  if (success) {
    console.log('AI Writing Assistant setup completed successfully');
    
    // Store setup completion
    session.setItem('ai-writing-assistant-setup', 'complete');
    
    return true;
  } else {
    console.error('AI Writing Assistant setup failed');
    return false;
  }
}

/**
 * Undo the last enhancement for an element
 * @param {string} elementId - Element ID to undo
 */
export function undoEnhancement(elementId) {
  const originalText = session.getItem(`original-text-${elementId}`);
  
  if (originalText) {
    const element = $w(elementId);
    element.text = originalText;
    
    // Remove the stored original text
    session.removeItem(`original-text-${elementId}`);
    
    console.log(`Undid enhancement for element ${elementId}`);
    return true;
  }
  
  console.warn(`No original text found for element ${elementId}`);
  return false;
}

// Export the main class for advanced usage
export { AIWritingAssistant };

// Auto-initialization for simple usage
$w.onReady(() => {
  const setupComplete = session.getItem('ai-writing-assistant-setup');
  if (setupComplete === 'complete') {
    console.log('AI Writing Assistant ready for use');
  } else {
    console.log('AI Writing Assistant needs setup. Call setupAIWritingAssistant() with your API key.');
  }
});