/**
 * Routes incoming webview messages to the appropriate handlers.
 */

import * as vscode from 'vscode';
import { Logger } from './Logger';
import { StorageManager } from '../storage/StorageManager';
import { OllamaClient, OllamaMessage } from '../ollama/OllamaClient';
import { AgentLoop } from '../ollama/AgentLoop';
import { ToolRegistry } from '../tools/ToolRegistry';
import type { RagService } from '../rag/RagService';
import { ConversationMemory } from './ConversationMemory';
import { AgentLoopRunner } from './AgentLoopRunner';
import { FileOperationHandler } from './FileOperationHandler';
import { categorizeOllamaFetchError } from './ErrorCategorizer';
import { getConfiguredModel } from '../config/ModelConfig';
import type { ForgeAIWorkspace } from '../forgeaiWorkspace/ForgeAIWorkspace';
import { SpecWriterAgent } from '../agents/spec/SpecWriterAgent';
import type { ResearchAgent } from '../agents/research/ResearchAgent';
import { ContextManager } from '../spec/ContextManager';
import { SessionMemory } from './SessionMemory';
import { SessionContextInjector } from '../ollama/SessionContextInjector';

export class WebviewMessageRouter {
  private contextManager: ContextManager;
  private sessionMemory: SessionMemory;
  private sessionContextInjector: SessionContextInjector;

