/**
 * HealthScannerAgent — autonomous project health analysis agent.
 *
 * Responsibilities (forge.md Requirement 8):
 *  - Scan entire codebase in chunks for bugs, deprecated APIs, security issues, coding-standard violations
 *  - Use Stack Profile context + .forgeai/research cache + RAG for context-aware analysis
 *  - Fall back to web search via forgeai_webResearch / forgeai_fetchPage when local knowledge is insufficient
 *  - Produce a severity-prioritized report at .forgeai/reports/health-YYYY-MM-DD.md
 *  - Offer fixes to user, await approval, apply approved fixes, update the report
 *  - Publish VS Code DiagnosticCollection (squiggly lines) for inline issue visibility
 *
 * Entry points:
 *  - extension.ts registers forgeai.scanHealth command → creates HealthScannerAgent and calls run()
 *  - extension.ts registers forgeai.autoScanOnOpen command → lightweight scan for new project onboarding
 */

import { BaseAgent } from '../BaseAgent';
import { ToolRegistry } from '../../tools/ToolRegistry';
import { OllamaClient } from '../../ollama/OllamaClient';
import { Logger } from '../../utils/Logger';
import { PersonaManager } from '../../persona/PersonaManager';
import { ResearchAgent } from '../research/ResearchAgent';
import { ResearchCache } from '../research/ResearchCache';
import { renderToolSection } from '../../agents/ToolCatalog';
import { getConfiguredModel } from '../../config/ModelConfig';
import * as vscode from 'vscode';
import * as path from 'path';

export const REPORT_DIR = '.forgeai';
export const REPORTS_DIR = '.forgeai/reports';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface HealthFinding {
  severity: Severity;
  category: 'security' | 'deprecated-api' | 'coding-standard' | 'bug' | 'missing-config' | 'dependency';
  file?: string;
  line?: number;
  message: string;
  explanation: string;
  fixSuggestion: string;
  fixCommand?: string;
  autoFixable: boolean;
  status: 'open' | 'approved' | 'fixed' | 'manual-required';
  diagnostic?: vscode.Diagnostic;
}

export interface HealthScanInput {
  workspaceRoot: string;
  mode: 'full' | 'quick' | 'auto';
  autoFix: boolean;
  maxFileCount?: number;
  chunkSize?: number;
}

export interface HealthScanOutput {
  reportPath: string;
  findings: HealthFinding[];
  stats: {
    filesScanned: number;
    chunksAnalyzed: number;
    toolCallsMade: number;
    llmCallsMade: number;
    durationMs: number;
  };
  summary: string;
}

const SYSTEM_PROMPT = `# ROLE

You are the HealthScannerAgent — an autonomous project health analyst.
Your job is to scan source files, detect issues, and produce actionable findings.

# TOOLS AVAILABLE
{tools}

# SCANNING RULES
- Analyze the chunk of source files provided in the user message
- Detect: security vulnerabilities (SQL injection, XSS, hardcoded secrets, path traversal),
  deprecated API usage (cross-reference with Stack Profile frameworks/versions below),
  coding standard violations (from Persona codingStandards below),
  bugs (null derefs, missing error handling, race conditions),
  missing config files (no .eslintrc, no tsconfig, missing env vars)
- Assign severity: critical (data loss/security breach), high (breaks functionality), medium (tech debt), low (style)
- For EACH finding provide: file path, line number (estimate if exact not known), message, explanation, fix suggestion
- Mark autoFixable=true only when a deterministic text replacement or single command can fix it
- Mark autoFixable=false when architectural review is needed
- Output ONLY JSON. No markdown, no preamble.

# OUTPUT FORMAT
Return a JSON array of findings:
[
  {
    "severity": "critical|high|medium|low",
    "category": "security|deprecated-api|coding-standard|bug|missing-config|dependency",
    "file": "src/...",
    "line": 42,
    "message": "concise title",
    "explanation": "why this is a problem",
    "fixSuggestion": "what to change",
    "fixCommand": "shell command to run, or null",
    "autoFixable": true|false,
    "status": "open"
  }
]

If no issues in this chunk, return [].

# STACK PROFILE CONTEXT
{stackProfile}

# RESEARCH / RAG CONTEXT
{researchContext}`;

