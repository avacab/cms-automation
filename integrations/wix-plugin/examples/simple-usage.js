/**
 * Simple Usage Examples for Wix AI Writing Assistant
 * Copy these examples into your Wix pages
 */

import { 
  setupAIWritingAssistant, 
  enhanceWixTextElement, 
  generateContentForElement 
} from './public/ai-writing-assistant.js';

// ===========================================
// EXAMPLE 1: Basic Setup
// ===========================================
// Add this to a setup page in your Wix site

$w.onReady(function () {
  $w('#setupAI').onClick(async () => {
    const apiKey = $w('#apiKeyInput').value;
    
    if (apiKey) {
      const success = await setupAIWritingAssistant(apiKey);
      
      if (success) {
        $w('#statusText').text = '✅ AI Assistant setup complete!';
        $w('#statusText').style.color = '#10b981';
      } else {
        $w('#statusText').text = '❌ Setup failed. Check your API key.';
        $w('#statusText').style.color = '#ef4444';
      }
    }
  });
});

// ===========================================
// EXAMPLE 2: Enhance Existing Text
// ===========================================
// Add this to any page where you want to enhance text

$w.onReady(function () {
  // Enhance the main heading when page loads
  enhanceTextOnLoad();
  
  // Manual enhancement button
  $w('#enhanceButton').onClick(() => {
    enhanceSelectedText();
  });
});

async function enhanceTextOnLoad() {
  try {
    // Automatically enhance the main title
    const result = await enhanceWixTextElement('#title', {
      includeSEO: true,
      includeEngagement: true
    });
    
    if (result) {
      console.log('Title enhanced successfully');
      showNotification('Title enhanced with AI suggestions!', 'success');
    }
  } catch (error) {
    console.log('Enhancement skipped - setup required');
  }
}

async function enhanceSelectedText() {
  const elementId = $w('#elementDropdown').value;
  
  if (!elementId) {
    showNotification('Please select a text element', 'warning');
    return;
  }
  
  try {
    $w('#enhanceButton').label = 'Enhancing...';
    $w('#enhanceButton').disable();
    
    const result = await enhanceWixTextElement(elementId);
    
    if (result && result.suggestions.length > 0) {
      showNotification(`Applied ${result.suggestions.length} improvements!`, 'success');
    } else {
      showNotification('No improvements needed - text looks great!', 'info');
    }
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  } finally {
    $w('#enhanceButton').label = 'Enhance Text';
    $w('#enhanceButton').enable();
  }
}

// ===========================================
// EXAMPLE 3: Generate New Content
// ===========================================
// Add this to a content creation page

$w.onReady(function () {
  $w('#generateContent').onClick(() => {
    generateNewContent();
  });
  
  // Quick content templates
  $w('#blogTemplate').onClick(() => {
    generateBlogPost();
  });
  
  $w('#productTemplate').onClick(() => {
    generateProductDescription();
  });
});

async function generateNewContent() {
  const prompt = $w('#promptInput').value;
  const targetElement = $w('#targetElementInput').value;
  
  if (!prompt || !targetElement) {
    showNotification('Please enter both prompt and target element', 'warning');
    return;
  }
  
  try {
    $w('#generateContent').label = 'Generating...';
    $w('#generateContent').disable();
    
    const result = await generateContentForElement(targetElement, prompt, {
      targetLength: 300,
      temperature: 0.7
    });
    
    showNotification('Content generated successfully!', 'success');
    
    // Show stats if available
    if (result.metadata) {
      $w('#statsText').text = `Generated in ${Math.round(result.metadata.processingTime / 1000)}s`;
    }
    
  } catch (error) {
    showNotification(`Generation failed: ${error.message}`, 'error');
  } finally {
    $w('#generateContent').label = 'Generate Content';
    $w('#generateContent').enable();
  }
}

async function generateBlogPost() {
  const topic = $w('#topicInput').value;
  
  if (!topic) {
    showNotification('Please enter a blog topic', 'warning');
    return;
  }
  
  const prompt = `Write an engaging blog post about ${topic}. Include an introduction, main points, and conclusion. Make it informative and reader-friendly.`;
  
  try {
    await generateContentForElement('#blogContent', prompt, {
      targetLength: 800,
      temperature: 0.7,
      keywords: [topic, 'guide', 'tips']
    });
    
    showNotification('Blog post generated!', 'success');
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  }
}

async function generateProductDescription() {
  const product = $w('#productNameInput').value;
  const features = $w('#featuresInput').value;
  
  if (!product) {
    showNotification('Please enter a product name', 'warning');
    return;
  }
  
  const prompt = `Write a compelling product description for ${product}. ${features ? `Key features: ${features}.` : ''} Focus on benefits and what makes it special.`;
  
  try {
    await generateContentForElement('#productDescription', prompt, {
      targetLength: 200,
      temperature: 0.6,
      keywords: [product, 'quality', 'premium']
    });
    
    showNotification('Product description generated!', 'success');
  } catch (error) {
    showNotification(`Error: ${error.message}`, 'error');
  }
}

// ===========================================
// EXAMPLE 4: Content Adaptation
// ===========================================
// Add this for social media content creation

import { AIWritingAssistant } from './public/ai-writing-assistant.js';

$w.onReady(function () {
  $w('#adaptContent').onClick(() => {
    adaptForSocialMedia();
  });
});

async function adaptForSocialMedia() {
  const originalText = $w('#originalContent').text;
  
  if (!originalText) {
    showNotification('Please add content to adapt', 'warning');
    return;
  }
  
  try {
    const ai = new AIWritingAssistant();
    const apiKey = session.getItem('ai-writing-assistant-api-key');
    await ai.initialize(apiKey);
    
    const adaptations = await ai.adaptContent(originalText, [
      { format: 'twitter' },
      { format: 'facebook' },
      { format: 'instagram' },
      { format: 'linkedin' }
    ]);
    
    // Display adaptations
    adaptations.forEach((adaptation, index) => {
      const elementId = `#${adaptation.format}Content`;
      try {
        $w(elementId).text = adaptation.text;
      } catch (error) {
        console.log(`Element ${elementId} not found`);
      }
    });
    
    showNotification('Content adapted for social media!', 'success');
    
  } catch (error) {
    showNotification(`Adaptation failed: ${error.message}`, 'error');
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function showNotification(message, type = 'info') {
  const notification = $w('#notification');
  notification.text = message;
  
  // Set color based on type
  const colors = {
    success: '#10b981',
    error: '#ef4444', 
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  notification.style.color = colors[type] || colors.info;
  notification.show();
  
  // Auto-hide after 4 seconds
  setTimeout(() => {
    notification.hide();
  }, 4000);
}

// Quick setup function for copy-paste
export function quickSetup(apiKey) {
  return setupAIWritingAssistant(apiKey);
}

// Bulk enhance all text elements on page
export async function enhanceAllPageText() {
  const textElements = ['#text1', '#text2', '#text3', '#title', '#subtitle'];
  let enhanced = 0;
  
  for (const elementId of textElements) {
    try {
      const result = await enhanceWixTextElement(elementId);
      if (result) enhanced++;
    } catch (error) {
      // Element doesn't exist or enhancement failed
    }
  }
  
  showNotification(`Enhanced ${enhanced} text elements`, 'success');
  return enhanced;
}