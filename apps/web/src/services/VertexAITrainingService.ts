/**
 * VertexAITrainingService.ts - ML Training Pipeline
 * 
 * Provides integration with Google Vertex AI for:
 * - Fine-tuning Gemini models
 * - Exporting training data
 * - Model versioning
 * - A/B testing infrastructure
 */

import { database } from './DatabaseService';
import { reinforcementLearning } from './ml/ReinforcementLearningService';

const VERTEX_API_BASE = import.meta.env['VITE_VERTEX_API_URL'] || '';

// ============================================
// TYPES
// ============================================

export interface TrainingDataset {
    id: string;
    feature: string;
    examples: TrainingExample[];
    createdAt: Date;
    sizeBytes: number;
}

export interface TrainingExample {
    input: string;
    output: string;
    context?: Record<string, any>;
    reward?: number;
}

export interface TrainingJob {
    id: string;
    datasetId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    startedAt?: Date;
    completedAt?: Date;
    modelId?: string;
    metrics?: TrainingMetrics;
}

export interface TrainingMetrics {
    loss: number;
    accuracy: number;
    epochs: number;
    examples: number;
}

export interface ModelVersion {
    id: string;
    name: string;
    version: number;
    createdAt: Date;
    metrics: TrainingMetrics;
    isActive: boolean;
}

// ============================================
// VERTEX AI TRAINING SERVICE
// ============================================

class VertexAITrainingServiceClass {
    private datasets: Map<string, TrainingDataset> = new Map();
    private jobs: Map<string, TrainingJob> = new Map();
    private models: Map<string, ModelVersion> = new Map();

    /**
     * Export training data from learning database
     */
    async exportTrainingData(feature: string): Promise<TrainingDataset> {
        const learningData = await database.exportLearningData(feature);
        const rlData = reinforcementLearning.getMetrics(feature);

        const examples: TrainingExample[] = learningData.map(d => ({
            input: JSON.stringify(d.input),
            output: JSON.stringify(d.output),
            reward: d.reward,
            context: {}
        }));

        const dataset: TrainingDataset = {
            id: `ds_${Date.now()}_${feature}`,
            feature,
            examples,
            createdAt: new Date(),
            sizeBytes: JSON.stringify(examples).length
        };

        this.datasets.set(dataset.id, dataset);
        return dataset;
    }

    /**
     * Create JSONL file for Vertex AI fine-tuning
     */
    exportAsJSONL(dataset: TrainingDataset): string {
        return dataset.examples
            .map(ex => JSON.stringify({
                input_text: ex.input,
                output_text: ex.output
            }))
            .join('\n');
    }

    /**
     * Submit training job to Vertex AI
     */
    async submitTrainingJob(datasetId: string): Promise<TrainingJob> {
        const dataset = this.datasets.get(datasetId);
        if (!dataset) {
            throw new Error(`Dataset ${datasetId} not found`);
        }

        const job: TrainingJob = {
            id: `job_${Date.now()}`,
            datasetId,
            status: 'pending',
            progress: 0
        };

        this.jobs.set(job.id, job);

        // If Vertex API is configured, submit to cloud
        if (VERTEX_API_BASE) {
            try {
                const response = await fetch(`${VERTEX_API_BASE}/training/jobs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dataset: this.exportAsJSONL(dataset),
                        feature: dataset.feature,
                        config: {
                            epochs: 3,
                            learningRate: 0.0001,
                            batchSize: 8
                        }
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    job.status = 'running';
                    job.startedAt = new Date();
                    console.log(`[Vertex] Training job submitted: ${result.jobId}`);
                }
            } catch (e) {
                console.warn('[Vertex] API not available, simulating training');
                this.simulateTraining(job);
            }
        } else {
            // Simulate training locally
            this.simulateTraining(job);
        }

        return job;
    }

    /**
     * Get training job status
     */
    getJobStatus(jobId: string): TrainingJob | null {
        return this.jobs.get(jobId) || null;
    }

    /**
     * List all model versions
     */
    getModelVersions(feature: string): ModelVersion[] {
        return Array.from(this.models.values())
            .filter(m => m.name.includes(feature))
            .sort((a, b) => b.version - a.version);
    }

    /**
     * Set active model version
     */
    setActiveModel(modelId: string): void {
        this.models.forEach(m => {
            m.isActive = m.id === modelId;
        });
    }

    /**
     * Get A/B test recommendation
     */
    getABTestRecommendation(): {
        shouldTest: boolean;
        currentModel: string;
        candidateModel: string;
        reason: string;
    } {
        const models = Array.from(this.models.values());
        const active = models.find(m => m.isActive);
        const latest = models.sort((a, b) => b.version - a.version)[0];

        if (!active || !latest || active.id === latest.id) {
            return {
                shouldTest: false,
                currentModel: active?.id || 'none',
                candidateModel: 'none',
                reason: 'No new model available'
            };
        }

        // Recommend A/B test if new model has better metrics
        if (latest.metrics.accuracy > active.metrics.accuracy) {
            return {
                shouldTest: true,
                currentModel: active.id,
                candidateModel: latest.id,
                reason: `New model has ${((latest.metrics.accuracy - active.metrics.accuracy) * 100).toFixed(1)}% better accuracy`
            };
        }

        return {
            shouldTest: false,
            currentModel: active.id,
            candidateModel: latest.id,
            reason: 'Current model is performing better'
        };
    }

    // ============================================
    // PRIVATE METHODS
    // ============================================

    private simulateTraining(job: TrainingJob): void {
        job.status = 'running';
        job.startedAt = new Date();

        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            job.progress = Math.min(100, progress);

            if (progress >= 100) {
                clearInterval(interval);
                job.status = 'completed';
                job.completedAt = new Date();
                job.metrics = {
                    loss: 0.15 + Math.random() * 0.1,
                    accuracy: 0.85 + Math.random() * 0.1,
                    epochs: 3,
                    examples: this.datasets.get(job.datasetId)?.examples.length || 0
                };

                // Create model version
                const modelId = `model_${Date.now()}`;
                this.models.set(modelId, {
                    id: modelId,
                    name: `${this.datasets.get(job.datasetId)?.feature || 'unknown'}_v${this.models.size + 1}`,
                    version: this.models.size + 1,
                    createdAt: new Date(),
                    metrics: job.metrics,
                    isActive: this.models.size === 0
                });

                job.modelId = modelId;
            }
        }, 500);
    }
}

// ============================================
// SINGLETON
// ============================================

export const vertexTraining = new VertexAITrainingServiceClass();
export default VertexAITrainingServiceClass;
