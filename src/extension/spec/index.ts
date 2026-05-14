/**
 * ForgeAI Spec-Driven Architecture
 *
 * Replaces the LangGraph orchestrator with a spec-based task execution system.
 * Specs are the source of truth — written before code, versioned with code.
 */

export * from './types';
export { SpecReader } from './SpecReader';
export { SpecTaskExecutor } from './SpecTaskExecutor';
export { SpecComplianceChecker } from './SpecComplianceChecker';
