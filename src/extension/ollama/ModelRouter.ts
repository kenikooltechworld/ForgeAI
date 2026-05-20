export interface ModelCapability {
  modelId: string;
  name: string;
  strengths: ModelStrength[];
  contextWindow: number;
  avgLatencyMs: number;
  costPer1kTokens: number;
  supportsStreaming: boolean;
}

export type ModelStrength =
  | 'spec-authoring'
  | 'multi-file-edits'
  | 'complex-refactor'
  | 'inline-completion'
  | 'batch-generation'
  | 'lint-fixes'
  | 'latency-sensitive'
  | 'reasoning'
  | 'creative-writing'
  | 'code-generation';

export type TaskType =
  | 'spec-requirements'
  | 'spec-design'
  | 'spec-tasks'
  | 'spec-bugfix'
  | 'code-generation'
  | 'code-refactor'
  | 'inline-completion'
  | 'test-generation'
  | 'documentation'
  | 'drift-detection';

/** Maps task types to the most relevant model strengths */
const TASK_TO_STRENGTHS: Record<TaskType, ModelStrength[]> = {
  'spec-requirements': ['spec-authoring', 'reasoning'],
  'spec-design': ['spec-authoring', 'complex-refactor', 'reasoning'],
  'spec-tasks': ['spec-authoring', 'batch-generation'],
  'spec-bugfix': ['spec-authoring', 'complex-refactor', 'reasoning'],
  'code-generation': ['multi-file-edits', 'batch-generation'],
  'code-refactor': ['complex-refactor', 'multi-file-edits'],
  'inline-completion': ['inline-completion', 'latency-sensitive'],
  'test-generation': ['batch-generation', 'lint-fixes'],
  documentation: ['creative-writing', 'batch-generation'],
  'drift-detection': ['reasoning', 'spec-authoring'],
};

/** Default model registry based on Kiro's documented routing preferences */
const DEFAULT_REGISTRY: ModelCapability[] = [
  {
    modelId: 'claude-sonnet',
    name: 'Claude Sonnet',
    strengths: ['spec-authoring', 'multi-file-edits', 'complex-refactor', 'reasoning'],
    contextWindow: 200000,
    avgLatencyMs: 2500,
    costPer1kTokens: 0.003,
    supportsStreaming: true,
  },
  {
    modelId: 'amazon-nova',
    name: 'Amazon Nova',
    strengths: ['inline-completion', 'batch-generation', 'lint-fixes', 'latency-sensitive'],
    contextWindow: 128000,
    avgLatencyMs: 800,
    costPer1kTokens: 0.0008,
    supportsStreaming: true,
  },
  {
    modelId: 'qwen-coder',
    name: 'Qwen Coder',
    strengths: ['code-generation', 'multi-file-edits', 'batch-generation'],
    contextWindow: 128000,
    avgLatencyMs: 1200,
    costPer1kTokens: 0.001,
    supportsStreaming: true,
  },
  {
    modelId: 'deepseek-chat',
    name: 'DeepSeek Chat',
    strengths: ['reasoning', 'complex-refactor', 'spec-authoring'],
    contextWindow: 64000,
    avgLatencyMs: 1500,
    costPer1kTokens: 0.0005,
    supportsStreaming: true,
  },
];

export interface RoutingDecision {
  modelId: string;
  reason: string;
  estimatedLatencyMs: number;
  estimatedCostPer1k: number;
}

export class ModelRouter {
  private registry = new Map<string, ModelCapability>();
  private latencyHistory = new Map<string, number[]>();

  constructor() {
    for (const model of DEFAULT_REGISTRY) {
      this.registry.set(model.modelId, model);
    }
  }

  register(model: ModelCapability): void {
    this.registry.set(model.modelId, model);
  }

  /** Route a task to the optimal model based on capability match, latency, and cost */
  route(task: TaskType, preferCostOptimized = false): RoutingDecision {
    const targetStrengths = TASK_TO_STRENGTHS[task];
    const candidates = Array.from(this.registry.values());

    if (candidates.length === 0) {
      return {
        modelId: 'default',
        reason: 'No models registered; falling back to default',
        estimatedLatencyMs: 2000,
        estimatedCostPer1k: 0,
      };
    }

    const scored = candidates.map((m) => {
      // Count how many target strengths this model has
      const matchedStrengths = targetStrengths.filter((s) => m.strengths.includes(s));
      const matchScore = matchedStrengths.length / targetStrengths.length;

      // Latency score: lower is better, normalized
      const avgLatency = this.getAvgLatency(m.modelId, m.avgLatencyMs);
      const latencyScore = 1 / (1 + avgLatency / 1000);

      // Cost score: lower is better, normalized
      const costScore = 1 / (1 + m.costPer1kTokens * 100);

      // Weighted composite score
      const weights = preferCostOptimized
        ? { match: 0.4, latency: 0.2, cost: 0.4 }
        : { match: 0.6, latency: 0.25, cost: 0.15 };

      const score =
        matchScore * weights.match + latencyScore * weights.latency + costScore * weights.cost;

      return { model: m, score, matchedStrengths };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      modelId: best.model.modelId,
      reason: `Best match for "${task}" — matched strengths: ${best.matchedStrengths.join(', ')} | latency: ${best.model.avgLatencyMs}ms | cost: $${best.model.costPer1kTokens}/1k tokens`,
      estimatedLatencyMs: best.model.avgLatencyMs,
      estimatedCostPer1k: best.model.costPer1kTokens,
    };
  }

  /** Record actual latency for future routing decisions */
  recordLatency(modelId: string, latencyMs: number): void {
    const history = this.latencyHistory.get(modelId) ?? [];
    history.push(latencyMs);
    // Keep last 20 measurements
    if (history.length > 20) history.shift();
    this.latencyHistory.set(modelId, history);
  }

  /** List all registered models */
  listModels(): ModelCapability[] {
    return Array.from(this.registry.values());
  }

  private getAvgLatency(modelId: string, fallback: number): number {
    const history = this.latencyHistory.get(modelId);
    if (!history || history.length === 0) return fallback;
    return history.reduce((a, b) => a + b, 0) / history.length;
  }
}
