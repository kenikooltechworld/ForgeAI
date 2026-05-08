/**
 * Executor Agent - Executes tasks using available tools
 */

import { BaseAgent } from './BaseAgent';
import { ToolRegistry } from '../tools/ToolRegistry';
import { OllamaClient } from '../ollama/OllamaClient';
import {
  ExecutorInput,
  ExecutorOutput,
  SelfEvaluation,
  CriticFeedback,
  Task,
  TaskStatus,
} from '../orchestrator/types';

/**
 * System prompt for Executor agent
 */
const EXECUTOR_SYSTEM_PROMPT = `You are an Executor agent. Your job is to implement tasks using available tools.

# Core Responsibilities
1. Execute tasks precisely as described
2. Use the right tools for each task type
3. Self-evaluate your work honestly before returning results
4. Apply feedback from the Critic to refine your work
5. Track all tools used during execution

# Available Tools
- **File operations**: forgeai_readFile, forgeai_writeFile, forgeai_listDirectory, forgeai_findFiles, forgeai_searchInFiles
- **Terminal**: forgeai_runCommand, forgeai_createTerminal
- **Git**: forgeai_gitStatus, forgeai_gitCommit
- **Diagnostics**: forgeai_getDiagnostics, forgeai_getErrors

# Task Type Guidelines

## read_code
- Use forgeai_readFile to read relevant source files
- Use forgeai_listDirectory to explore directory structure
- Use forgeai_searchInFiles to find specific patterns
- Return: file contents, structure overview, key findings

## analyze
- Use forgeai_readFile to read code being analyzed
- Use forgeai_getDiagnostics to check for existing errors
- Use forgeai_searchInFiles to find related code
- Return: analysis findings, identified issues, root causes

## generate_fix
- Use forgeai_readFile to understand current code
- Generate the fix using your knowledge
- Return: the complete fixed code content (ready to apply)

## run_tests
- Use forgeai_runCommand to execute test suite
- Parse test output for pass/fail counts
- Return: test results with pass/fail counts and error details

## apply_changes
- Use forgeai_writeFile to write the new/fixed code
- Verify the write succeeded
- Return: confirmation of changes applied

## verify
- Use forgeai_getDiagnostics to check for errors
- Use forgeai_runCommand to run a quick sanity check
- Return: verification results, any remaining issues

# Autonomy Rules
1. Use tools to accomplish tasks - don't ask for permission
2. If a tool fails, try an alternative approach
3. Be thorough but efficient
4. Self-evaluate honestly - don't overstate confidence

# Self-Evaluation Criteria
- **Confidence 0.9-1.0**: Task fully complete, all criteria met, no concerns
- **Confidence 0.7-0.9**: Task mostly complete, minor concerns
- **Confidence 0.5-0.7**: Task partially complete, significant concerns
- **Confidence < 0.5**: Task failed or incomplete

# Output Format
Return JSON with result and self-evaluation:
{
  "result": { ... task-specific result data ... },
  "selfEvaluation": {
    "confidence": 0.0-1.0,
    "concerns": ["concern 1", "concern 2"],
    "suggestions": ["suggestion 1"]
  }
}

# Refinement Rules
When you receive feedback from the Critic:
1. Read the requiredChanges carefully
2. Address each required change specifically
3. Don't just repeat the same work - actually improve it
4. Re-evaluate after applying changes`;

/**
 * Result from Ollama analysis
 */
interface OllamaAnalysisResult {
  result: any;
  selfEvaluation: SelfEvaluation;
}

/**
 * Executor Agent implementation
 */
export class ExecutorAgent extends BaseAgent {
  getName(): string {
    return 'Executor';
  }

  getCapabilities(): string[] {
    return [
      'Task execution',
      'Tool usage',
      'Self-evaluation',
      'Iterative refinement',
      'Code generation',
    ];
  }

