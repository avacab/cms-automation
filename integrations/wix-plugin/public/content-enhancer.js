/**
 * Content Enhancer for Wix Pages
 * Automatically enhances text content on Wix pages
 */

import { enhanceWixTextElement, generateContentForElement, batchEnhanceElements, undoEnhancement } from './ai-writing-assistant.js';
import { session } from 'wix-storage';

$w.onReady(function () {
  // Initialize enhancement controls
  initializeEnhancementControls();
  
  // Auto-detect text elements that could be enhanced
  detectEnhanceableElements();
  
  // Setup enhancement buttons
  setupEnhancementButtons();
});

function initializeEnhancementControls() {
  // Show/hide controls based on setup status
  const setupComplete = session.getItem('ai-writing-assistant-setup');
  
  if (setupComplete !== 'complete') {
    $w('#enhancementControls').hide();
    $w('#setupRequired').show();
    return;
  }
  
  $w('#enhancementControls').show();
  $w('#setupRequired').hide();
}

function detectEnhanceableElements() {
  // Get all text elements on the page
  const textElements = [
    '#text1', '#text2', '#text3', '#text4', '#text5', // Common text element IDs
    '#title', '#subtitle', '#description', '#content',
    '#heading1', '#heading2', '#paragraph1', '#paragraph2'
  ];
  
  const enhanceableElements = [];
  
  textElements.forEach(elementId => {
    try {
      const element = $w(elementId);
      const text = element.text;
      
      // Check if element exists and has meaningful text
      if (text && text.length > 20 && text.length < 5000) {
        enhanceableElements.push({
          id: elementId,
          text: text,
          length: text.length
        });
      }
    } catch (error) {
      // Element doesn't exist, skip
    }
  });
  
  // Populate enhancement options
  populateElementSelector(enhanceableElements);
}

function populateElementSelector(elements) {
  const dropdown = $w('#elementSelector');
  
  const options = elements.map(element => ({
    label: `${element.id} (${element.length} chars): ${element.text.substring(0, 50)}...`,
    value: element.id
  }));
  
  // Add "All Elements" option
  options.unshift({
    label: 'All Detected Elements',
    value: 'all'
  });
  
  dropdown.options = options;
  
  // Update count
  $w('#elementCount').text = `${elements.length} enhanceable elements detected`;
}

function setupEnhancementButtons() {
  // Single element enhancement
  $w('#enhanceButton').onClick(async () => {
    const selectedElement = $w('#elementSelector').value;
    
    if (!selectedElement) {
      showMessage('Please select an element to enhance', 'error');
      return;
    }
    
    $w('#enhanceButton').disable();
    $w('#enhanceButton').label = 'Enhancing...';
    
    try {
      if (selectedElement === 'all') {
        await enhanceAllElements();
      } else {
        await enhanceSingleElement(selectedElement);
      }
    } catch (error) {
      showMessage(`Enhancement failed: ${error.message}`, 'error');
    } finally {
      $w('#enhanceButton').enable();
      $w('#enhanceButton').label = 'Enhance Content';
    }
  });
  
  // Content generation
  $w('#generateButton').onClick(async () => {
    const prompt = $w('#promptInput').value;
    const targetElement = $w('#targetElementInput').value;
    
    if (!prompt) {
      showMessage('Please enter a content prompt', 'error');
      return;
    }
    
    if (!targetElement) {
      showMessage('Please specify target element ID', 'error');
      return;
    }
    
    $w('#generateButton').disable();
    $w('#generateButton').label = 'Generating...';
    
    try {
      await generateContent(targetElement, prompt);
    } catch (error) {
      showMessage(`Generation failed: ${error.message}`, 'error');
    } finally {
      $w('#generateButton').enable();
      $w('#generateButton').label = 'Generate Content';
    }
  });
  
  // Undo last action
  $w('#undoButton').onClick(() => {
    const lastEnhanced = session.getItem('last-enhanced-element');
    
    if (lastEnhanced) {
      const success = undoEnhancement(lastEnhanced);
      
      if (success) {
        showMessage(`Undid enhancement for ${lastEnhanced}`, 'success');
        session.removeItem('last-enhanced-element');
      } else {
        showMessage('No changes to undo', 'warning');
      }
    } else {
      showMessage('No recent enhancements to undo', 'warning');
    }
  });
  
  // Enhancement settings
  setupEnhancementSettings();
}

