/**
 * ForgeAI Spec-Driven Architecture
 *
 * Replaces the LangGraph orchestrator with a spec-based task execution system.
 * Specs are the source of truth — written before code, versioned with code.
 * Now includes Browser Mirror integration for visual validation.
 */

export * from './types';
export { SpecReader } from './SpecReader';
export { SpecTaskExecutor } from './SpecTaskExecutor';
export { ParallelTaskExecutor } from './ParallelTaskExecutor';
export { SpecComplianceChecker } from './SpecComplianceChecker';
export { UXSpecValidator } from './UXSpecValidator';
export { BrowserMirrorStream } from './BrowserMirrorStream';
export { HITLHandoffManager } from './HITLHandoffManager';
export { VisualRegressionTester } from './VisualRegressionTester';
export { BugFixOrchestrator, BugFixResult } from './BugFixOrchestrator';
export { ContextManager, OllamaMessage, CachedAgentResult } from './ContextManager';
export { SpecSyncEngine, SpecSyncReport } from './SpecSyncEngine';
export { HealthScanner, HealthCheckResult, HealthReport } from './HealthScanner';
export { MonitoringMode } from './MonitoringMode';
export { CodeReviewAgent } from './CodeReviewAgent';
export { E2EMapper } from './E2EMapper';
export { AccessibilityAuditor } from './AccessibilityAuditor';
export { SpecGenerator, type ProjectBuilderInput, type GeneratedSpec } from './SpecGenerator';
export { LanguageDetector } from '../language/LanguageDetector';
export { LanguageToolManager } from '../language/LanguageToolManager';
export { BuildConfigParser } from '../language/BuildConfigParser';