  /**
   * Execute: Implement a task by routing to the appropriate handler
   */
  async execute(input: ExecutorInput): Promise<ExecutorOutput> {
    return this.executeWithErrorHandling(async () => {
      const startTime = Date.now();
      const toolsUsed: string[] = [];

      this.logInfo(`Executing task: ${input.task.id} (type: ${input.task.type})`);

      let result: any = null;

      try {
        // Route to appropriate handler based on task type
        switch (input.task.type) {
          case 'read_code':
            result = await this.executeReadCode(input, toolsUsed);
            break;
          case 'analyze':
            result = await this.executeAnalyze(input, toolsUsed);
            break;
          case 'generate_fix':
            result = await this.executeGenerateFix(input, toolsUsed);
            break;
          case 'run_tests':
            result = await this.executeRunTests(input, toolsUsed);
            break;
          case 'apply_changes':
            result = await this.executeApplyChanges(input, toolsUsed);
            break;
          case 'verify':
            result = await this.executeVerify(input, toolsUsed);
            break;
          default:
            throw new Error(`Unknown task type: ${(input.task as Task).type}`);
        }

        const duration = Date.now() - startTime;
        const selfEvaluation = this.selfEvaluate(result, input.task);

        // Map confidence to design.md status values: success | partial | failed
        let status: TaskStatus;
        if (selfEvaluation.confidence >= 0.7) {
          status = 'success';
        } else if (selfEvaluation.confidence >= 0.4) {
          status = 'partial';
        } else {
          status = 'needs_refinement';
        }

        const output: ExecutorOutput = {
          taskId: input.task.id,
          status,
          result,
          selfEvaluation,
          toolsUsed,
          duration,
          timestamp: Date.now(),
        };

        this.logInfo(
          `Task ${input.task.id} completed in ${duration}ms (confidence: ${selfEvaluation.confidence}, status: ${status})`
        );

        return output;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        this.logError(`Task ${input.task.id} failed: ${errorMessage}`, error);

        return {
          taskId: input.task.id,
          status: 'failed' as TaskStatus,
          result: {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          },
          selfEvaluation: {
            confidence: 0,
            concerns: [errorMessage],
            suggestions: ['Review error and retry with corrections'],
          },
          toolsUsed,
          duration,
          timestamp: Date.now(),
        };
      }
    }, 'execute');
  }

  /**
   * Refine: Improve output based on Critic feedback
   */
  async refine(previousOutput: ExecutorOutput, feedback: CriticFeedback): Promise<ExecutorOutput> {
    return this.executeWithErrorHandling(async () => {
      this.logInfo(`Refining task: ${previousOutput.taskId}`);
      this.logInfo(`Feedback issues: ${feedback.issues.join(', ')}`);

      const toolsUsed: string[] = [...previousOutput.toolsUsed];
      const startTime = Date.now();

      // Build refinement context from feedback
      const refinementContext = `
Previous result had these issues:
${feedback.issues.map((i) => `- ${i}`).join('\n')}

Required changes:
${feedback.requiredChanges.map((c) => `- ${c}`).join('\n')}

Suggestions:
${feedback.suggestions.map((s) => `- ${s}`).join('\n')}

Previous result:
${JSON.stringify(previousOutput.result, null, 2)}
`;

      // Use Ollama to generate refined result
      const response = await this.ollamaClient.chat({
        model: 'gemma4:31b-cloud',
        messages: [
          { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `You previously executed a task but the Critic found issues. Please refine your work.

${refinementContext}

Apply all required changes and return an improved result as JSON:
{
  "result": { ... improved result ... },
  "selfEvaluation": {
    "confidence": 0.0-1.0,
    "concerns": [],
    "suggestions": []
  }
}`,
          },
        ],
        stream: false,
      });

      let refinedResult = previousOutput.result;
      let selfEvaluation = previousOutput.selfEvaluation;

      if (!('message' in response)) {
        throw new Error('Unexpected streaming response');
      }

      try {
        const content = response.message.content;
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;
        const parsed: OllamaAnalysisResult = JSON.parse(jsonStr);
        refinedResult = parsed.result || refinedResult;
        selfEvaluation = parsed.selfEvaluation || selfEvaluation;
      } catch {
        this.logError('Failed to parse refinement response, using previous result');
      }

      const duration = Date.now() - startTime;

      // Map confidence to design.md status values: success | partial | failed
      let status: TaskStatus;
      if (selfEvaluation.confidence >= 0.7) {
        status = 'success';
      } else if (selfEvaluation.confidence >= 0.4) {
        status = 'partial';
      } else {
        status = 'needs_refinement';
      }

      return {
        taskId: previousOutput.taskId,
        status,
        result: refinedResult,
        selfEvaluation,
        toolsUsed,
        duration,
        timestamp: Date.now(),
      };
    }, 'refine');
  }

