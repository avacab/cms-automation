# AI Writing Assistant Wix Plugin

Transform your Wix website content with AI-powered writing assistance, real-time suggestions, and automated content generation.

## Features

🤖 **AI Content Generation** - Generate high-quality content from prompts
✏️ **Real-time Writing Suggestions** - Grammar, style, SEO, and engagement improvements  
🎨 **Brand Voice Consistency** - Maintain your unique brand voice across all content
📱 **Multi-format Adaptation** - Adapt content for social media, emails, and more
⚡ **One-click Enhancement** - Automatically improve existing text elements
🔄 **Batch Processing** - Enhance multiple elements simultaneously

## Quick Setup

### 1. Get Your API Key
1. Sign up at [your-ai-service-domain.com]
2. Navigate to API Settings
3. Generate a new API key
4. Copy the API key (starts with `sk-...`)

### 2. Install in Wix
1. Open your Wix Editor
2. Go to Dev Mode (Velo)
3. Add the plugin files to your `public` folder:
   - `ai-writing-assistant.js`
   - `setup-page.js` 
   - `content-enhancer.js`

### 3. Create Setup Page
1. Add a new page called "AI Assistant Setup"
2. Add these elements to your page:

```html
<!-- Setup Form -->
<input id="apiKeyInput" placeholder="Enter your API key" type="password" />
<input id="brandVoiceInput" placeholder="Brand Voice ID (optional)" />
<button id="setupButton">Setup AI Assistant</button>
<button id="testConnectionButton">Test Connection</button>

<!-- Status Messages -->
<text id="successMessage" hidden>Success!</text>
<text id="errorMessage" hidden>Error!</text>
<image id="loadingIcon" src="loading-spinner.gif" hidden />

<!-- Next Steps (hidden initially) -->
<container id="nextSteps" hidden>
  <text>✅ AI Writing Assistant is ready!</text>
  <text id="availableFormats">Loading available formats...</text>
</container>
```

3. Add this code to your page:
```javascript
import './public/setup-page.js';
```

### 4. Create Content Enhancer Page
1. Add a new page called "Content Enhancer" 
2. Add these elements:

```html
<!-- Element Selection -->
<dropdown id="elementSelector" />
<text id="elementCount">0 elements detected</text>

<!-- Enhancement Controls -->
<button id="enhanceButton">Enhance Content</button>
<button id="undoButton">Undo Last Change</button>

<!-- Content Generation -->
<input id="promptInput" placeholder="Describe the content you want..." />
<input id="targetElementInput" placeholder="Target element ID (e.g., #text1)" />
<button id="generateButton">Generate Content</button>

<!-- Settings -->
<checkbox id="includeGrammar" checked>Grammar suggestions</checkbox>
<checkbox id="includeSEO" checked>SEO optimization</checkbox>
<checkbox id="includeEngagement" checked>Engagement improvements</checkbox>
<checkbox id="includeBrandVoice" checked>Brand voice consistency</checkbox>

<!-- Advanced Options -->
<slider id="targetLengthSlider" min="100" max="1000" value="300">Target Length</slider>
<slider id="creativitySlider" min="0" max="1" step="0.1" value="0.7">Creativity</slider>
<input id="keywordsInput" placeholder="SEO keywords (comma-separated)" />

<!-- Status -->
<text id="messageDisplay" hidden />
<text id="suggestionsCount" />
<text id="generationStats" />
<progressbar id="progressBar" hidden />
<text id="progressText" />
```

3. Add this code to your page:
```javascript
import './public/content-enhancer.js';
```

## Usage Examples

### Basic Content Enhancement
```javascript
import { enhanceWixTextElement } from './public/ai-writing-assistant.js';

// Enhance a specific text element
$w('#enhanceButton').onClick(async () => {
  const result = await enhanceWixTextElement('#text1', {
    includeGrammar: true,
    includeSEO: true,
    includeEngagement: true
  });
  
  console.log('Enhanced:', result);
});
```