function setupEnhancementSettings() {
  // Load saved settings
  const savedSettings = session.getItem('enhancement-settings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    $w('#includeGrammar').checked = settings.includeGrammar !== false;
    $w('#includeSEO').checked = settings.includeSEO !== false;
    $w('#includeEngagement').checked = settings.includeEngagement !== false;
    $w('#includeBrandVoice').checked = settings.includeBrandVoice !== false;
  }
  
  // Save settings when changed
  const saveSettings = () => {
    const settings = {
      includeGrammar: $w('#includeGrammar').checked,
      includeSEO: $w('#includeSEO').checked,
      includeEngagement: $w('#includeEngagement').checked,
      includeBrandVoice: $w('#includeBrandVoice').checked
    };
    session.setItem('enhancement-settings', JSON.stringify(settings));
  };
  
  $w('#includeGrammar').onChange(saveSettings);
  $w('#includeSEO').onChange(saveSettings);
  $w('#includeEngagement').onChange(saveSettings);
  $w('#includeBrandVoice').onChange(saveSettings);
}

async function enhanceSingleElement(elementId) {
  const settings = getEnhancementSettings();
  
  const result = await enhanceWixTextElement(elementId, settings);
  
  if (result) {
    showMessage(`Enhanced ${elementId} successfully`, 'success');
    session.setItem('last-enhanced-element', elementId);
    
    // Show suggestions count
    if (result.suggestions && result.suggestions.length > 0) {
      $w('#suggestionsCount').text = `${result.suggestions.length} suggestions applied`;
    }
  } else {
    showMessage(`No enhancements needed for ${elementId}`, 'info');
  }
}

async function enhanceAllElements() {
  const elements = getAllEnhanceableElementIds();
  const settings = getEnhancementSettings();
  
  $w('#progressBar').show();
  $w('#progressText').text = 'Starting batch enhancement...';
  
  const results = await batchEnhanceElements(elements, settings);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  showMessage(`Enhanced ${successful} elements successfully, ${failed} failed`, 'info');
  
  $w('#progressBar').hide();
  $w('#progressText').text = `Completed: ${successful} enhanced, ${failed} failed`;
}

async function generateContent(elementId, prompt) {
  const options = {
    targetLength: parseInt($w('#targetLengthSlider').value) || 300,
    temperature: parseFloat($w('#creativitySlider').value) || 0.7,
    keywords: $w('#keywordsInput').value ? $w('#keywordsInput').value.split(',').map(k => k.trim()) : []
  };
  
  const result = await generateContentForElement(elementId, prompt, options);
  
  if (result) {
    showMessage(`Generated content for ${elementId} successfully`, 'success');
    
    // Show generation stats
    if (result.metadata) {
      $w('#generationStats').text = `${result.metadata.tokensUsed} tokens used, ${Math.round(result.metadata.processingTime / 1000)}s processing time`;
    }
  }
}

function getEnhancementSettings() {
  const savedSettings = session.getItem('enhancement-settings');
  
  if (savedSettings) {
    return JSON.parse(savedSettings);
  }
  
  return {
    includeGrammar: true,
    includeSEO: true,
    includeEngagement: true,
    includeBrandVoice: true
  };
}

function getAllEnhanceableElementIds() {
  // This would be populated from detectEnhanceableElements()
  const dropdown = $w('#elementSelector');
  return dropdown.options
    .filter(option => option.value !== 'all')
    .map(option => option.value);
}

function showMessage(message, type = 'info') {
  const messageElement = $w('#messageDisplay');
  messageElement.text = message;
  
  // Set color based on type
  switch (type) {
    case 'success':
      messageElement.style.color = '#10b981';
      break;
    case 'error':
      messageElement.style.color = '#ef4444';
      break;
    case 'warning':
      messageElement.style.color = '#f59e0b';
      break;
    default:
      messageElement.style.color = '#6b7280';
  }
  
  messageElement.show();
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    messageElement.hide();
  }, 5000);
}

// Export utility functions
export function refreshElementDetection() {
  detectEnhanceableElements();
  showMessage('Element detection refreshed', 'info');
}

export function clearEnhancementHistory() {
  session.removeItem('last-enhanced-element');
  showMessage('Enhancement history cleared', 'info');
}