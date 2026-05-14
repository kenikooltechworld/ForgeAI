import { RecoveryExecutor } from '../RecoveryExecutor';
import { matchErrorPattern } from '../ErrorPatterns';
import { createMockToolRegistry } from '../../../__tests__/testUtils';

describe('RecoveryExecutor (Phase 3)', () => {
  test('matchErrorPattern recognizes missing dependency', () => {
    const error = "Error: Cannot find module 'express'";
    const match = matchErrorPattern(error);

    expect(match.errorPattern).not.toBeNull();
    expect(match.errorPattern?.id).toBe('missing_dependency');
    expect(match.recovery).not.toBeNull();
    expect(match.recovery?.name).toContain('missing_dependency');
  });

  test('executeRecovery runs recovery steps for a matched error', async () => {
    const mockRegistry = createMockToolRegistry();

    // Ensure tool calls do not throw and can be asserted
    jest.spyOn(mockRegistry, 'executeTool').mockResolvedValue({ ok: true });

    const executor = new RecoveryExecutor(mockRegistry);

    const error = "Cannot find module 'express'";
    const result = await executor.executeRecovery(error);

    expect(result.succeeded).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(1);

    // Recovery steps for missing_dependency includes forgeai_readFile + forgeai_runCommand
    // (ToolRegistry will accept both)
    const toolNames = result.steps.map((s) => s.tool);
    expect(toolNames).toContain('forgeai_readFile');
    expect(toolNames).toContain('forgeai_runCommand');
  });

  test('executeRecovery returns failed when no pattern matches', async () => {
    const mockRegistry = createMockToolRegistry();
    jest.spyOn(mockRegistry, 'executeTool').mockResolvedValue({ ok: true });

    const executor = new RecoveryExecutor(mockRegistry);

    const result = await executor.executeRecovery('Some totally unknown error');

    expect(result.succeeded).toBe(false);
    expect(result.steps).toEqual([]);
    expect(result.errorMessage).toContain('unknown error');
  });
});