### Content Generation
```javascript
import { generateContentForElement } from './public/ai-writing-assistant.js';

// Generate content for an element
$w('#generateButton').onClick(async () => {
  const result = await generateContentForElement(
    '#text1', 
    'Write a compelling product description for organic coffee',
    {
      targetLength: 200,
      temperature: 0.7,
      keywords: ['organic', 'coffee', 'premium']
    }
  );
  
  console.log('Generated:', result);
});
```

### Batch Enhancement
```javascript
import { batchEnhanceElements } from './public/ai-writing-assistant.js';

// Enhance multiple elements at once
const elementIds = ['#text1', '#text2', '#text3'];
const results = await batchEnhanceElements(elementIds, {
  includeSEO: true,
  includeEngagement: true
});

console.log('Batch results:', results);
```

### Advanced Usage
```javascript
import { AIWritingAssistant } from './public/ai-writing-assistant.js';

const ai = new AIWritingAssistant();
await ai.initialize('your-api-key', 'your-brand-voice-id');

// Get writing suggestions
const suggestions = await ai.getWritingSuggestions('Your content here');

// Adapt content for different platforms
const adaptations = await ai.adaptContent('Original content', [
  { format: 'twitter' },
  { format: 'facebook' },
  { format: 'email-subject', constraints: { maxLength: 50 } }
]);

// Generate content with specific options
const content = await ai.generateContent({
  type: 'complete',
  prompt: 'Write about sustainable energy',
  targetLength: 500,
  temperature: 0.8,
  keywords: ['renewable', 'solar', 'wind']
});
```

## Available Content Formats

The plugin supports adaptation to these formats:
- **Social Media**: Twitter, Facebook, Instagram, LinkedIn
- **Email Marketing**: Subject lines, preview text, newsletter content
- **SEO**: Meta descriptions, blog excerpts
- **Business**: Press releases, product taglines
- **Custom**: Define your own format constraints

## Configuration Options

### Enhancement Settings
- `includeGrammar`: Grammar and spelling suggestions
- `includeSEO`: SEO optimization recommendations  
- `includeEngagement`: Engagement and readability improvements
- `includeBrandVoice`: Brand voice consistency checks

### Generation Parameters
- `targetLength`: Desired content length (50-2000 words)
- `temperature`: Creativity level (0=focused, 1=creative)
- `keywords`: SEO keywords to include
- `targetTones`: Desired content tone (professional, casual, friendly, etc.)

## Troubleshooting

### Common Issues

**"API key not found" error**
- Make sure you've completed the setup process
- Check that your API key is valid and active

**"Element not found" error**  
- Verify the element ID exists on your page
- Use the browser inspector to confirm element IDs

**Content not generating**
- Check your internet connection
- Verify API key has sufficient credits
- Try reducing the target length

**Enhancements not applying**
- Ensure text elements have sufficient content (>10 characters)
- Check enhancement settings are enabled
- Try refreshing the page

### Getting Help

1. Check the browser console for error messages
2. Verify all required elements exist on your page
3. Test API connection using the setup page
4. Contact support with error details and browser console logs

## API Integration

This plugin connects to your AI Writing Assistant API with these endpoints:

- `POST /api/v1/generate` - Content generation
- `POST /api/v1/suggestions` - Writing suggestions  
- `POST /api/v1/adapt` - Content adaptation
- `GET /api/v1/adapt/formats` - Available formats
- `GET /health` - Service health check

## Security & Privacy

- API keys are stored securely in Wix session storage
- Content is processed server-side and not stored permanently
- All communication uses HTTPS encryption
- No personal data is collected or shared

## Pricing & Limits

- Free tier: 1,000 API calls per month
- Pro tier: Unlimited calls, priority support
- Enterprise: Custom limits, dedicated support

Usage is tracked per API call:
- Content generation: 1 call
- Writing suggestions: 1 call  
- Content adaptation: 1 call per format

## Support

- Documentation: [docs.your-domain.com/wix-plugin]
- Support: [support@your-domain.com]
- Community: [community.your-domain.com]

---

**Made with ❤️ for Wix creators**

Transform your website content with AI-powered writing assistance!