  /**
   * Execute read_code task: Read and understand existing code files
   */
  private async executeReadCode(input: ExecutorInput, toolsUsed: string[]): Promise<any> {
    this.logInfo(`Executing read_code task: ${input.task.description}`);

    const filesRead: Record<string, string> = {};
    const errors: string[] = [];

    // Extract file paths from task description and metadata
    const filePaths = this.extractFilePaths(input.task.description, input.task.metadata);

    if (filePaths.length > 0) {
      // Read specific files mentioned in the task
      for (const filePath of filePaths) {
        try {
          const content = await this.toolRegistry.executeTool('forgeai_readFile', {
            path: filePath,
          });
          toolsUsed.push('forgeai_readFile');
          filesRead[filePath] = typeof content === 'string' ? content : JSON.stringify(content);
        } catch (err) {
          errors.push(`Failed to read ${filePath}: ${err instanceof Error ? err.message : err}`);
        }
      }
    } else {
      // No specific files — list directory to understand structure
      try {
        const dirListing = await this.toolRegistry.executeTool('forgeai_listDirectory', {
          path: '.',
        });
        toolsUsed.push('forgeai_listDirectory');

        // Search for relevant files based on task description
        const keywords = this.extractKeywords(input.task.description);
        if (keywords.length > 0) {
          try {
            const searchResults = await this.toolRegistry.executeTool('forgeai_searchInFiles', {
              query: keywords[0],
              filePattern: '**/*.ts',
            });
            toolsUsed.push('forgeai_searchInFiles');
            return {
              directoryStructure: dirListing,
              searchResults,
              filesRead,
              errors,
            };
          } catch {
            // Search failed, return directory listing
          }
        }

        return { directoryStructure: dirListing, filesRead, errors };
      } catch (err) {
        errors.push(`Failed to list directory: ${err instanceof Error ? err.message : err}`);
      }
    }

    return { filesRead, errors, fileCount: Object.keys(filesRead).length };
  }

