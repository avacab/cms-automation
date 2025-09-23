/**
 * Wix Setup Page for AI Writing Assistant
 * This code goes in your Wix site's setup page
 */

import { setupAIWritingAssistant, AIWritingAssistant } from './ai-writing-assistant.js';
import { session } from 'wix-storage';

$w.onReady(function () {
  // Hide success message initially
  $w('#successMessage').hide();
  $w('#errorMessage').hide();
  $w('#loadingIcon').hide();

  // Setup form submission
  $w('#setupButton').onClick(async () => {
    const apiKey = $w('#apiKeyInput').value;
    const brandVoiceId = $w('#brandVoiceInput').value;

    if (!apiKey) {
      showError('Please enter your API key');
      return;
    }

    // Show loading state
    $w('#loadingIcon').show();
    $w('#setupButton').disable();
    $w('#setupButton').label = 'Setting up...';

    try {
      const success = await setupAIWritingAssistant(apiKey, brandVoiceId);
      
      if (success) {
        showSuccess('AI Writing Assistant setup completed successfully!');
        
        // Hide form and show next steps
        $w('#setupForm').hide();
        $w('#nextSteps').show();
        
        // Load available features
        await loadAvailableFeatures();
      } else {
        showError('Setup failed. Please check your API key and try again.');
      }
    } catch (error) {
      showError(`Setup failed: ${error.message}`);
    } finally {
      $w('#loadingIcon').hide();
      $w('#setupButton').enable();
      $w('#setupButton').label = 'Setup AI Assistant';
    }
  });

  // Test connection button
  $w('#testConnectionButton').onClick(async () => {
    const apiKey = $w('#apiKeyInput').value;
    
    if (!apiKey) {
      showError('Please enter your API key first');
      return;
    }

    $w('#testConnectionButton').disable();
    $w('#testConnectionButton').label = 'Testing...';

    try {
      const aiAssistant = new AIWritingAssistant();
      await aiAssistant.initialize(apiKey);
      
      showSuccess('Connection test successful!');
    } catch (error) {
      showError(`Connection test failed: ${error.message}`);
    } finally {
      $w('#testConnectionButton').enable();
      $w('#testConnectionButton').label = 'Test Connection';
    }
  });

  // Check if already setup
  checkExistingSetup();
});

function showSuccess(message) {
  $w('#successMessage').text = message;
  $w('#successMessage').show();
  $w('#errorMessage').hide();
  
  setTimeout(() => {
    $w('#successMessage').hide();
  }, 5000);
}

function showError(message) {
  $w('#errorMessage').text = message;
  $w('#errorMessage').show();
  $w('#successMessage').hide();
  
  setTimeout(() => {
    $w('#errorMessage').hide();
  }, 5000);
}

async function checkExistingSetup() {
  const setupComplete = session.getItem('ai-writing-assistant-setup');
  const apiKey = session.getItem('ai-writing-assistant-api-key');
  
  if (setupComplete === 'complete' && apiKey) {
    $w('#setupForm').hide();
    $w('#nextSteps').show();
    $w('#existingSetup').show();
    $w('#currentApiKey').text = `Current API Key: ${apiKey.substring(0, 8)}...`;
    
    await loadAvailableFeatures();
  }
}

async function loadAvailableFeatures() {
  try {
    const aiAssistant = new AIWritingAssistant();
    const apiKey = session.getItem('ai-writing-assistant-api-key');
    await aiAssistant.initialize(apiKey);
    
    // Get available formats
    const formats = await aiAssistant.getAvailableFormats();
    
    // Populate formats list
    const formatsList = formats.map(format => 
      `• ${format.format}: ${format.description}`
    ).join('\n');
    
    $w('#availableFormats').text = formatsList;
    
  } catch (error) {
    console.error('Failed to load features:', error);
  }
}

// Reset setup
export function resetSetup() {
  session.removeItem('ai-writing-assistant-setup');
  session.removeItem('ai-writing-assistant-api-key');
  session.removeItem('ai-brand-voice-id');
  
  $w('#setupForm').show();
  $w('#nextSteps').hide();
  $w('#existingSetup').hide();
  
  // Clear form
  $w('#apiKeyInput').value = '';
  $w('#brandVoiceInput').value = '';
  
  showSuccess('Setup has been reset. You can now configure again.');
}