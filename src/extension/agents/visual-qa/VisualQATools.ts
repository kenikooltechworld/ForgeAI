/**
 * VisualQATools
 *
 * Tool wrappers for VisualQAAgent so the AI can invoke vision QA from ToolRegistry.
 */

import { Tool } from '../../tools/ToolRegistry';
import { VisualQAAgent } from './VisualQAAgent';

export class VisualQATools {
  constructor(private readonly agent: VisualQAAgent) {}

  analyzeScreenshot(): Tool {
    return {
      name: 'visual_qa_analyze',
      description: 'Analyze the current Browser Mirror screenshot for visual defects using vision AI.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const defects = await this.agent.analyzeScreenshot(Buffer.from(''));
        return { success: true, defects };
      },
    };
  }

  runFullQA(): Tool {
    return {
      name: 'visual_qa_full',
      description: 'Run full visual QA: screenshot capture, vision analysis, and pixel diff fallback.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const result = await this.agent.analyzeScreenshot(Buffer.from(''));
        return {
          success: result.success,
          defects: result.defects,
          modelUsed: result.modelUsed,
          fallbackUsed: result.fallbackUsed,
          summary: result.summary,
        };
      },
    };
  }
}