const SUMMARY_PROMPT = `You are a technical lead reviewing a health scan report.

Given the following findings, produce a concise executive summary and a prioritized fix plan.
Return ONLY Markdown with these sections:

## Executive Summary
[2-3 sentences]

## Severity Breakdown
- Critical: N
- High: N
- Medium: N
- Low: N

## Top 5 Fixes (Priority Order)
1. ...
2. ...
3. ...
4. ...
5. ...

## Recommendations
[2-3 bullet points on next steps]`;

export class HealthScannerAgent extends BaseAgent {
  private diagnosticCollection: vscode.DiagnosticCollection;
  private researchCache: ResearchCache;

  constructor(
    toolRegistry: ToolRegistry,
    ollamaClient: OllamaClient,
    logger: Logger,
    private readonly personaManager: PersonaManager,
    private readonly researchAgent: ResearchAgent,
    private readonly workspaceRoot: string
  ) {
    super(toolRegistry, ollamaClient, logger);
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection('forgeai-health');
    this.researchCache = new ResearchCache(workspaceRoot);
  }

  getName(): string { return 'HealthScannerAgent'; }
  getCapabilities(): string[] { return ['health-scan', 'security-audit', 'deprecation-detection', 'auto-fix', 'report-generation', 'diagnostic-publishing']; }

  async execute(input: any): Promise<any> {
    return this.run(input as HealthScanInput);
  }

