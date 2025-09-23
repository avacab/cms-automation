import { EventEmitter } from 'events';
import { OptimizelyAuthService } from './OptimizelyAuthService.js';
import { FileStorage } from '../../../backend/api/src/storage/FileStorage';
import axios, { AxiosInstance } from 'axios';

interface ExperimentVariation {
  id: string;
  name: string;
  contentId: number;
  trafficAllocation: number; // Percentage 0-100
  properties: Record<string, any>;
  isControl?: boolean;
}

interface ExperimentConfig {
  name: string;
  description?: string;
  baseContentId: number;
  variations: ExperimentVariation[];
  trafficAllocation?: number; // Total traffic percentage
  audienceConditions?: any[];
  metrics?: ExperimentMetric[];
  startDate?: Date;
  endDate?: Date;
  status?: 'draft' | 'running' | 'paused' | 'completed';
}

interface ExperimentMetric {
  name: string;
  type: 'conversion' | 'revenue' | 'engagement';
  eventName: string;
  goalValue?: number;
  isRevenue?: boolean;
}

interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  baseContentId: number;
  variations: ExperimentVariation[];
  trafficAllocation: number;
  metrics: ExperimentMetric[];
  startDate: string; // Changed to string for JSON serialization
  endDate?: string; // Changed to string for JSON serialization
  createdDate: string; // Changed to string for JSON serialization
  created_at: string; // Add for FileStorage compatibility
  updated_at: string; // Add for FileStorage compatibility
  results?: ExperimentResults;
}

interface ExperimentResults {
  totalVisitors: number;
  totalConversions: number;
  conversionRate: number;
  confidence: number;
  statisticalSignificance: boolean;
  winningVariation?: string;
  variationResults: VariationResult[];
  lastUpdated: Date;
}

interface VariationResult {
  variationId: string;
  visitors: number;
  conversions: number;
  conversionRate: number;
  revenue?: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  relativeLift: number; // Compared to control
  pValue: number;
}

interface CreateExperimentRequest {
  config: ExperimentConfig;
  startImmediately?: boolean;
}

interface ExperimentOperationResult {
  success: boolean;
  experimentId?: string;
  error?: string;
  warnings?: string[];
}

export class OptimizelyExperimentService extends EventEmitter {
  private authService: OptimizelyAuthService;
  private httpClient: AxiosInstance;
  private apiEndpoint: string;
  private experimentsStorage: FileStorage<Experiment>;

