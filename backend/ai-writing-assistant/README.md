# AI Writing Assistant

A comprehensive AI-powered writing assistant service that provides real-time suggestions, content generation, brand voice consistency, and multi-format content adaptation for the CMS platform.

## Features

### 🤖 Real-Time Writing Suggestions
- Grammar and style corrections
- SEO optimization suggestions
- Engagement improvements
- Brand voice compliance checks
- Clarity and readability enhancements

### ✍️ AI Content Generation
- Complete content creation from prompts
- Content continuation and expansion
- Content rewriting and improvement
- Template-based generation
- Multi-tone adaptation

### 🎯 Brand Voice Consistency
- Train custom brand voices from content samples
- Automatic brand voice compliance checking
- Style and tone analysis
- Preferred/avoided words enforcement
- Writing style guidelines

### 📝 Content Template Intelligence
- Pre-built templates for various content types
- Template-guided content creation
- Structure analysis and suggestions
- Custom template creation
- Content-template matching

### 🔄 Multi-Format Content Adaptation
- Social media adaptations (Twitter, LinkedIn, Facebook, Instagram)
- Email formats (subject lines, preview text)
- SEO formats (meta descriptions, blog excerpts)
- Marketing formats (press releases, taglines)
- Custom format constraints

## Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key
- Redis (optional, for caching)

### Installation

1. **Clone and install dependencies**
   ```bash
   cd backend/ai-writing-assistant
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configurations
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Access the service**
   - API: http://localhost:5002
   - Health check: http://localhost:5002/health
   - Documentation: http://localhost:5002/

### Docker Development

1. **Start with Docker Compose**
   ```bash
   cd docker/development
   docker-compose -f docker-compose.ai-assistant.yml up -d
   ```

2. **View logs**
   ```bash
   docker-compose -f docker-compose.ai-assistant.yml logs -f ai-writing-assistant
   ```

## API Documentation

### Base URL
```
http://localhost:5002/api/v1
```

### Authentication
Currently using API-based authentication. In production, implement proper JWT or API key authentication.

### Core Endpoints

#### Writing Suggestions
```http
POST /suggestions
Content-Type: application/json

{
  "content": "Your content text here",
  "brandVoiceId": "optional-brand-voice-id",
  "options": {
    "includeGrammar": true,
    "includeSEO": true,
    "includeEngagement": true,
    "includeBrandVoice": true
  }
}
```

#### Content Generation
```http
POST /generate
Content-Type: application/json

{
  "type": "complete|continue|rewrite|improve|adapt",
  "input": {
    "prompt": "Content generation prompt",
    "text": "Existing text (for continue/rewrite/improve)",
    "context": "Additional context"
  },
  "options": {
    "brandVoiceId": "brand-voice-id",
    "templateId": "template-id",
    "maxTokens": 1000,
    "temperature": 0.7,
    "targetTone": ["professional", "friendly"]
  }
}
```

#### Content Adaptation
```http
POST /adapt
Content-Type: application/json

{
  "originalText": "Text to adapt",
  "targetFormats": [
    {
      "format": "twitter",
      "constraints": {
        "maxLength": 280,
        "includeHashtags": true
      }
    }
  ],
  "brandVoiceId": "optional-brand-voice-id"
}
```

#### Brand Voice Training
```http
POST /brand-voice/train
Content-Type: application/json

{
  "name": "Company Brand Voice",
  "contentSamples": [
    "Sample content 1...",
    "Sample content 2..."
  ]
}
```

#### Template Operations
```http
GET /templates
GET /templates/:id
POST /templates/:id/generate
POST /templates/:id/analyze
POST /templates/suggestions
```

### Response Format
All endpoints return responses in this format:
```json
{
  "success": true,
  "data": { /* response data */ },
  "error": { /* error details if success=false */ },
  "metadata": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "version": "1.0.0",
    "requestId": "abc123"
  }
}
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Service port | 5002 | No |
| `NODE_ENV` | Environment | development | No |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes |
| `OPENAI_MODEL` | Model to use | gpt-3.5-turbo | No |
| `AI_TEMPERATURE` | AI creativity (0-1) | 0.7 | No |
| `AI_MAX_TOKENS` | Max response tokens | 2000 | No |
| `REDIS_URL` | Redis connection | - | No |
| `RATE_LIMIT_SUGGESTIONS` | Suggestions per minute | 30 | No |
| `RATE_LIMIT_GENERATION` | Generations per minute | 10 | No |