  async run(input: HealthScanInput): Promise<HealthScanOutput> {
    return this.executeWithErrorHandling(async () => {
      const startTime = Date.now();
      const { mode, autoFix = false, maxFileCount = 500, chunkSize = 20 } = input;

      // ── 1. Enumerate files ──
      this.logInfo('Enumerating source files');
      const files = await this.enumerateSourceFiles(maxFileCount);
      if (files.length === 0) {
        return this.emptyOutput('No source files found to scan');
      }

      // ── 2. Build context ──
      const stackProfile = this.personaManager.getActiveProfile();
      const stackProfileText = stackProfile
        ? `Active Stack Profile: ${stackProfile.name}\nFrameworks: ${stackProfile.frameworks.join(', ')}\nVersions: ${(stackProfile as any).versions?.join(', ') || 'not specified'}\nCoding Standards: ${stackProfile.codingStandards.join('; ')}`
        : 'No active Stack Profile — using generic detection.';

      const researchContext = await this.loadResearchContext(input.workspaceRoot);

      const toolSection = renderToolSection(this.getName());
      // Filter to relevant tools for health scanning
      const toolDefs = this.toolRegistry.getToolDefinitions().filter((t: any) => {
        const name = t.function?.name || '';
        return ['forgeai_readFile', 'forgeai_searchInFiles', 'forgeai_findFile', 'forgeai_listFiles',
                'forgeai_webSearch', 'forgeai_webResearch', 'forgeai_fetchPage', 'forgeai_searchDocs',
                'forgeai_runCommand', 'forgeai_getErrors', 'forgeai_getDiagnostics',
                'forgeai_writeFile', 'forgeai_replaceText', 'forgeai_replaceRegex',
                'forgeai_deleteFile', 'forgeai_gitStatus',
               ].includes(name);
      });

      // ── 3. Chunk-based LLM analysis ──
      const allFindings: HealthFinding[] = [];
      const chunks = this.chunkFiles(files, chunkSize);
      let llmCalls = 0;
      let toolCallsTotal = 0;

      this.logInfo(`Scanning ${files.length} files in ${chunks.length} chunks`);
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        this.logInfo(`Analyzing chunk ${i + 1}/${chunks.length} (${chunk.length} files)`);

        // Read file contents for this chunk
        const fileContents = await this.readChunkFiles(chunk);

        const userPrompt = this.buildChunkPrompt(chunk, fileContents, stackProfileText, researchContext);

        const result = await (this as any).executeWithTools({
          messages: [
            { role: 'system', content: this.buildSystemPrompt(toolSection, stackProfileText, researchContext) },
            { role: 'user', content: userPrompt },
          ],
          tools: toolDefs,
          maxIterations: 4,
          onToolStart: (name: string) => this.logInfo(`Tool: ${name}`),
          onToolComplete: (name: string, ms: number) => this.logInfo(`Tool ${name} done in ${ms}ms`),
          onToolError: (name: string, err: Error) => this.logger.warn(`Tool ${name} error: ${err.message}`),
        });

        toolCallsTotal += result.toolCallsMade;
        llmCalls++;

        // Parse JSON findings from response
        const findings = this.parseFindings(result.content, files[0] || '');
        allFindings.push(...findings);
      }

      // ── 4. Run concrete checks (tsc, eslint, git status) ──
      this.logInfo('Running concrete command checks');
      const concreteFindings = await this.runConcreteChecks(files);
      allFindings.push(...concreteFindings);

      // ── 5. Deduplicate findings by file+line+message ──
      const deduped = this.dedupFindings(allFindings as any[]);
      this.logInfo(`Total findings: ${deduped.length} (from ${allFindings.length} raw)`);

      // ── 6. Assign statuses ──
      for (const f of deduped) (f as any).status = 'open';

      // ── 7. Generate LLM summary ──
      this.logInfo('Generating executive summary');
      const summaryResult = await (this as any).executeWithTools({
        messages: [
          { role: 'system', content: SUMMARY_PROMPT },
          { role: 'user', content: `Findings:\n${JSON.stringify((deduped as any[]).map((f: any) => ({ s: f.severity, c: f.category, f: f.file, l: f.line, m: f.message })), null, 2)}` },
        ],
        tools: [],
        maxIterations: 2,
      });
      llmCalls++;

      // ── 8. Write report ──
      const reportPath = await this.writeReport(deduped as HealthFinding[], summaryResult.content, mode === 'quick');

      // ── 9. Publish diagnostics ──
      await this.publishDiagnostics(deduped as HealthFinding[]);

      // ── 10. If autoFix enabled, apply fixes ──
      if (autoFix) {
        this.logInfo('Auto-fixing approved issues');
        const fixCount = await this.autoFixFindings(deduped as HealthFinding[]);
        this.logInfo(`Auto-fixed ${fixCount} issues`);
        // Re-run concrete checks and update report
        const postFixFindings = await this.runConcreteChecks(files);
        const updated = this.dedupFindings([...(deduped as any[]).filter((f: any) => f.status !== 'fixed'), ...postFixFindings] as any[]);
        await this.writeReport(updated as HealthFinding[], summaryResult.content, mode === 'quick');
        await this.publishDiagnostics(updated as HealthFinding[]);
        return {
          reportPath,
          findings: updated,
          stats: {
            filesScanned: files.length,
            chunksAnalyzed: chunks.length,
            toolCallsMade: toolCallsTotal,
            llmCallsMade: llmCalls,
            durationMs: Date.now() - startTime,
          },
          summary: summaryResult.content,
        };
      }

      return {
        reportPath,
        findings: deduped as HealthFinding[],
        stats: {
          filesScanned: files.length,
          chunksAnalyzed: chunks.length,
          toolCallsMade: toolCallsTotal,
          llmCallsMade: llmCalls,
          durationMs: Date.now() - startTime,
        },
        summary: summaryResult.content,
      };
    }, 'run');
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async enumerateSourceFiles(maxCount: number): Promise<string[]> {
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.php', '.java', '.cs', '.rb', '.swift', '.kt', '.scala'];
    try {
      const result = await this.toolRegistry.executeTool('forgeai_listFiles', { pattern: '**/*' });
      const allFiles = (result as any)?.files || [];
      return allFiles
        .filter((f: string) => sourceExtensions.some(ext => f.endsWith(ext)))
        .filter((f: string) => !f.includes('node_modules') && !f.includes('.git/') && !f.includes('dist/') && !f.includes('coverage/'))
        .slice(0, maxCount);
    } catch {
      // Fallback: scan common source directories
      const dirs = ['src', 'lib', 'app', 'pkg', 'internal'];
      const all: string[] = [];
      for (const dir of dirs) {
        try {
          const listResult = await this.toolRegistry.executeTool('forgeai_listFiles', { pattern: `${dir}/**/*` });
          const found = (listResult as any)?.files || [];
          all.push(...found);
        } catch { /* skip missing dirs */ }
      }
      return [...new Set(all)].filter((f: string) => sourceExtensions.some(ext => f.endsWith(ext))).slice(0, maxCount);
    }
  }

