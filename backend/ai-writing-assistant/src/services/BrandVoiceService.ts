import { BrandVoice, ContentAnalysis } from '../types/index.js';
import * as natural from 'natural';
import Sentiment from 'sentiment';
import compromise from 'compromise';

export class BrandVoiceService {
  private sentiment: any;
  
  constructor() {
    this.sentiment = new Sentiment();
  }

  /**
   * Train brand voice from existing content samples
   */
  async trainBrandVoice(name: string, contentSamples: string[]): Promise<BrandVoice> {
    const analysis = await this.analyzeContentSamples(contentSamples);
    
    const brandVoice: BrandVoice = {
      id: this.generateId(),
      name,
      tone: analysis.dominantTones,
      writingStyle: analysis.writingStyle,
      brandValues: analysis.extractedValues,
      avoidWords: analysis.overusedWords,
      preferredWords: analysis.characteristicWords,
      exampleTexts: contentSamples.slice(0, 5), // Store up to 5 examples
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return brandVoice;
  }

  /**
   * Analyze content samples to extract brand voice characteristics
   */
  private async analyzeContentSamples(samples: string[]) {
    const combinedText = samples.join(' ');
    const doc = compromise(combinedText);
    
    // Analyze tone and sentiment
    const sentimentAnalysis = this.sentiment.analyze(combinedText);
    const dominantTones = this.extractTones(sentimentAnalysis, combinedText);
    
    // Analyze writing style
    const sentences = doc.sentences().out('array');
    const avgSentenceLength = this.calculateAverageLength(sentences);
    const complexity = this.assessComplexity(combinedText);
    const formality = this.assessFormality(doc);
    
    // Extract characteristic words and phrases
    const wordFreq = this.calculateWordFrequency(combinedText);
    const characteristicWords = this.extractCharacteristicWords(wordFreq);
    const overusedWords = this.extractOverusedWords(wordFreq);
    
    // Extract brand values (simplified heuristic approach)
    const extractedValues = this.extractBrandValues(combinedText);

    return {
      dominantTones,
      writingStyle: {
        formality: formality,
        complexity: complexity,
        sentenceLength: avgSentenceLength,
        vocabulary: this.assessVocabulary(wordFreq)
      },
      extractedValues,
      characteristicWords,
      overusedWords
    };
  }

  /**
   * Check how well content matches a brand voice
   */
  async checkBrandVoiceMatch(content: string, brandVoice: BrandVoice): Promise<ContentAnalysis['brandVoiceMatch']> {
    const doc = compromise(content);
    const contentAnalysis = await this.analyzeContent(content);
    
    let score = 100;
    const deviations: string[] = [];
    const suggestions: string[] = [];

    // Check tone match
    const contentTones = this.extractTones(this.sentiment.analyze(content), content);
    const toneMatch = this.calculateToneMatch(contentTones, brandVoice.tone);
    if (toneMatch < 0.7) {
      score -= 20;
      deviations.push(`Tone mismatch: Expected ${brandVoice.tone.join(', ')}, found ${contentTones.join(', ')}`);
      suggestions.push(`Adjust tone to be more ${brandVoice.tone.join(' and ')}`);
    }

    // Check for avoided words
    const avoidedWordsFound = this.findAvoidedWords(content, brandVoice.avoidWords);
    if (avoidedWordsFound.length > 0) {
      score -= avoidedWordsFound.length * 5;
      deviations.push(`Using avoided words: ${avoidedWordsFound.join(', ')}`);
      suggestions.push(`Replace avoided words with preferred alternatives`);
    }

    // Check writing style
    const sentences = doc.sentences().out('array');
    const avgLength = this.calculateAverageLength(sentences);
    const expectedLength = brandVoice.writingStyle.sentenceLength;
    
    if (!this.matchesExpectedLength(avgLength, expectedLength)) {
      score -= 15;
      deviations.push(`Sentence length doesn't match brand style`);
      suggestions.push(`Adjust sentence length to match ${expectedLength} style`);
    }

    // Check formality level
    const contentFormality = this.assessFormality(doc);
    if (contentFormality !== brandVoice.writingStyle.formality) {
      score -= 10;
      deviations.push(`Formality mismatch: Expected ${brandVoice.writingStyle.formality}, found ${contentFormality}`);
      suggestions.push(`Adjust formality to be more ${brandVoice.writingStyle.formality}`);
    }

    return {
      score: Math.max(0, score),
      deviations,
      suggestions
    };
  }

  /**
   * Generate writing suggestions based on brand voice
   */
  async generateBrandVoiceSuggestions(content: string, brandVoice: BrandVoice) {
    const suggestions = [];
    const words = content.toLowerCase().split(/\s+/);
    
    // Find brand voice violations
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w]/g, '');
      