  /**
   * Execute analyze task: Analyze code for issues or patterns
   */
  private async executeAnalyze(input: ExecutorInput, toolsUsed: string[]): Promise<any> {
    this.logInfo(`Executing analyze task: ${input.task.description}`);

    // Gather code to analyze — from dependency results or by reading files
    let codeToAnalyze = '';
    const diagnostics: any[] = [];

    // Pull code from dependency task results
    if (input.dependencyResults.size > 0) {
      for (const [, depOutput] of input.dependencyResults) {
        if (depOutput.result?.filesRead) {
          for (const [path, content] of Object.entries(depOutput.result.filesRead)) {
            codeToAnalyze += `\n\n// File: ${path}\n${content}`;
          }
        }
      }
    }

    // Get diagnostics from VS Code
    try {
      const diags = await this.toolRegistry.executeTool('forgeai_getDiagnostics', {});
      toolsUsed.push('forgeai_getDiagnostics');
      if (Array.isArray(diags)) {
        diagnostics.push(...diags);
      }
    } catch {
      // Diagnostics not available
    }

    // Use Ollama to analyze the code
    const analysisPrompt = codeToAnalyze
      ? `Analyze this code for issues, patterns, and root causes:\n\n${codeToAnalyze}\n\nTask: ${input.task.description}`
      : `Analyze the workspace for: ${input.task.description}`;

    const response = await this.ollamaClient.chat({
      model: 'gemma4:31b-cloud',
      messages: [
        { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
        { role: 'user', content: analysisPrompt },
      ],
      stream: false,
    });

    if (!('message' in response)) {
      throw new Error('Unexpected streaming response');
    }

    return {
      analysis: response.message.content,
      diagnostics,
      codeAnalyzed: codeToAnalyze.length > 0,
    };
  }

  /**
   * Execute generate_fix task: Generate code fixes or new implementations
   */
  private async executeGenerateFix(input: ExecutorInput, toolsUsed: string[]): Promise<any> {
    this.logInfo(`Executing generate_fix task: ${input.task.description}`);

    // Gather context from dependency results
    let context = '';
    for (const [taskId, depOutput] of input.dependencyResults) {
      if (depOutput.result?.filesRead) {
        for (const [path, content] of Object.entries(depOutput.result.filesRead)) {
          context += `\n\n// File: ${path}\n${content}`;
        }
      }
      if (depOutput.result?.analysis) {
        context += `\n\nAnalysis from ${taskId}:\n${depOutput.result.analysis}`;
      }
    }

    // Apply feedback if this is a refinement
    const feedbackContext = input.feedback
      ? `\n\nPrevious attempt had these issues:\n${input.feedback.issues.join('\n')}\nRequired changes:\n${input.feedback.requiredChanges.join('\n')}`
      : '';

    const prompt = `${input.task.description}

Context:
${context || 'No prior context available.'}
${feedbackContext}

Generate the complete, production-ready implementation. Return ONLY the code, no explanations.`;

    const response = await this.ollamaClient.chat({
      model: 'gemma4:31b-cloud',
      messages: [
        { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      stream: false,
    });

    if (!('message' in response)) {
      throw new Error('Unexpected streaming response');
    }

    const generatedCode = response.message.content;

    // Extract code from markdown blocks if present
    const codeMatch = generatedCode.match(/```(?:typescript|javascript|ts|js)?\n([\s\S]*?)\n```/);
    const cleanCode = codeMatch ? codeMatch[1] : generatedCode;

    return {
      generatedCode: cleanCode,
      rawResponse: generatedCode,
      description: input.task.description,
    };
  }

  /**
   * Execute run_tests task: Execute the test suite
   */
  private async executeRunTests(input: ExecutorInput, toolsUsed: string[]): Promise<any> {
    this.logInfo(`Executing run_tests task: ${input.task.description}`);

    // Determine test command from task metadata or default to npm test
    const testCommand = input.task.metadata?.testCommand || 'npm test -- --no-coverage';

    try {
      const output = await this.toolRegistry.executeTool('forgeai_runCommand', {
        command: testCommand,
      });
      toolsUsed.push('forgeai_runCommand');

      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
      const testResults = this.parseTestOutput(outputStr);

      return {
        command: testCommand,
        output: outputStr,
        ...testResults,
      };
    } catch (err) {
      const errorStr = err instanceof Error ? err.message : String(err);
      const testResults = this.parseTestOutput(errorStr);

      return {
        command: testCommand,
        output: errorStr,
        failed: true,
        ...testResults,
      };
    }
  }

  /**
   * Execute apply_changes task: Write code changes to files
   */
  private async executeApplyChanges(input: ExecutorInput, toolsUsed: string[]): Promise<any> {
    this.logInfo(`Executing apply_changes task: ${input.task.description}`);

    const appliedFiles: string[] = [];
    const errors: string[] = [];

    // Get generated code from dependency results
    for (const [, depOutput] of input.dependencyResults) {
      if (depOutput.result?.generatedCode && depOutput.result?.targetFile) {
        const { targetFile, generatedCode } = depOutput.result;
        try {
          await this.toolRegistry.executeTool('forgeai_writeFile', {
            path: targetFile,
            content: generatedCode,
          });
          toolsUsed.push('forgeai_writeFile');
          appliedFiles.push(targetFile);
          this.logInfo(`Applied changes to: ${targetFile}`);
        } catch (err) {
          errors.push(`Failed to write ${targetFile}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    // If no dependency provided file info, check task metadata
    if (appliedFiles.length === 0 && input.task.metadata?.targetFile) {
      const { targetFile } = input.task.metadata;
      // Find generated code from any dependency
      for (const [, depOutput] of input.dependencyResults) {
        if (depOutput.result?.generatedCode) {
          try {
            await this.toolRegistry.executeTool('forgeai_writeFile', {
              path: targetFile,
              content: depOutput.result.generatedCode,
            });
            toolsUsed.push('forgeai_writeFile');
            appliedFiles.push(targetFile);
          } catch (err) {
            errors.push(
              `Failed to write ${targetFile}: ${err instanceof Error ? err.message : err}`
            );
          }
          break;
        }
      }
    }

    return {
      appliedFiles,
      errors,
      success: errors.length === 0 && appliedFiles.length > 0,
    };
  }

  /**
   * Execute verify task: Verify changes work correctly
   */
  private async executeVerify(input: ExecutorInput, toolsUsed: string[]): Promise<any> {
    this.logInfo(`Executing verify task: ${input.task.description}`);

    const issues: string[] = [];
    let diagnosticsResult: any = null;
    let testResult: any = null;

    // Check diagnostics for errors
    try {
      diagnosticsResult = await this.toolRegistry.executeTool('forgeai_getDiagnostics', {});
      toolsUsed.push('forgeai_getDiagnostics');

      if (Array.isArray(diagnosticsResult)) {
        const errors = diagnosticsResult.filter((d: any) => d.severity === 'error');
        if (errors.length > 0) {
          issues.push(`${errors.length} diagnostic error(s) found`);
        }
      }
    } catch {
      // Diagnostics not available
    }

    // Run a quick test check if test framework is available
    try {
      const output = await this.toolRegistry.executeTool('forgeai_runCommand', {
        command: 'npm test -- --no-coverage --passWithNoTests',
      });
      toolsUsed.push('forgeai_runCommand');
      const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
      testResult = this.parseTestOutput(outputStr);

      if (testResult.failCount > 0) {
        issues.push(`${testResult.failCount} test(s) failing`);
      }
    } catch (err) {
      issues.push(`Test run failed: ${err instanceof Error ? err.message : err}`);
    }

    return {
      passed: issues.length === 0,
      issues,
      diagnostics: diagnosticsResult,
      testResult,
    };
  }

  /**
   * Self-evaluate the result quality based on task criteria
   */
  private selfEvaluate(result: any, task: Task): SelfEvaluation {
    const concerns: string[] = [];
    const suggestions: string[] = [];
    let confidence = 0.8; // Start optimistic

    if (!result) {
      return { confidence: 0, concerns: ['No result produced'], suggestions: ['Retry task'] };
    }

    // Check for errors in result
    if (result.error) {
      return {
        confidence: 0,
        concerns: [result.error],
        suggestions: ['Fix the error and retry'],
      };
    }

    // Task-type specific evaluation
    switch (task.type) {
      case 'read_code':
        if (!result.filesRead || Object.keys(result.filesRead).length === 0) {
          confidence -= 0.3;
          concerns.push('No files were read');
          suggestions.push('Verify file paths are correct');
        }
        if (result.errors?.length > 0) {
          confidence -= 0.2;
          concerns.push(...result.errors);
        }
        break;

      case 'analyze':
        if (!result.analysis || result.analysis.length < 50) {
          confidence -= 0.3;
          concerns.push('Analysis is too brief');
          suggestions.push('Provide more detailed analysis');
        }
        break;

      case 'generate_fix':
        if (!result.generatedCode || result.generatedCode.trim().length === 0) {
          confidence = 0;
          concerns.push('No code was generated');
          suggestions.push('Retry code generation');
        } else if (
          result.generatedCode.includes('TODO') ||
          result.generatedCode.includes('FIXME')
        ) {
          confidence -= 0.2;
          concerns.push('Generated code contains TODOs or FIXMEs');
          suggestions.push('Complete all TODO items before submitting');
        }
        break;

      case 'run_tests':
        if (result.failCount > 0) {
          confidence -= 0.4;
          concerns.push(`${result.failCount} test(s) failing`);
          suggestions.push('Fix failing tests before proceeding');
        }
        if (result.failed) {
          confidence -= 0.3;
          concerns.push('Test command failed to run');
        }
        break;

      case 'apply_changes':
        if (!result.success || result.appliedFiles?.length === 0) {
          confidence -= 0.4;
          concerns.push('No files were modified');
          suggestions.push('Verify target file paths and generated code');
        }
        if (result.errors?.length > 0) {
          confidence -= 0.2;
          concerns.push(...result.errors);
        }
        break;

      case 'verify':
        if (!result.passed) {
          confidence -= 0.3;
          concerns.push(...(result.issues || ['Verification failed']));
          suggestions.push('Address all issues before marking complete');
        }
        break;
    }

    return {
      confidence: Math.max(0, Math.min(1, confidence)),
      concerns,
      suggestions,
    };
  }

  /**
   * Parse test runner output to extract pass/fail counts
   */
  private parseTestOutput(output: string): {
    passCount: number;
    failCount: number;
    totalCount: number;
    testErrors: string[];
  } {
    const testErrors: string[] = [];
    let passCount = 0;
    let failCount = 0;

    // Jest output patterns
    const jestPassMatch = output.match(/(\d+)\s+passed/);
    const jestFailMatch = output.match(/(\d+)\s+failed/);
    if (jestPassMatch) passCount = parseInt(jestPassMatch[1], 10);
    if (jestFailMatch) failCount = parseInt(jestFailMatch[1], 10);

    // Vitest output patterns
    const vitestPassMatch = output.match(/(\d+)\s+tests?\s+passed/i);
    const vitestFailMatch = output.match(/(\d+)\s+tests?\s+failed/i);
    if (vitestPassMatch) passCount = parseInt(vitestPassMatch[1], 10);
    if (vitestFailMatch) failCount = parseInt(vitestFailMatch[1], 10);

    // Extract error messages
    const errorLines = output
      .split('\n')
      .filter((line) => line.includes('●') || line.includes('FAIL') || line.includes('Error:'));
    testErrors.push(...errorLines.slice(0, 10)); // Limit to first 10 errors

    return {
      passCount,
      failCount,
      totalCount: passCount + failCount,
      testErrors,
    };
  }

  /**
   * Extract file paths mentioned in task description or metadata
   */
  private extractFilePaths(description: string, metadata?: Record<string, any>): string[] {
    const paths: string[] = [];

    // From metadata
    if (metadata?.files && Array.isArray(metadata.files)) {
      paths.push(...metadata.files);
    }
    if (metadata?.targetFile) {
      paths.push(metadata.targetFile);
    }

    // From description — match common path patterns
    const pathMatches = description.match(/(?:src|lib|test|dist)\/[\w/.-]+\.\w+/g);
    if (pathMatches) {
      paths.push(...pathMatches);
    }

    return [...new Set(paths)]; // Deduplicate
  }

  /**
   * Extract keywords from task description for search
   */
  private extractKeywords(description: string): string[] {
    // Remove common words and extract meaningful terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'for',
      'to',
      'in',
      'of',
      'with',
      'that',
      'this',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
    ]);

    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 3);
  }
}