  constructor(authService: OptimizelyAuthService, apiEndpoint: string) {
    super();
    this.authService = authService;
    this.apiEndpoint = apiEndpoint;
    this.experimentsStorage = new FileStorage<Experiment>('optimizely_experiments');
    
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CMS-Automation-Optimizely-Experiments/1.0.0'
      }
    });

    this.setupRequestInterceptors();
  }

  /**
   * Create new A/B test experiment
   */
  async createExperiment(request: CreateExperimentRequest): Promise<ExperimentOperationResult> {
    try {
      this.emit('experiment_creation_started', { name: request.config.name });

      // Validate experiment configuration
      const validation = this.validateExperimentConfig(request.config);
      if (!validation.isValid) {
        return { success: false, error: validation.error, warnings: validation.warnings };
      }

      // Generate unique experiment ID
      const experimentId = this.generateExperimentId(request.config.name);

      // For Phase 1, we create a local experiment object
      // In Phase 2, this will integrate with Optimizely Experimentation API
      const experiment = await this.experimentsStorage.create({
        id: experimentId,
        name: request.config.name,
        description: request.config.description,
        status: request.startImmediately ? 'running' : 'draft',
        baseContentId: request.config.baseContentId,
        variations: request.config.variations,
        trafficAllocation: request.config.trafficAllocation || 100,
        metrics: request.config.metrics || [],
        startDate: request.config.startDate?.toISOString() || new Date().toISOString(),
        endDate: request.config.endDate?.toISOString(),
        createdDate: new Date().toISOString()
      });

      // Initialize results tracking and update experiment
      const results = {
        totalVisitors: 0,
        totalConversions: 0,
        conversionRate: 0,
        confidence: 0,
        statisticalSignificance: false,
        variationResults: experiment.variations.map(v => ({
          variationId: v.id,
          visitors: 0,
          conversions: 0,
          conversionRate: 0,
          revenue: 0,
          confidenceInterval: { lower: 0, upper: 0 },
          relativeLift: 0,
          pValue: 1.0
        })),
        lastUpdated: new Date()
      };

      await this.experimentsStorage.update(experiment.id, { results });

      this.emit('experiment_created', {
        experimentId,
        name: experiment.name,
        variationCount: experiment.variations.length,
        status: experiment.status
      });

      return { success: true, experimentId };

    } catch (error) {
      this.emit('experiment_creation_error', { error: error.message, config: request.config });
      return { success: false, error: error.message };
    }
  }

  /**
   * Start experiment
   */
  async startExperiment(experimentId: string): Promise<ExperimentOperationResult> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      if (experiment.status === 'running') {
        return { success: false, error: 'Experiment is already running' };
      }

      const updatedExperiment = await this.experimentsStorage.update(experimentId, {
        status: 'running',
        startDate: new Date().toISOString()
      });

      this.emit('experiment_started', {
        experimentId,
        name: experiment.name,
        startDate: updatedExperiment?.startDate
      });

      return { success: true, experimentId };

    } catch (error) {
      this.emit('experiment_start_error', { error: error.message, experimentId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop/pause experiment
   */
  async stopExperiment(experimentId: string, reason?: string): Promise<ExperimentOperationResult> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      const previousStatus = experiment.status;
      await this.experimentsStorage.update(experimentId, { status: 'paused' });

      this.emit('experiment_stopped', {
        experimentId,
        name: experiment.name,
        previousStatus,
        reason
      });

      return { success: true, experimentId };

    } catch (error) {
      this.emit('experiment_stop_error', { error: error.message, experimentId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Complete experiment and declare winner
   */
  async completeExperiment(experimentId: string, winningVariationId?: string): Promise<ExperimentOperationResult> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      // Calculate final results
      const finalResults = this.calculateExperimentResults(experiment);

      // Determine winning variation if not specified
      if (!winningVariationId && finalResults.winningVariation) {
        winningVariationId = finalResults.winningVariation;
      }

      // Update experiment with completion data
      await this.experimentsStorage.update(experimentId, {
        status: 'completed',
        endDate: new Date().toISOString(),
        results: finalResults
      });

      this.emit('experiment_completed', {
        experimentId,
        name: experiment.name,
        winningVariation: winningVariationId,
        results: finalResults
      });

      return { 
        success: true, 
        experimentId,
        warnings: finalResults.statisticalSignificance ? [] : ['Results may not be statistically significant']
      };

    } catch (error) {
      this.emit('experiment_completion_error', { error: error.message, experimentId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get experiment details
   */
  async getExperiment(experimentId: string): Promise<{ success: boolean; experiment?: Experiment; error?: string }> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      // Update results if experiment is running
      if (experiment.status === 'running') {
        const updatedResults = this.calculateExperimentResults(experiment);
        await this.experimentsStorage.update(experimentId, { results: updatedResults });
        experiment.results = updatedResults;
      }

      return { success: true, experiment };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * List all experiments
   */
  async listExperiments(filter?: {
    status?: string;
    contentId?: number;
    limit?: number;
  }): Promise<{ success: boolean; experiments?: Experiment[]; error?: string }> {
    try {
      const queryOptions: any = {
        orderBy: { field: 'createdDate', direction: 'desc' as const }
      };

      if (filter?.limit) {
        queryOptions.limit = filter.limit;
      }

      if (filter?.status) {
        queryOptions.where = { status: filter.status };
      }

      let experiments = await this.experimentsStorage.findAll(queryOptions);

      // Apply contentId filter (FileStorage doesn't support numeric filters well)
      if (filter?.contentId) {
        experiments = experiments.filter(exp => exp.baseContentId === filter.contentId);
      }

      return { success: true, experiments };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Record experiment event (visitor, conversion, etc.)
   */
  async recordEvent(
    experimentId: string,
    variationId: string,
    eventType: 'visitor' | 'conversion' | 'revenue',
    value?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment || !experiment.results) {
        return { success: false, error: 'Experiment not found or not initialized' };
      }

      const variationResult = experiment.results.variationResults.find(v => v.variationId === variationId);
      if (!variationResult) {
        return { success: false, error: 'Variation not found' };
      }

      // Update metrics based on event type
      switch (eventType) {
        case 'visitor':
          variationResult.visitors += 1;
          experiment.results.totalVisitors += 1;
          break;
          
        case 'conversion':
          variationResult.conversions += 1;
          experiment.results.totalConversions += 1;
          break;
          
        case 'revenue':
          if (value !== undefined) {
            variationResult.revenue = (variationResult.revenue || 0) + value;
          }
          break;
      }

      // Recalculate conversion rates and statistics
      this.updateVariationStatistics(variationResult);
      this.updateExperimentStatistics(experiment);

      experiment.results.lastUpdated = new Date();

      // Save updated experiment
      await this.experimentsStorage.update(experimentId, { results: experiment.results });

      this.emit('experiment_event_recorded', {
        experimentId,
        variationId,
        eventType,
        value
      });

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get experiment results with statistical analysis
   */
  async getExperimentResults(experimentId: string): Promise<{ success: boolean; results?: ExperimentResults; error?: string }> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      const results = this.calculateExperimentResults(experiment);
      
      return { success: true, results };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update experiment configuration
   */
  async updateExperiment(
    experimentId: string,
    updates: Partial<ExperimentConfig>
  ): Promise<ExperimentOperationResult> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      if (experiment.status === 'running') {
        return { success: false, error: 'Cannot update running experiment' };
      }

      // Prepare update data
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.trafficAllocation) updateData.trafficAllocation = updates.trafficAllocation;
      if (updates.endDate) updateData.endDate = updates.endDate.toISOString();
      if (updates.metrics) updateData.metrics = updates.metrics;

      await this.experimentsStorage.update(experimentId, updateData);

      this.emit('experiment_updated', { experimentId, updates });

      return { success: true, experimentId };

    } catch (error) {
      this.emit('experiment_update_error', { error: error.message, experimentId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete experiment
   */
  async deleteExperiment(experimentId: string, force: boolean = false): Promise<ExperimentOperationResult> {
    try {
      const experiment = await this.experimentsStorage.findById(experimentId);
      if (!experiment) {
        return { success: false, error: 'Experiment not found' };
      }

      if (experiment.status === 'running' && !force) {
        return { success: false, error: 'Cannot delete running experiment without force flag' };
      }

      await this.experimentsStorage.delete(experimentId);

      this.emit('experiment_deleted', { experimentId, name: experiment.name, force });

      return { success: true, experimentId };

    } catch (error) {
      this.emit('experiment_deletion_error', { error: error.message, experimentId });
      return { success: false, error: error.message };
    }
  }

  // Private helper methods

  private validateExperimentConfig(config: ExperimentConfig): {
    isValid: boolean;
    error?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    // Basic validation
    if (!config.name) {
      return { isValid: false, error: 'Experiment name is required' };
    }

    if (!config.variations || config.variations.length < 2) {
      return { isValid: false, error: 'At least 2 variations are required' };
    }

    // Validate traffic allocation
    const totalAllocation = config.variations.reduce((sum, v) => sum + v.trafficAllocation, 0);
    if (totalAllocation !== 100) {
      return { isValid: false, error: 'Variation traffic allocation must sum to 100%' };
    }

    // Check for control variation
    const hasControl = config.variations.some(v => v.isControl);
    if (!hasControl) {
      warnings.push('No control variation specified - first variation will be used as control');
      config.variations[0].isControl = true;
    }

    // Validate variation IDs are unique
    const variationIds = config.variations.map(v => v.id);
    const uniqueIds = new Set(variationIds);
    if (uniqueIds.size !== variationIds.length) {
      return { isValid: false, error: 'Variation IDs must be unique' };
    }

    return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  private generateExperimentId(name: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').substr(0, 20);
    return `exp_${nameSlug}_${timestamp}_${randomSuffix}`;
  }

  private calculateExperimentResults(experiment: Experiment): ExperimentResults {
    const results = experiment.results!;
    
    // Calculate overall metrics
    results.conversionRate = results.totalVisitors > 0 ? 
      (results.totalConversions / results.totalVisitors) * 100 : 0;

    // Update variation statistics
    results.variationResults.forEach(vResult => {
      this.updateVariationStatistics(vResult);
    });

    // Find control variation
    const controlVariation = experiment.variations.find(v => v.isControl);
    const controlResult = controlVariation ? 
      results.variationResults.find(vr => vr.variationId === controlVariation.id) : 
      results.variationResults[0];

    // Calculate relative lifts and p-values
    results.variationResults.forEach(vResult => {
      if (vResult !== controlResult && controlResult) {
        vResult.relativeLift = this.calculateRelativeLift(vResult, controlResult);
        vResult.pValue = this.calculatePValue(vResult, controlResult);
      }
    });

    // Determine statistical significance and winning variation
    const significantVariations = results.variationResults.filter(v => v.pValue < 0.05);
    results.statisticalSignificance = significantVariations.length > 0;
    
    if (results.statisticalSignificance) {
      // Find variation with highest conversion rate among significant results
      const winner = significantVariations.reduce((best, current) => 
        current.conversionRate > best.conversionRate ? current : best
      );
      results.winningVariation = winner.variationId;
    }

    // Calculate overall confidence
    results.confidence = results.statisticalSignificance ? 95 : 
      (results.totalVisitors > 100 ? 80 : Math.min(results.totalVisitors, 50));

    results.lastUpdated = new Date();

    return results;
  }

  private updateVariationStatistics(variationResult: VariationResult): void {
    // Calculate conversion rate
    variationResult.conversionRate = variationResult.visitors > 0 ? 
      (variationResult.conversions / variationResult.visitors) * 100 : 0;

    // Calculate confidence interval (simplified Wilson score interval)
    if (variationResult.visitors > 0) {
      const p = variationResult.conversions / variationResult.visitors;
      const n = variationResult.visitors;
      const z = 1.96; // 95% confidence level
      
      const center = p + (z * z) / (2 * n);
      const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
      const denominator = 1 + (z * z) / n;
      
      variationResult.confidenceInterval = {
        lower: Math.max(0, ((center - margin) / denominator) * 100),
        upper: Math.min(100, ((center + margin) / denominator) * 100)
      };
    }
  }

  private updateExperimentStatistics(experiment: Experiment): void {
    const results = experiment.results!;
    
    results.totalVisitors = results.variationResults.reduce((sum, v) => sum + v.visitors, 0);
    results.totalConversions = results.variationResults.reduce((sum, v) => sum + v.conversions, 0);
  }

  private calculateRelativeLift(variation: VariationResult, control: VariationResult): number {
    if (control.conversionRate === 0) return 0;
    return ((variation.conversionRate - control.conversionRate) / control.conversionRate) * 100;
  }

  private calculatePValue(variation: VariationResult, control: VariationResult): number {
    // Simplified z-test for proportions
    const p1 = variation.conversions / variation.visitors;
    const p2 = control.conversions / control.visitors;
    const n1 = variation.visitors;
    const n2 = control.visitors;
    
    if (n1 === 0 || n2 === 0) return 1.0;
    
    const pooledP = (variation.conversions + control.conversions) / (n1 + n2);
    const standardError = Math.sqrt(pooledP * (1 - pooledP) * (1/n1 + 1/n2));
    
    if (standardError === 0) return 1.0;
    
    const zScore = Math.abs(p1 - p2) / standardError;
    
    // Approximate p-value calculation (two-tailed)
    return 2 * (1 - this.normalCDF(zScore));
  }

  private normalCDF(x: number): number {
    // Approximation of the standard normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - prob : prob;
  }

  private setupRequestInterceptors(): void {
    this.httpClient.interceptors.request.use(
      async (config) => {
        try {
          const authHeaders = await this.authService.getAuthHeaders();
          config.headers = { ...config.headers, ...authHeaders };
        } catch (error) {
          return Promise.reject(new Error('Authentication failed for experiment service'));
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.emit('experiment_api_error', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ success: boolean; status?: any; error?: string }> {
    try {
      const totalExperiments = await this.experimentsStorage.count();
      const runningExperiments = await this.experimentsStorage.count({ where: { status: 'running' } });
      
      return {
        success: true,
        status: {
          connected: true,
          totalExperiments,
          runningExperiments,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}