### Rate Limiting

The service implements rate limiting to prevent abuse:

- **Suggestions**: 30 requests per minute per IP
- **Content Generation**: 10 requests per minute per IP
- **Other endpoints**: Standard rate limits apply

Rate limits can be configured via environment variables.

### Caching

Redis caching is optional but recommended for production:

- **Brand voice analysis**: Cached for 1 hour
- **Template data**: Cached for 6 hours
- **Suggestion patterns**: Cached for 30 minutes

## Architecture

### Service Structure
```
src/
├── index.ts              # Main application entry
├── types/                # TypeScript type definitions
├── services/             # Core business logic
│   ├── AIService.ts      # OpenAI integration
│   ├── BrandVoiceService.ts
│   ├── TemplateService.ts
│   └── ContentAdaptationService.ts
├── routes/               # API route handlers
└── utils/                # Utility functions
```

### Key Components

1. **AIService**: Manages OpenAI API integration and content generation
2. **BrandVoiceService**: Handles brand voice training and analysis
3. **TemplateService**: Manages content templates and structure
4. **ContentAdaptationService**: Adapts content for different formats

### Integration Points

- **Content API**: Integrates with main CMS content endpoints
- **Webhook System**: Sends notifications on content changes
- **Analytics**: Tracks usage and performance metrics

## Development

### Available Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm run start        # Start production server
npm run test         # Run test suite
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript type checking
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Standard configuration
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Debugging

1. **VS Code Launch Configuration**
   ```json
   {
     "type": "node",
     "request": "launch",
     "name": "Debug AI Assistant",
     "program": "${workspaceFolder}/src/index.ts",
     "outFiles": ["${workspaceFolder}/dist/**/*.js"],
     "runtimeArgs": ["--loader", "ts-node/esm"],
     "env": {
       "NODE_ENV": "development"
     }
   }
   ```

2. **Debug Logging**
   ```bash
   LOG_LEVEL=debug npm run dev
   ```

## Production Deployment

### Docker Production

1. **Build production image**
   ```bash
   docker build -f Dockerfile.prod -t ai-writing-assistant:latest .
   ```

2. **Run production container**
   ```bash
   docker run -d \
     --name ai-writing-assistant \
     -p 5002:5002 \
     --env-file .env.production \
     ai-writing-assistant:latest
   ```

### PM2 Deployment

```bash
# Install PM2
npm install -g pm2

# Start with ecosystem config
pm2 start ecosystem.config.js --env production

# Monitor
pm2 monit

# View logs
pm2 logs ai-writing-assistant
```

### Health Monitoring

The service exposes health check endpoints:

- `/health` - Basic health status
- `/metrics` - Performance metrics (if enabled)

### Security Considerations

1. **API Authentication**: Implement proper API key or JWT authentication
2. **Rate Limiting**: Configure appropriate rate limits for your use case
3. **Input Validation**: All inputs are validated using Joi schemas
4. **CORS Configuration**: Configure CORS for your domains
5. **Secrets Management**: Use environment variables or secret management systems

## Troubleshooting

### Common Issues

1. **OpenAI API Key Issues**
   ```bash
   # Verify API key is set
   echo $OPENAI_API_KEY
   
   # Test API connectivity
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
   ```

2. **Memory Issues**
   ```bash
   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" npm run dev
   ```

3. **Rate Limit Exceeded**
   - Check your OpenAI usage limits
   - Implement request queuing for high-volume applications

4. **Redis Connection Issues**
   ```bash
   # Test Redis connectivity
   redis-cli ping
   ```

### Performance Optimization

1. **Caching**: Enable Redis for better performance
2. **Request Batching**: Batch multiple suggestions for efficiency
3. **Connection Pooling**: Configure appropriate connection limits
4. **Memory Management**: Monitor memory usage and tune garbage collection

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## License

This project is part of the CMS Automation Platform and follows the same license terms.

## Support

- **Documentation**: See API documentation at `/`
- **Issues**: Report issues in the main CMS repository
- **Discussions**: Join development discussions

---

**Built with ❤️ for intelligent content management**