      if (brandVoice.avoidWords.includes(word)) {
        const preferredAlternative = this.findPreferredAlternative(word, brandVoice.preferredWords);
        suggestions.push({
          id: this.generateId(),
          type: 'brand-voice' as const,
          severity: 'medium' as const,
          position: { start: content.indexOf(word), end: content.indexOf(word) + word.length },
          original: word,
          suggestion: preferredAlternative || `Consider replacing "${word}"`,
          reason: `"${word}" is not aligned with brand voice`,
          confidence: 0.8
        });
      }
    }

    return suggestions;
  }

  // Helper methods
  private analyzeContent(content: string): ContentAnalysis {
    const doc = compromise(content);
    const sentences = doc.sentences().out('array');
    const words = doc.terms().out('array');
    
    return {
      readability: this.calculateReadability(content),
      sentiment: this.analyzeSentiment(content),
      brandVoiceMatch: { score: 0, deviations: [], suggestions: [] }, // Will be filled separately
      keywords: this.extractKeywords(content),
      structure: {
        headings: (content.match(/^#{1,6}\s/gm) || []).length,
        paragraphs: content.split('\n\n').length,
        sentences: sentences.length,
        averageWordsPerSentence: words.length / sentences.length,
        suggestions: this.generateStructureSuggestions(content)
      }
    };
  }

  private extractTones(sentimentResult: any, text: string): string[] {
    const tones = [];
    
    if (sentimentResult.score > 2) tones.push('positive');
    if (sentimentResult.score < -2) tones.push('negative');
    if (Math.abs(sentimentResult.score) <= 2) tones.push('neutral');
    
    // Additional tone detection based on word patterns
    if (text.includes('!') || /\b(amazing|fantastic|incredible)\b/i.test(text)) {
      tones.push('enthusiastic');
    }
    if (/\b(professional|corporate|formal)\b/i.test(text)) {
      tones.push('professional');
    }
    if (/\b(friendly|casual|relaxed)\b/i.test(text)) {
      tones.push('friendly');
    }
    
    return [...new Set(tones)];
  }

  private calculateAverageLength(sentences: string[]): 'short' | 'medium' | 'long' | 'mixed' {
    const lengths = sentences.map(s => s.split(' ').length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    
    if (avgLength < 10) return 'short';
    if (avgLength > 20) return 'long';
    return 'medium';
  }

  private assessComplexity(text: string): 'simple' | 'moderate' | 'complex' {
    const doc = compromise(text);
    const syllableCount = doc.terms().out('array').reduce((total, word) => {
      return total + this.countSyllables(word);
    }, 0);
    
    const wordCount = doc.terms().out('array').length;
    const avgSyllablesPerWord = syllableCount / wordCount;
    
    if (avgSyllablesPerWord < 1.5) return 'simple';
    if (avgSyllablesPerWord > 2.0) return 'complex';
    return 'moderate';
  }

  private assessFormality(doc: any): 'formal' | 'casual' | 'conversational' {
    const text = doc.text();
    
    // Formal indicators
    const formalWords = ['therefore', 'furthermore', 'consequently', 'nevertheless', 'however'];
    const contractions = ["don't", "can't", "won't", "it's", "you're", "we're"];
    
    const formalCount = formalWords.filter(word => text.toLowerCase().includes(word)).length;
    const contractionCount = contractions.filter(contraction => text.toLowerCase().includes(contraction)).length;
    
    if (formalCount > contractionCount && !text.includes('?') && !text.includes('!')) {
      return 'formal';
    }
    if (contractionCount > 0 || text.includes('?')) {
      return 'conversational';
    }
    return 'casual';
  }

  private assessVocabulary(wordFreq: Map<string, number>): 'basic' | 'advanced' | 'technical' | 'creative' {
    const words = Array.from(wordFreq.keys());
    const technicalWords = words.filter(word => word.length > 10 || /\b(system|process|implement|algorithm)\b/i.test(word));
    const creativeWords = words.filter(word => /\b(vibrant|innovative|dynamic|compelling)\b/i.test(word));
    
    if (technicalWords.length > words.length * 0.1) return 'technical';
    if (creativeWords.length > words.length * 0.05) return 'creative';
    if (words.some(word => word.length > 12)) return 'advanced';
    return 'basic';
  }

  private calculateWordFrequency(text: string): Map<string, number> {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const frequency = new Map<string, number>();
    
    words.forEach(word => {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });
    
    return frequency;
  }

  private extractCharacteristicWords(wordFreq: Map<string, number>): string[] {
    const sorted = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
    
    // Filter out common stop words
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    return sorted.filter(word => !stopWords.has(word) && word.length > 3);
  }

  private extractOverusedWords(wordFreq: Map<string, number>): string[] {
    const threshold = 10;
    return Array.from(wordFreq.entries())
      .filter(([word, count]) => count > threshold && word.length > 3)
      .map(([word]) => word);
  }

  private extractBrandValues(text: string): string[] {
    const values = [];
    const valueKeywords = {
      'innovation': /\b(innovative|cutting-edge|revolutionary|breakthrough)\b/i,
      'quality': /\b(quality|excellence|premium|superior)\b/i,
      'trust': /\b(reliable|trustworthy|dependable|secure)\b/i,
      'sustainability': /\b(sustainable|eco-friendly|green|environment)\b/i,
      'customer-focus': /\b(customer|client|service|support)\b/i
    };
    
    Object.entries(valueKeywords).forEach(([value, regex]) => {
      if (regex.test(text)) {
        values.push(value);
      }
    });
    
    return values;
  }

  private calculateToneMatch(contentTones: string[], brandTones: string[]): number {
    const intersection = contentTones.filter(tone => brandTones.includes(tone));
    return intersection.length / Math.max(brandTones.length, 1);
  }

  private findAvoidedWords(content: string, avoidWords: string[]): string[] {
    const contentWords = content.toLowerCase().match(/\b\w+\b/g) || [];
    return avoidWords.filter(word => contentWords.includes(word.toLowerCase()));
  }

  private matchesExpectedLength(actual: 'short' | 'medium' | 'long' | 'mixed', expected: 'short' | 'medium' | 'long' | 'mixed'): boolean {
    return actual === expected || expected === 'mixed';
  }

  private findPreferredAlternative(word: string, preferredWords: string[]): string | null {
    // Simple semantic matching - in production, use more sophisticated NLP
    const semanticallyRelated = preferredWords.find(preferred => 
      natural.JaroWinklerDistance(word, preferred) > 0.7
    );
    return semanticallyRelated || null;
  }

  private calculateReadability(content: string): { score: number; level: string; suggestions: string[] } {
    // Simplified Flesch Reading Ease calculation
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.match(/\b\w+\b/g) || [];
    const syllables = words.reduce((total, word) => total + this.countSyllables(word), 0);
    
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    let level = 'College';
    if (score >= 90) level = 'Very Easy';
    else if (score >= 80) level = 'Easy';
    else if (score >= 70) level = 'Fairly Easy';
    else if (score >= 60) level = 'Standard';
    else if (score >= 50) level = 'Fairly Difficult';
    else if (score >= 30) level = 'Difficult';
    
    const suggestions = [];
    if (score < 50) {
      suggestions.push('Consider shorter sentences to improve readability');
    }
    if (avgSyllablesPerWord > 1.5) {
      suggestions.push('Use simpler words where possible');
    }
    
    return { score, level, suggestions };
  }

  private analyzeSentiment(content: string): { score: number; label: 'positive' | 'neutral' | 'negative'; confidence: number } {
    const result = this.sentiment.analyze(content);
    const normalizedScore = Math.max(-1, Math.min(1, result.score / 10));
    
    let label: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (normalizedScore > 0.1) label = 'positive';
    else if (normalizedScore < -0.1) label = 'negative';
    
    return {
      score: normalizedScore,
      label,
      confidence: Math.min(1, Math.abs(normalizedScore) + 0.5)
    };
  }

  private extractKeywords(content: string): { primary: string[]; secondary: string[]; density: Record<string, number> } {
    const doc = compromise(content);
    const terms = doc.terms();
    
    // Extract nouns and adjectives as potential keywords
    const nouns = terms.nouns().out('array');
    const adjectives = terms.adjectives().out('array');
    
    const frequency = this.calculateWordFrequency(content);
    const density: Record<string, number> = {};
    
    const totalWords = content.match(/\b\w+\b/g)?.length || 1;
    frequency.forEach((count, word) => {
      density[word] = count / totalWords;
    });
    
    const sortedKeywords = Array.from(frequency.entries())
      .filter(([word]) => word.length > 3)
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
    
    return {
      primary: sortedKeywords.slice(0, 5),
      secondary: sortedKeywords.slice(5, 15),
      density
    };
  }

  private generateStructureSuggestions(content: string): string[] {
    const suggestions = [];
    const headings = (content.match(/^#{1,6}\s/gm) || []).length;
    const paragraphs = content.split('\n\n').length;
    
    if (headings === 0 && content.length > 500) {
      suggestions.push('Add headings to improve content structure');
    }
    if (paragraphs < 3 && content.length > 300) {
      suggestions.push('Break content into more paragraphs for better readability');
    }
    
    return suggestions;
  }

  private countSyllables(word: string): number {
    // Simplified syllable counting
    return word.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiouy]+/g, 'a').length;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}