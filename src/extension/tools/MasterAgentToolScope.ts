/**
 * Master agent tool scope.
 * The master agent's only job is to delegate work via forgeai_spawnAgent
 * and orchestrate spec-driven development. It must never execute
 * specialized work directly (research, coding, file edits, etc.).
 */

export const MASTER_AGENT_TOOL_NAMES = [
  'forgeai_spawnAgent',
  'forgeai_createSpec',
  'forgeai_readSpec',
  'forgeai_writeSpecArtifact',
  'forgeai_listSpecs',
  'forgeai_continueSpec',
  'forgeai_checkDrift',
  'forgeai_deleteSpec',
  'forgeai_startTask',
  'forgeai_runAllTasks',
  'forgeai_approveSpec',
  'forgeai_getDiagnostics',
  'forgeai_getErrors',
  'forgeai_listFiles',
  'forgeai_listDirectory',
] as const;

export type MasterAgentToolName = (typeof MASTER_AGENT_TOOL_NAMES)[number];
