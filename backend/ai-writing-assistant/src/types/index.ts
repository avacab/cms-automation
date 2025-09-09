// Core types for AI Writing Assistant

export interface BrandVoice {
  id: string;
  name: string;
  tone: string[];
  writingStyle: {
    formality: 'formal' | 'casual' | 'conversational';
    complexity: 'simple' | 'moderate' | 'complex';
    sentenceLength: 'short' | 'medium' | 'long' | 'mixed';
    vocabulary: 'basic' | 'advanced' | 'technical' | 'creative';
  };
  brandValues: string[];
  avoidWords: string[];
  preferredWords: string[];
  exampleTexts: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentTemplate {
  id: string;
  name: string;
  type: 'blog-post' | 'email' | 'social-media' | 'product-description' | 'landing-page' | 'newsletter' | 'custom';
  structure: TemplateSection[];
  variables: TemplateVariable[];
  brandVoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateSection {
  id: string;
  name: string;
  description: string;
  order: number;
  required: boolean;
  suggestions: string[];
  wordCountTarget?: {
    min: number;
    max: number;
  };
}

export interface TemplateVariable {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multi-select';
  required: boolean;
  options?: string[];
  defaultValue?: any;
}

export interface WritingSuggestion {
  id: string;
  type: 'grammar' | 'style' | 'tone' | 'clarity' | 'engagement' | 'seo' | 'brand-voice';
  severity: 'low' | 'medium' | 'high';
  position: {
    start: number;
    end: number;
  };
  original: string;
  suggestion: string;
  reason: string;
  confidence: number;
}

export interface ContentAnalysis {
  readability: {
    score: number;
    level: string;
    suggestions: string[];
  };
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  brandVoiceMatch: {
    score: number;
    deviations: string[];
    suggestions: string[];
  };
  keywords: {
    primary: string[];
    secondary: string[];
    density: Record<string, number>;
  };
  structure: {
    headings: number;
    paragraphs: number;
    sentences: number;
    averageWordsPerSentence: number;
    suggestions: string[];
  };
}

export interface AIGenerationRequest {
  type: 'complete' | 'continue' | 'rewrite' | 'improve' | 'adapt';
  input: {
    text?: string;
    prompt?: string;
    context?: string;
    targetFormat?: string;
  };
  options: {
    brandVoiceId?: string;
    templateId?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    targetLength?: number;
    targetTone?: string[];
    keywords?: string[];
  };
}

export interface AIGenerationResponse {
  id: string;
  text: string;
  confidence: number;
  alternatives?: string[];
  metadata: {
    tokensUsed: number;
    processingTime: number;
    model: string;
    brandVoiceMatch?: number;
    templateMatch?: number;
  };
  suggestions?: WritingSuggestion[];
}

export interface ContentAdaptationRequest {
  originalText: string;
  targetFormats: Array<{
    format: string;
    platform?: string;
    constraints?: {
      maxLength?: number;
      tone?: string;
      includeHashtags?: boolean;
      includeEmojis?: boolean;
    };
  }>;
  brandVoiceId?: string;
}

export interface ContentAdaptationResponse {
  originalText: string;
  adaptations: Array<{
    format: string;
    platform?: string;
    text: string;
    metadata: {
      length: number;
      tone: string;
      confidence: number;
    };
  }>;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    version: string;
    requestId: string;
  };
}

// Configuration types
export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'cohere' | 'local';
  model: string;
  apiKey: string;
  baseURL?: string;
  defaultParams: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
}

export interface ServiceConfig {
  port: number;
  corsOrigin: string;
  redisUrl?: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  ai: AIConfig;
  rateLimits: {
    suggestions: {
      windowMs: number;
      max: number;
    };
    generation: {
      windowMs: number;
      max: number;
    };
  };
}