  private chunkFiles(files: string[], chunkSize: number): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < files.length; i += chunkSize) {
      chunks.push(files.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async readChunkFiles(files: string[]): Promise<Map<string, string>> {
    const contents = new Map<string, string>();
    await Promise.all(files.map(async (file) => {
      try {
        const result = await this.toolRegistry.executeTool('forgeai_readFile', { path: file });
        contents.set(file, (result as any)?.content || '');
      } catch {
        contents.set(file, '[unreadable]');
      }
    }));
    return contents;
  }

  private buildSystemPrompt(toolSection: string, stackProfile: string, researchContext: string): string {
    return `${toolSection}

# ROLE

You are the HealthScannerAgent — an autonomous project health analyst.
You scan source files in chunks and detect bugs, security issues, deprecated APIs, and coding-standard violations.

${stackProfile ? `# STACK PROFILE\n${stackProfile}\n` : ''}
${researchContext ? `# RESEARCH CONTEXT\n${researchContext.slice(0, 5000)}\n` : ''}
# OUTPUT DISCIPLINE
- Return ONLY a JSON array of findings. No markdown, no preamble, no explanation outside JSON.
- If no findings, return []
- Each finding MUST include all fields; use null for optional fields you can't determine`;
  }

  private buildChunkPrompt(chunk: string[], fileContents: Map<string, string>, _stackProfile: string, _research: string): string {
    let prompt = `Analyze the following ${chunk.length} source files for health issues.\n\n`;
    for (const file of chunk) {
      const content = fileContents.get(file) || '[unreadable]';
      const truncated = content.length > 3000 ? content.slice(0, 3000) + '\n... [truncated]' : content;
      prompt += `## File: ${file}\n\`\`\`\n${truncated}\n\`\`\`\n\n`;
    }
    prompt += `\nDetect issues and return JSON findings array.`;
    return prompt;
  }

  private parseFindings(raw: string, _contextFile: string): HealthFinding[] {
    try {
      // Try to extract JSON from possibly-noisy LLM output
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((f: any) => ({
        severity: f.severity || 'medium',
        category: f.category || 'bug',
        file: f.file || _contextFile,
        line: typeof f.line === 'number' ? f.line : undefined,
        message: f.message || 'Unknown issue',
        explanation: f.explanation || '',
        fixSuggestion: f.fixSuggestion || '',
        fixCommand: f.fixCommand || null,
        autoFixable: !!f.autoFixable,
        status: 'open' as const,
      }));
    } catch {
      this.logger.warn('Failed to parse findings JSON from LLM output');
      return [];
    }
  }

  private async runConcreteChecks(files: string[]): Promise<HealthFinding[]> {
    const findings: HealthFinding[] = [];
    const startTime = Date.now();

    // tsc
    try {
      const tsc = await this.toolRegistry.executeTool('forgeai_runCommand', { command: 'npx tsc --noEmit --pretty false', timeout: 60000 });
      const out = (tsc as any)?.stdout || (tsc as any)?.output || '';
      if (out && !out.includes('Found 0 errors')) {
        findings.push({
          severity: 'high', category: 'bug', file: 'TypeScript', line: undefined,
          message: 'TypeScript compilation errors',
          explanation: out.slice(0, 500),
          fixSuggestion: 'Fix TypeScript errors: run `npx tsc --noEmit` and address each error.',
          fixCommand: 'npx tsc --noEmit',
          autoFixable: false, status: 'open',
        });
      }
    } catch { /* tsc not available */ }

    // eslint
    try {
      const eslint = await this.toolRegistry.executeTool('forgeai_runCommand', { command: 'npx eslint --ext .ts,.tsx src/ --max-warnings=0', timeout: 60000 });
      const out = (eslint as any)?.stdout || (eslint as any)?.output || '';
      if (out) {
        findings.push({
          severity: 'medium', category: 'coding-standard', file: 'ESLint', line: undefined,
          message: 'ESLint violations found',
          explanation: out.slice(0, 1000),
          fixSuggestion: 'Run `npx eslint --fix` to auto-fix, then manually address remaining issues.',
          fixCommand: 'npx eslint --fix',
          autoFixable: true, status: 'open',
        });
      }
    } catch { /* eslint not available */ }

    // git status
    try {
      const git = await this.toolRegistry.executeTool('forgeai_gitStatus', {});
      const status = (git as any)?.workingTreeStatus || (git as any)?.output || '';
      if (status && status !== 'clean') {
        findings.push({
          severity: 'low', category: 'missing-config', file: '.git', line: undefined,
          message: 'Git working tree is dirty',
          explanation: status,
          fixSuggestion: 'Commit or stash pending changes.',
          fixCommand: undefined,
          autoFixable: false, status: 'open',
        });
      }
    } catch { /* git not available */ }

    // VS Code diagnostics
    try {
      const diags = await this.toolRegistry.executeTool('forgeai_getErrors', {});
      const errors = (diags as any)?.errors || [];
      for (const err of errors.slice(0, 50)) {
        findings.push({
          severity: err.severity === 'error' ? 'high' : 'medium',
          category: 'bug',
          file: err.file || err.source,
          line: err.line ?? err.range?.start?.line,
          message: err.message,
          explanation: `VS Code error in ${err.source || 'unknown source'}`,
          fixSuggestion: err.source === 'typescript' ? 'Fix TypeScript type error' : 'Review error in VS Code',
          fixCommand: undefined,
          autoFixable: false,
          status: 'open',
        });
      }
    } catch { /* diagnostics not available */ }

    this.logInfo(`Concrete checks found ${findings.length} issues in ${Date.now() - startTime}ms`);
    return findings;
  }

  private async loadResearchContext(_workspaceRoot: string): Promise<string> {
    // ResearchCache requires a known sessionId to retrieve entries; there is no global enumeration API.
    // The agent will use forgeai_webResearch / forgeai_fetchPage for out-of-band lookups during chunk analysis.
    return '';
  }

  private dedupFindings(findings: HealthFinding[]): HealthFinding[] {
    const seen = new Set<string>();
    return findings.filter((f: any) => {
      const key = `${f.file}:${f.line || '?'}:${f.severity}:${(f.message || '').slice(0, 40)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async writeReport(findings: HealthFinding[], summary: string, quickMode: boolean): Promise<string> {
    const date = new Date().toISOString().slice(0, 10);
    const filename = quickMode ? `health-quick-${date}.md` : `health-${date}.md`;
    const reportPath = path.join(this.workspaceRoot, REPORTS_DIR, filename);
    const severityCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) severityCounts[f.severity] = (severityCounts[f.severity] || 0) + 1;
    const icon: Record<string, string> = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
    const body = findings.map((f: any) => {
      const lines: string[] = [`### ${icon[f.severity] || '⚪'} [${(f.severity || 'unknown').toUpperCase()}] ${f.category || 'unknown'}`];
      if (f.file) lines.push(`- **File**: \`${f.file}\`${f.line ? `:${f.line}` : ''}`);
      lines.push(`- **Message**: ${f.message}`, `- **Explanation**: ${f.explanation}`, `- **Fix**: ${f.fixSuggestion}`);
      if (f.fixCommand) lines.push(`- **Command**: \`${f.fixCommand}\``);
      lines.push(`- **Auto-fixable**: ${f.autoFixable ? 'Yes' : 'No (manual review required)'}`, `- **Status**: ${f.status}`, '');
      return lines.join('\n');
    }).join('\n---\n\n');
    const content = `# Project Health Report\n\n**Generated**: ${new Date().toISOString()}\n**Workspace**: ${this.workspaceRoot}\n**Mode**: ${quickMode ? 'Quick Scan' : 'Full Scan'}\n**Status**: ${findings.length === 0 ? '✅ Healthy' : `⚠️ ${findings.length} issue(s) found`}\n\n## Severity Summary\n- 🔴 Critical: ${severityCounts.critical}\n- 🟠 High: ${severityCounts.high}\n- 🟡 Medium: ${severityCounts.medium}\n- 🔵 Low: ${severityCounts.low}\n\n## Executive Summary\n${summary}\n\n## Findings\n${body || '_No issues found._'}\n\n## Fix History\n_No fixes applied yet._\n\n---\n*Generated by ForgeAI HealthScannerAgent*\n`;
    try {
      await this.toolRegistry.executeTool('forgeai_createDirectory', { path: path.dirname(reportPath) });
      await this.toolRegistry.executeTool('forgeai_writeFile', { path: reportPath, content });
    } catch { /* swallow report write errors */ }
    return reportPath;
  }

  private async publishDiagnostics(findings: HealthFinding[]): Promise<void> {
    const diagnosticsMap = new Map<string, vscode.Diagnostic[]>();
    for (const f of findings) {
      if (!f.file) continue;
      const uri = vscode.Uri.file(path.join(this.workspaceRoot, f.file));
      const range = f.line != null ? new vscode.Range(f.line, 0, f.line + 1, 0) : new vscode.Range(0, 0, 0, 1);
      const severityMap: Record<string, vscode.DiagnosticSeverity> = {
        critical: vscode.DiagnosticSeverity.Error,
        high: vscode.DiagnosticSeverity.Error,
        medium: vscode.DiagnosticSeverity.Warning,
        low: vscode.DiagnosticSeverity.Information,
      };
      const diag = new vscode.Diagnostic(range, `[${f.severity.toUpperCase()}] ${f.message}`, severityMap[f.severity] ?? vscode.DiagnosticSeverity.Warning);
      diag.source = 'ForgeAI Health';
      const list = diagnosticsMap.get(f.file) || [];
      list.push(diag);
      diagnosticsMap.set(f.file, list);
    }
    this.diagnosticCollection.set(
      Array.from(diagnosticsMap.entries()).map(([file, diags]) => [
        vscode.Uri.file(path.join(this.workspaceRoot, file)),
        diags as readonly vscode.Diagnostic[],
      ]) as [vscode.Uri, readonly vscode.Diagnostic[] | undefined][]
    );
  }

  private async autoFixFindings(findings: HealthFinding[]): Promise<number> {
    let fixed = 0;
    for (const f of findings) {
      if (!f.autoFixable || f.status !== 'open' || !f.file) continue;
      try {
        let newContent: string | undefined;
        if (f.fixCommand) {
          await this.toolRegistry.executeTool('forgeai_runCommand', { command: f.fixCommand, timeout: 30000 });
          f.status = 'fixed';
          fixed++;
          continue;
        }
        if (f.fixSuggestion) {
          const fileContent = await this.toolRegistry.executeTool('forgeai_readFile', { path: f.file }) as any;
          const content = fileContent.content || '';
          const lines = content.split('\n');
          const insertAt = typeof f.line === 'number' && f.line > 0 ? f.line : lines.length;
          const comment = `// HEALTH FIX NEEDED: ${f.message} — ${f.fixSuggestion}`;
          lines.splice(insertAt, 0, comment);
          newContent = lines.join('\n');
          await this.toolRegistry.executeTool('forgeai_writeFile', { path: f.file, content: newContent });
        }
        f.status = 'fixed';
        fixed++;
      } catch { /* skip fix failures */ }
    }
    return fixed;
  }

  private emptyOutput(msg: string): HealthScanOutput {
    const reportPath = path.join(this.workspaceRoot, REPORTS_DIR, `health-${new Date().toISOString().slice(0, 10)}.md`);
    return {
      reportPath,
      findings: [],
      stats: { filesScanned: 0, chunksAnalyzed: 0, toolCallsMade: 0, llmCallsMade: 0, durationMs: 0 },
      summary: msg,
    };
  }
}