  constructor(
    private view: vscode.WebviewView | undefined,
    private logger: Logger,
    private storageManager: StorageManager,
    private ollamaClient: OllamaClient,
    private toolRegistry: ToolRegistry | undefined,
    private conversationMemory: ConversationMemory,
    private forgeaiWorkspace: ForgeAIWorkspace | undefined,
    private ragService: RagService | undefined,
    private agentLoopRunner: AgentLoopRunner,
    private fileOpHandler: FileOperationHandler,
    private researchAgent: ResearchAgent,
    private webSearch?: {
      performSearch(query: string): Promise<{
        results: Array<{ title: string; url: string; snippet: string }>;
        totalResults: number;
        source: string;
      }>;
    }
  ) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    this.contextManager = new ContextManager(workspaceRoot);
    this.sessionMemory = new SessionMemory(workspaceRoot, this.logger);
    this.sessionContextInjector = new SessionContextInjector(this.sessionMemory, this.logger);
  }

  setView(view: vscode.WebviewView | undefined): void {
    this.view = view;
  }

  async handleMessage(raw: unknown): Promise<void> {
    const msg = raw as Record<string, unknown>;
    const msgType = typeof msg.type === 'string' ? msg.type : '';
    try {
      this.logger.info(`Handling message type: ${msgType}`);
      switch (msgType) {
        case 'sendMessage':
          await this.handleSendMessage(msg);
          break;
        case 'retryAfterError':
          await this.handleRetryAfterError(msg);
          break;
        case 'stopAgentLoop':
          await this.handleStopAgentLoop(msg);
          break;
        case 'applyChanges':
          await this.fileOpHandler.applyChanges(
            typeof msg.filePath === 'string' ? msg.filePath : '',
            typeof msg.content === 'string' ? msg.content : ''
          );
          break;
        case 'openFile':
          await this.fileOpHandler.openFile(
            typeof msg.filePath === 'string' ? msg.filePath : '',
            typeof msg.lineNumber === 'number' ? msg.lineNumber : undefined
          );
          break;
        case 'undoChanges':
          await this.fileOpHandler.undoChanges(
            typeof msg.filePath === 'string' ? msg.filePath : '',
            typeof msg.originalContent === 'string' ? msg.originalContent : ''
          );
          break;
        case 'fetchOllamaModels':
          await this.handleFetchOllamaModels();
          break;
        case 'exportConversation':
          await this.handleExportConversation(msg);
          break;
        case 'exportCurrentConversation':
          await this.handleExportCurrentConversation(msg);
          break;
        case 'setLanguage':
          await this.storageManager.setGlobalValue(
            'forgeai.language',
            typeof msg.language === 'string' ? msg.language : 'English'
          );
          break;
        case 'ragScrape':
        case 'ragQuery':
        case 'ragTrain':
        case 'ragGetFiles':
        case 'ragDeleteFile':
        case 'ragUpdateFile':
          break; // Handled by RagMessageHandler

        // ─── State retrieval messages (webview initialization) ───
        case 'getSettings': {
          const showThinking = this.storageManager.getGlobalValue<boolean>(
            'forgeai.showThinking',
            true
          );
          this.view?.webview.postMessage({ type: 'settings', payload: { showThinking } });
          break;
        }
        case 'getOnboardingState': {
          const onboarding = this.storageManager.getGlobalValue<Record<string, boolean>>(
            'forgeai.onboarding',
            {}
          );
          this.view?.webview.postMessage({
            type: 'onboardingState',
            payload: {
              hasSeenThinkingTooltip: onboarding.hasSeenThinkingTooltip ?? false,
              hasSeenToolTooltip: onboarding.hasSeenToolTooltip ?? false,
              hasSeenCodeChangeTooltip: onboarding.hasSeenCodeChangeTooltip ?? false,
              hasSeenWelcomeScreen: onboarding.hasSeenWelcomeScreen ?? false,
            },
          });
          break;
        }
        case 'getLanguage': {
          const language = this.storageManager.getGlobalValue<string>(
            'forgeai.language',
            'English'
          );
          this.view?.webview.postMessage({ type: 'language', language });
          break;
        }
        case 'getSelectedModel': {
          const model = this.storageManager.getGlobalValue<string>(
            'forgeai.selectedModel',
            getConfiguredModel()
          );
          this.view?.webview.postMessage({ type: 'selectedModel', model });
          break;
        }
        case 'getAutonomyLevel': {
          const level = this.storageManager.getGlobalValue<string>(
            'forgeai.autonomyLevel',
            'semi-autonomous'
          );
          this.view?.webview.postMessage({ type: 'autonomyLevel', level });
          break;
        }
        case 'getSpecDefaultWorkflow': {
          const workflow = this.storageManager.getGlobalValue<string>(
            'forgeai.spec.defaultWorkflow',
            'requirements-first'
          );
          this.view?.webview.postMessage({ type: 'specDefaultWorkflow', workflow });
          break;
        }
        case 'getWorkspaceState': {
          const key = typeof msg.key === 'string' ? msg.key : '';
          const value = this.storageManager.getWorkspaceValue<unknown>(key, undefined);
          this.view?.webview.postMessage({ type: 'workspaceState', key, value });
          break;
        }
        case 'getSplitScreenWidth': {
          const width = this.storageManager.getWorkspaceValue<number>(
            'forgeai.splitScreenWidth',
            50
          );
          this.view?.webview.postMessage({ type: 'splitScreenWidth', width });
          break;
        }
        case 'getPreviewCollapsed': {
          const collapsed = this.storageManager.getWorkspaceValue<boolean>(
            'forgeai.previewCollapsed',
            false
          );
          this.view?.webview.postMessage({ type: 'previewCollapsed', collapsed });
          break;
        }

        // ─── State persistence messages ───
        case 'setWorkspaceState': {
          const wsKey = typeof msg.key === 'string' ? msg.key : '';
          const wsValue = msg.value;
          await this.storageManager.setWorkspaceValue(wsKey, wsValue);
          break;
        }
        case 'setShowThinking': {
          const show = typeof msg.show === 'boolean' ? msg.show : true;
          await this.storageManager.setGlobalValue('forgeai.showThinking', show);
          break;
        }
        case 'setOnboardingState': {
          const payload =
            typeof msg.payload === 'object' && msg.payload !== null ? msg.payload : {};
          const existing = this.storageManager.getGlobalValue<Record<string, boolean>>(
            'forgeai.onboarding',
            {}
          );
          await this.storageManager.setGlobalValue('forgeai.onboarding', {
            ...existing,
            ...payload,
          });
          break;
        }
        case 'setSelectedModel': {
          const selModel = typeof msg.model === 'string' ? msg.model : getConfiguredModel();
          await this.storageManager.setGlobalValue('forgeai.selectedModel', selModel);
          break;
        }
        case 'setAutonomyLevel': {
          const selLevel = typeof msg.level === 'string' ? msg.level : 'semi-autonomous';
          await this.storageManager.setGlobalValue('forgeai.autonomyLevel', selLevel);
          break;
        }
        case 'setSpecDefaultWorkflow': {
          const workflow = typeof msg.workflow === 'string' ? msg.workflow : 'requirements-first';
          await this.storageManager.setGlobalValue('forgeai.spec.defaultWorkflow', workflow);
          break;
        }
        case 'setSplitScreenWidth': {
          const sWidth = typeof msg.width === 'number' ? msg.width : 50;
          await this.storageManager.setWorkspaceValue('forgeai.splitScreenWidth', sWidth);
          break;
        }
        case 'setPreviewCollapsed': {
          const sCollapsed = typeof msg.collapsed === 'boolean' ? msg.collapsed : false;
          await this.storageManager.setWorkspaceValue('forgeai.previewCollapsed', sCollapsed);
          break;
        }

        // ─── Workspace status messages ───
        case 'getWorkspaceStatus': {
          const state = this.forgeaiWorkspace?.getWorkspaceState();
          this.view?.webview.postMessage({
            type: 'workspaceStatus',
            initialized: state?.initialized ?? false,
            specs: state?.specs ?? [],
            memoryCount: state?.memoryCount ?? 0,
            productExists: state?.productExists ?? false,
            productName: state?.productName ?? '',
            productDescription: state?.productDescription ?? '',
            productTechStack: state?.productTechStack ?? [],
            hooksExist: state?.hooksExist ?? false,
          });
          break;
        }
        case 'initWorkspace': {
          if (this.forgeaiWorkspace) {
            this.forgeaiWorkspace.initialize();
            const state = this.forgeaiWorkspace.getWorkspaceState();
            this.view?.webview.postMessage({
              type: 'workspaceStatus',
              initialized: true,
              specs: state.specs,
              memoryCount: state.memoryCount,
              productExists: state.productExists,
              productName: state.productName,
              productDescription: state.productDescription,
              productTechStack: state.productTechStack,
              hooksExist: state.hooksExist,
            });
          }
          break;
        }

        // ─── Memory system messages ───
        case 'listMemory': {
          const category = msg.category as 'finding' | 'preference' | 'learning' | undefined;
          const entries = this.forgeaiWorkspace?.memory.list(category) ?? [];
          this.view?.webview.postMessage({
            type: 'memoryList',
            entries,
          });
          break;
        }
        case 'saveMemory': {
          const entry = msg.entry as Record<string, unknown>;
          const id = typeof entry?.id === 'string' ? entry.id : '';
          const category = typeof entry?.category === 'string' ? entry.category : '';
          const title = typeof entry?.title === 'string' ? entry.title : '';
          const content = typeof entry?.content === 'string' ? entry.content : '';
          if (this.forgeaiWorkspace && id && category && title && content) {
            this.forgeaiWorkspace.memory.save({
              id,
              category: category as 'finding' | 'preference' | 'learning',
              title,
              content,
              source: typeof entry.source === 'string' ? entry.source : undefined,
              tags: Array.isArray(entry.tags)
                ? entry.tags.filter((t): t is string => typeof t === 'string')
                : [],
              createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
              updatedAt: Date.now(),
            });
            this.view?.webview.postMessage({ type: 'memorySaved', id });
          }
          break;
        }
        case 'deleteMemory': {
          const id = msg.id as string;
          if (this.forgeaiWorkspace && id) {
            this.forgeaiWorkspace.memory.delete(id);
            this.view?.webview.postMessage({ type: 'memoryDeleted', id });
          }
          break;
        }

        // ─── Product system messages ───
        case 'getProduct': {
          const overview = this.forgeaiWorkspace?.product.getOverview();
          const branding = this.forgeaiWorkspace?.product.getBranding();
          const features = this.forgeaiWorkspace?.product.getFeatures() ?? [];
          const roadmap = this.forgeaiWorkspace?.product.getRoadmap();
          this.view?.webview.postMessage({
            type: 'productData',
            overview,
            branding,
            features,
            roadmap,
          });
          break;
        }
        case 'saveProductOverview': {
          const ov = msg.overview as Record<string, unknown>;
          if (this.forgeaiWorkspace && ov) {
            this.forgeaiWorkspace.product.saveOverview({
              name: typeof ov.name === 'string' ? ov.name : '',
              description: typeof ov.description === 'string' ? ov.description : '',
              techStack: Array.isArray(ov.techStack)
                ? ov.techStack.filter((t): t is string => typeof t === 'string')
                : [],
              goals: Array.isArray(ov.goals)
                ? ov.goals.filter((g): g is string => typeof g === 'string')
                : [],
              targetUsers: typeof ov.targetUsers === 'string' ? ov.targetUsers : 'Developers',
              createdAt: typeof ov.createdAt === 'number' ? ov.createdAt : Date.now(),
              updatedAt: Date.now(),
            });
            this.view?.webview.postMessage({ type: 'productSaved' });
          }
          break;
        }
        case 'saveProductFeature': {
          const feat = msg.feature as Record<string, unknown>;
          if (this.forgeaiWorkspace && feat && typeof feat.id === 'string') {
            this.forgeaiWorkspace.product.saveFeature({
              id: feat.id,
              title: typeof feat.title === 'string' ? feat.title : '',
              description: typeof feat.description === 'string' ? feat.description : '',
              priority: (typeof feat.priority === 'string' ? feat.priority : 'medium') as
                | 'critical'
                | 'high'
                | 'medium'
                | 'low',
              status: (typeof feat.status === 'string' ? feat.status : 'planned') as
                | 'planned'
                | 'in-progress'
                | 'complete'
                | 'deferred',
              acceptanceCriteria: Array.isArray(feat.acceptanceCriteria)
                ? feat.acceptanceCriteria.filter((a): a is string => typeof a === 'string')
                : [],
              createdAt: typeof feat.createdAt === 'number' ? feat.createdAt : Date.now(),
              updatedAt: Date.now(),
            });
            this.view?.webview.postMessage({ type: 'productSaved' });
          }
          break;
        }
        case 'deleteProductFeature': {
          const fid = msg.id as string;
          if (this.forgeaiWorkspace && fid) {
            this.forgeaiWorkspace.product.deleteFeature(fid);
            this.view?.webview.postMessage({ type: 'productFeatureDeleted', id: fid });
          }
          break;
        }

        // ─── Spec system messages ───
        case 'listSpecs': {
          const specs = this.forgeaiWorkspace?.spec.listSpecs() ?? [];
          this.view?.webview.postMessage({ type: 'specList', specs });
          break;
        }
        case 'getSpec': {
          const sid = msg.id as string;
          if (this.forgeaiWorkspace && sid) {
            const spec = this.forgeaiWorkspace.spec.loadSpec(sid);
            this.view?.webview.postMessage({ type: 'specData', spec });
          }
          break;
        }
        case 'createSpec': {
          const specId = msg.id as string;
          const specTitle = typeof msg.title === 'string' ? msg.title : 'New Spec';
          if (this.forgeaiWorkspace && specId) {
            const meta = this.forgeaiWorkspace.spec.createSpec(specId, specTitle);
            this.view?.webview.postMessage({ type: 'specCreated', meta });
          }
          break;
        }
        case 'updateSpecArtifact': {
          const usid = msg.id as string;
          const utype = msg.artifactType as 'requirements' | 'design' | 'tasks' | undefined;
          const ucontent = typeof msg.content === 'string' ? msg.content : '';
          if (this.forgeaiWorkspace && usid && utype) {
            this.forgeaiWorkspace.spec.writeArtifact(usid, utype, ucontent);
            this.view?.webview.postMessage({
              type: 'specArtifactUpdated',
              id: usid,
              artifactType: utype,
            });
          }
          break;
        }
        case 'approveSpecPhase': {
          const asid = msg.id as string;
          const phase = msg.phase as 'requirements' | 'design' | 'tasks' | undefined;
          if (this.forgeaiWorkspace && asid && phase) {
            const ok = this.forgeaiWorkspace.spec.approvePhase(asid, phase);
            this.view?.webview.postMessage({ type: 'specPhaseApproved', id: asid, phase, ok });
          }
          break;
        }
        case 'deleteSpec': {
          const dsid = msg.id as string;
          if (this.forgeaiWorkspace && dsid) {
            const ok = this.forgeaiWorkspace.spec.deleteSpec(dsid);
            this.view?.webview.postMessage({ type: 'specDeleted', id: dsid, ok });
          }
          break;
        }
        case 'generateSpec': {
          const gTitle = typeof msg.title === 'string' ? msg.title : '';
          const gDesc = typeof msg.description === 'string' ? msg.description : '';
          const gMode = (msg.mode as string) === 'quick' ? 'quick' : 'full';
          if (this.forgeaiWorkspace && gTitle) {
            // Use configured model for spec generation
            const specModel = getConfiguredModel();
            const agent = new SpecWriterAgent({
              executeLLM: async (systemPrompt, userPrompt) => {
                const response = await this.ollamaClient.chat({
                  model: specModel,
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                  ],
                  stream: false,
                  options: { temperature: 0.3 },
                });
                // Non-streaming response
                const chatResponse = response as { message: { content: string } };
                return chatResponse.message.content;
              },
              specManager: this.forgeaiWorkspace.spec,
              productManager: this.forgeaiWorkspace.product,
              memoryManager: this.forgeaiWorkspace.memory,
              researchAgent: this.researchAgent,
            });

            this.view?.webview.postMessage({
              type: 'specGenerationStarted',
              title: gTitle,
            });

            agent
              .generate({ title: gTitle, description: gDesc, mode: gMode }, (event) => {
                this.view?.webview.postMessage({
                  type: 'specGenerationProgress',
                  phase: event.phase,
                  status: event.status,
                  message: event.message,
                });
              })
              .then((result) => {
                if (result.success) {
                  this.view?.webview.postMessage({
                    type: 'specGenerated',
                    specId: result.specId,
                    title: result.title,
                    phasesCompleted: result.phasesCompleted,
                  });
                } else {
                  this.view?.webview.postMessage({
                    type: 'specGenerationFailed',
                    error: result.error,
                  });
                }
              })
              .catch((err) => {
                this.view?.webview.postMessage({
                  type: 'specGenerationFailed',
                  error: err instanceof Error ? err.message : 'Unknown error',
                });
              });
          }
          break;
        }

        // ─── Hook system messages ───
        case 'listHooks': {
          const hooks = this.forgeaiWorkspace?.hooks.listHooks() ?? [];
          this.view?.webview.postMessage({ type: 'hookList', hooks });
          break;
        }
        case 'saveHook': {
          const hook = msg.hook as Record<string, unknown>;
          if (this.forgeaiWorkspace && hook && typeof hook.id === 'string') {
            const triggers = Array.isArray(hook.triggers)
              ? (hook.triggers as Array<Record<string, string>>).map((t) => ({
                  type: (t.type ?? 'file') as 'file' | 'spec' | 'command',
                  pattern: t.pattern,
                  phase: t.phase as 'requirements' | 'design' | 'tasks' | undefined,
                  command: t.command,
                }))
              : [];
            const actions = Array.isArray(hook.actions)
              ? (hook.actions as Array<Record<string, string>>).map((a) => ({
                  type: (a.type ?? 'message') as 'agent' | 'shell' | 'message',
                  prompt: a.prompt,
                  command: a.command,
                  message: a.message,
                }))
              : [];
            this.forgeaiWorkspace.hooks.saveHook({
              id: hook.id,
              name: typeof hook.name === 'string' ? hook.name : hook.id,
              description: typeof hook.description === 'string' ? hook.description : '',
              enabled: hook.enabled === true || hook.enabled === 'true',
              autoApprove: hook.autoApprove === true || hook.autoApprove === 'true',
              triggers,
              actions,
              createdAt: typeof hook.createdAt === 'number' ? hook.createdAt : Date.now(),
              updatedAt: Date.now(),
            });
            this.view?.webview.postMessage({ type: 'hookSaved', id: hook.id });
          }
          break;
        }
        case 'deleteHook': {
          const hid = msg.id as string;
          if (this.forgeaiWorkspace && hid) {
            const ok = this.forgeaiWorkspace.hooks.deleteHook(hid);
            this.view?.webview.postMessage({ type: 'hookDeleted', id: hid, ok });
          }
          break;
        }
        case 'toggleHook': {
          const thid = msg.id as string;
          if (this.forgeaiWorkspace && thid) {
            const hook = this.forgeaiWorkspace.hooks.loadHook(thid);
            if (hook) {
              hook.enabled = !hook.enabled;
              hook.updatedAt = Date.now();
              this.forgeaiWorkspace.hooks.saveHook(hook);
              this.view?.webview.postMessage({
                type: 'hookToggled',
                id: thid,
                enabled: hook.enabled,
              });
            }
          }
          break;
        }

        default:
          this.logger.warn(`Unknown message type: ${msgType}`);
      }
    } catch (error) {
      this.logger.error(`Error handling message ${msgType}`, error);
      this.view?.webview.postMessage({
        type: 'streamError',
        conversationId: typeof msg.conversationId === 'string' ? msg.conversationId : undefined,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async handleSendMessage(message: Record<string, unknown>): Promise<void> {
    const conversationId = typeof message.conversationId === 'string' ? message.conversationId : '';
    const content = typeof message.content === 'string' ? message.content : '';
    const rawHistory = Array.isArray(message.conversationHistory)
      ? message.conversationHistory
      : [];
    const model = typeof message.model === 'string' ? message.model : undefined;
    const autonomyLevel =
      typeof message.autonomyLevel === 'string' ? message.autonomyLevel : undefined;
    const selectedModel =
      model ||
      this.storageManager.getGlobalValue<string>('forgeai.selectedModel', getConfiguredModel());
    const selectedAutonomy =
      autonomyLevel ||
      this.storageManager.getGlobalValue<string>('forgeai.autonomyLevel', 'semi-autonomous');

    this.logger.info(`Sending message for conversation ${conversationId}`);
    this.logger.info(`Using model: ${selectedModel}, autonomy: ${selectedAutonomy}`);

    const agentLoop = new AgentLoop(
      this.ollamaClient,
      this.logger,
      this.toolRegistry,
      this.ragService,
      this.conversationMemory,
      this.sessionContextInjector,
      this.contextManager
    );

    const messages: OllamaMessage[] = [];
    for (const raw of rawHistory) {
      const m = raw as Record<string, unknown>;
      messages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      });
    }
    messages.push({ role: 'user', content: content || '' });

    const tools = this.toolRegistry?.getToolDefinitions() ?? [];
    await this.agentLoopRunner.execute(
      agentLoop,
      conversationId,
      messages,
      tools,
      selectedModel,
      selectedAutonomy
    );
  }

  private async handleRetryAfterError(message: Record<string, unknown>): Promise<void> {
    const conversationId = typeof message.conversationId === 'string' ? message.conversationId : '';
    const errorMessage = typeof message.errorMessage === 'string' ? message.errorMessage : '';
    const rawHistory = Array.isArray(message.conversationHistory)
      ? message.conversationHistory
      : [];
    const model = typeof message.model === 'string' ? message.model : undefined;
    const selectedModel =
      model ||
      this.storageManager.getGlobalValue<string>('forgeai.selectedModel', getConfiguredModel());

    this.logger.info(`Retrying after error for conversation ${conversationId}`);

    const agentLoop = new AgentLoop(
      this.ollamaClient,
      this.logger,
      this.toolRegistry,
      this.ragService,
      this.conversationMemory,
      this.sessionContextInjector,
      this.contextManager
    );

    const messages: OllamaMessage[] = [];
    for (const raw of rawHistory) {
      const m = raw as Record<string, unknown>;
      messages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: typeof m.content === 'string' ? m.content : '',
      });
    }

    messages.push({
      role: 'user',
      content: `I encountered an error: ${errorMessage}. Please fix this issue and continue.`,
    });

    const retryTools = this.toolRegistry?.getToolDefinitions() ?? [];
    await this.agentLoopRunner.execute(
      agentLoop,
      conversationId,
      messages,
      retryTools,
      selectedModel,
      'semi-autonomous'
    );
  }

  private async handleStopAgentLoop(message: Record<string, unknown>): Promise<void> {
    const conversationId = typeof message.conversationId === 'string' ? message.conversationId : '';
    this.agentLoopRunner.stopAgentLoop(conversationId);
  }

  private async handleFetchOllamaModels(): Promise<void> {
    try {
      const models = await this.ollamaClient.listModels();
      this.view?.webview.postMessage({ type: 'ollamaModels', models });
    } catch (error) {
      const details = categorizeOllamaFetchError(error);
      this.logger.error('Failed to fetch Ollama models', error);
      this.view?.webview.postMessage({
        type: 'ollamaModelsError',
        error: {
          code: details.code,
          title: details.title,
          message: details.message,
          steps: details.steps,
        },
      });
    }
  }

  private async handleExportConversation(message: Record<string, unknown>): Promise<void> {
    try {
      const content = typeof message.content === 'string' ? message.content : '';
      const fileName = typeof message.fileName === 'string' ? message.fileName : 'conversation.md';
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(fileName || 'conversation.md'),
        filters: { Markdown: ['md'], Text: ['txt'] },
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        vscode.window.showInformationMessage(`Conversation exported to ${uri.fsPath}`);
      }
    } catch (error) {
      this.logger.error('Failed to export conversation', error);
      vscode.window.showErrorMessage(
        `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleExportCurrentConversation(message: Record<string, unknown>): Promise<void> {
    return this.handleExportConversation(message);
  }
}
