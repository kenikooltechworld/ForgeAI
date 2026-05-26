# Comprehensive Context Management Research

## How Copilot, Qodo, Windsurf, and Kiro Handle Context Windows

**Date:** May 26, 2026  
**Research Focus:** Context window management strategies for long-running AI sessions  
**Problem:** ForgeAI returns 400 Bad Request when context exceeds model limits

---

## Executive Summary

Industry-leading AI coding assistants use **4 core strategies** to handle context overflow:

1. **Compaction** (GitHub Copilot) - Summarize conversation history intelligently
2. **Sliding Window** (Qodo, Windsurf) - Keep only recent context
3. **Checkpoints** (GitHub Copilot) - Save snapshots at compaction points
4. **Memory Persistence** (Windsurf, Kiro) - Maintain context across sessions

**Key Finding:** None of them let the context overflow cause a 400 error. They all **prevent** it proactively.

---

## 1. GitHub Copilot CLI - Compaction Strategy

### How It Works

**Automatic Compaction Trigger:**

- When context reaches **80% capacity**, Copilot CLI automatically starts compacting
- Leaves a **20% buffer** for tool calls to continue running
- If context reaches **95%**, Copilot pauses briefly to wait for compaction

**What Compaction Does:**

1. Takes a snapshot of current conversation history
2. Sends full conversation to AI model with special prompt asking for structured summary
3. Summary captures:
   - Goals of the conversation
   - What was done
   - Key technical details
   - Important files
   - Planned next steps
4. Replaces old conversation history with summary + original user instructions + current state

**Result:** Conversation history compressed into much smaller summary, freeing up majority of context window

### Monitoring & Control

**User Commands:**

- `/context` - Shows visual breakdown of token usage (System/Tools, Messages, Free Space, Buffer)
- `/compact` - Manually trigger compaction
- `/session checkpoints` - View all saved checkpoints
- `/resume` - Resume previous sessions with checkpoints

**Checkpoint System:**

- Every compaction creates a numbered, titled checkpoint
- Checkpoints are saved copies of compaction summaries
- Stored as numbered files in session workspace
- Useful for reviewing what happened in earlier phases

### What Compaction Preserves vs Loses

**Preserved:**

- Key decisions and facts
- Technical details
- Pending actions
- Overall conversation flow

**Lost (Inevitably):**

- Exact wording of every message
- Full output of every command
- Minor decisions from early in conversation
- Fine-grained details

### When to Use Long Sessions vs Fresh Sessions

**Use Long Sessions When:**

- Multi-phase task (scaffolding → implementation → testing → PR)
- Iterating on a problem (want Copilot to remember what's been tried)
- Exploratory work across codebase (building shared understanding)

**Start Fresh Session When:**

- Switching to unrelated task
- Too many compactions and important context is being lost
- Want clean slate (work went wrong direction)

---

## 2. Qodo (Codium) - Context Engineering Strategy

### Core Approach

Qodo uses **context engineering** combining:

1. **Prompt design** - Carefully structured instructions
2. **Memory systems** - Persistent per-conversation memory
3. **RAG (Retrieval-Augmented Generation)** - Grounding with documentation

### Key Concept: "Context Rot"

Qodo team identified phenomenon called **"context rot"**:

- Pack too much context → agent slows down, loses focus, produces lower quality
- Pack too little context → agent guesses, hallucinates, asks same questions repeatedly

**Solution:** Precise context management that balances completeness with clarity

### Memory System

Qodo learns from PR history:

- Thousands of pull requests carry signals about how team works
- These signals form "collective memory" of repository
- Used to provide context-aware code suggestions

### Context-Aware Code Review

- Detects critical issues
- Identifies logic gaps
- Enforces standards
- Accelerates reviews with accurate, actionable insights

---

## 3. Windsurf IDE - Memory Persistence Strategy

### Architecture

Windsurf 2 has **three first-class surfaces:**

1. **Cascade** - Multi-file edits and tool calls in editor
2. **Workflows** - Make agentic workflows repeatable
3. **Memory** - Persists context across sessions

### Context Management Features

**Cascade Context-Aware Streaming:**

- Reads open files, git state, active selection before you ask
- Adapts as you type
- Supports up to 100K lines for multi-file refactors

**Memory Persistence:**

- Maintains deep context across sessions
- Automatically documents decisions
- Tracks progress and architectural evolution
- Perfect for complex projects demanding consistent understanding

### Session Management

**Git Worktrees Support:**

- Run Cascade tasks in parallel without interfering with main workspace
- Each Cascade conversation gets own session
- Allows edits, builds, and testing without affecting main workspace

### Configuration

**`.windsurfrules` File:**

- Single biggest productivity lever
- Blank by default (users must write it)
- Defines project conventions and context

---

## 4. Kiro - Spec-Driven Context Management

### Core Philosophy

Kiro emphasizes **spec-driven, plan-first development** rather than token-by-token autocomplete

### Token Budget Management

**Key Concept:** "Efficient Token Usage"

Every token sent to AI agent is a slice of its working memory:

- Pack too much → agent slows down, loses focus, lower quality output
- Pack too little → agent guesses, hallucinates, asks same questions

**Solution:** Structured specs that formalize development process

### Context Layers in Kiro

1. **Spec Context** - Current task, requirements, acceptance criteria
2. **System Prompt** - Core identity, rules, tool guidelines
3. **Message Classification** - Classifies user intent
4. **Conversation Memory** - Per-conversation tool call history
5. **Agent Loop** - Manages multi-iteration tool execution
6. **LLM Client** - Streaming chat with tool calling
7. **Storage** - VS Code state + filesystem

### Task Dependency Graph

Kiro builds dependency graph from task list:

- Identifies which tasks write to same files
- Identifies which tasks test code from earlier tasks
- Identifies truly independent tasks
- Tasks touching same files never run in parallel
- Setup/infrastructure runs first
- Tests run after code they validate

### Spec Workflow

**Vibe Requests** → Create requirements and design documents  
**Spec Requests** → Execute tasks within structured workflow

---

## 5. Context Overflow Solutions - Technical Strategies

### Strategy 1: Truncation (Sliding Window)

**How It Works:**

```
Keep system prompt + most recent messages within token budget
Drop oldest messages first
```

**Pros:**

- Simplest approach
- Lowest cost
- Fastest (less input)

**Cons:**

- May lose important context
- Dangerous for agent workflows where early instructions affect later behavior
- Risky for legal/compliance contexts

**Best For:**

- Multi-turn chat where recent context matters most
- RAG pipelines where you can re-retrieve if needed
- Batch processing where you process in order

### Strategy 2: Summarization (Compression)

**How It Works:**

```
1. Use cheaper model to compress prior context into summary
2. Replace old messages with summary
3. Keep recent messages intact
```

**Cost Comparison:**

- No management: 0 cost but request rejected
- Truncate to 80K: Base cost at 80K input
- Summarize: ~$0.01 (summarization call) + lower main call cost

**Pros:**

- Preserves meaning
- Maintains continuity
- Often reduces total cost for expensive models

**Cons:**

- Lossy (summary may miss details)
- Extra API call
- Adds latency

**Best For:**

- Agent workflows with accumulated state
- Knowledge-heavy conversations
- Long-running sessions where context matters

### Strategy 3: Chunking & Merging

**How It Works:**

```
1. Split long document into chunks
2. Process each chunk separately
3. Merge results
```

**Pros:**

- Handles arbitrarily long inputs
- Parallel processing possible

**Cons:**

- Cross-chunk context lost
- Multiple API calls = higher cost and latency
- Mitigation: Overlap chunks by 10-20%

**Best For:**

- Document processing
- Analysis over long texts
- When input cannot be reduced

### Strategy 4: Switch to Larger Context Model

**Current Model Context Windows:**

- GPT-5.4: 1M tokens (128K max output)
- Claude Sonnet/Opus: 1M tokens (64K max output)
- DeepSeek V4: 1M tokens (384K max output)
- Gemini 2.5 Pro: 1M tokens (65K max output)

**Tradeoff:**

- Larger context = higher per-token cost
- Calculate whether quality improvement justifies cost

---

## 6. Production Pattern: Pre-Check Before Sending

**Critical:** Do NOT wait for API to reject request

**Pre-Check Implementation:**

```
1. Count tokens in messages before sending
2. Compare against model's max context window
3. If exceeds:
   - Apply appropriate strategy (truncate/summarize/chunk/switch)
   - Avoid wasted latency from rejected requests
   - Let user see error before API rejects
```

**Quick Fix Checklist:**

- [ ] Conversation history too long? → Trim oldest messages
- [ ] System prompt too large? → Compress or move to reference
- [ ] Duplicate content? → Deduplicate before sending
- [ ] Large tool results? → Truncate or summarize
- [ ] Unnecessary metadata? → Extract only relevant fields

---

## 7. Comparison Table: Industry Approaches

| Aspect                  | Copilot                  | Qodo                    | Windsurf           | Kiro                 |
| ----------------------- | ------------------------ | ----------------------- | ------------------ | -------------------- |
| **Primary Strategy**    | Compaction + Checkpoints | Context Engineering     | Memory Persistence | Spec-Driven Planning |
| **Trigger Point**       | 80% capacity             | Continuous optimization | Per-session        | Per-task             |
| **Preservation Method** | Intelligent summary      | RAG + memory            | Session state      | Spec artifacts       |
| **User Control**        | `/compact`, `/context`   | Automatic               | `.windsurfrules`   | Task dependencies    |
| **Session Continuity**  | Checkpoints              | PR history learning     | Persistent memory  | Spec checkpoints     |
| **Error Handling**      | Prevents overflow        | Prevents overflow       | Prevents overflow  | Prevents overflow    |
| **Cost Optimization**   | Summarization            | Context engineering     | Memory reuse       | Task batching        |

---

## 8. ForgeAI Current Issues vs Industry Standards

### Current ForgeAI Problems

1. **No Pre-Check:** Sends request without checking token count
2. **No Compaction:** Conversation history grows unbounded
3. **No Summarization:** No mechanism to compress old context
4. **No Checkpoints:** No way to save/resume sessions
5. **No Memory Injection:** Agent doesn't know what it already did
6. **Workspace Context Regenerated:** Scans filesystem every iteration

### Industry Standard Approach

✅ Pre-check token count before sending  
✅ Implement sliding window or compaction at 80% capacity  
✅ Summarize old context when approaching limit  
✅ Create checkpoints for session continuity  
✅ Inject conversation memory into system prompt  
✅ Cache workspace context with TTL

---

## 9. Recommended Implementation for ForgeAI

### Phase 1: Immediate (Prevent 400 Errors)

1. **Add Token Pre-Check**
   - Count tokens before sending to Ollama
   - If exceeds limit, apply strategy before sending
   - Never let request reach API in invalid state

2. **Implement Sliding Window**
   - Keep system prompt + most recent N messages
   - Drop oldest messages first
   - Maintain 20% buffer for tool calls

3. **Add Context Usage Display**
   - Show user current token usage
   - Display free space remaining
   - Warn when approaching 80% capacity

### Phase 2: Short-term (Improve Quality)

1. **Implement Compaction**
   - At 80% capacity, summarize old messages
   - Use cheaper model (Gemma4-31B) for summarization
   - Replace old history with summary

2. **Add Checkpoints**
   - Save compaction summaries
   - Allow session resumption
   - Track conversation phases

3. **Inject Conversation Memory**
   - Call `conversationMemory.getMemorySummary()`
   - Add to system prompt as "What You've Already Done"
   - Prevent redundant operations

### Phase 3: Long-term (Optimize)

1. **Model-Specific Context Windows**
   - Map model → context window size
   - Adjust `num_ctx` based on selected model
   - Support larger models (Qwen3: 128K)

2. **Smart Truncation**
   - Truncate by content type (JSON, code, text)
   - Preserve structure, not just text
   - Offer tool to fetch full content

3. **RAG Context Refresh**
   - Refresh RAG after tool errors
   - Use different queries for new context
   - Limit refreshes to prevent loops

---

## 10. Key Takeaways

### What Works

✅ **Compaction** - Most effective for long sessions  
✅ **Checkpoints** - Enable session continuity  
✅ **Pre-checking** - Prevent errors before they happen  
✅ **Memory Injection** - Prevent redundant operations  
✅ **Sliding Window** - Simple, effective for chat

### What Doesn't Work

❌ Letting context overflow cause 400 errors  
❌ Regenerating workspace context every iteration  
❌ Not tracking what agent already did  
❌ Hardcoding context window size  
❌ Truncating without warning user

### Best Practice Pattern

```
1. Pre-check token count
2. If approaching 80%:
   - Summarize old context (if important)
   - OR truncate oldest messages (if recent matters)
   - OR switch to larger model (if budget allows)
3. Create checkpoint before major phase
4. Inject conversation memory into system prompt
5. Cache expensive operations (workspace context, RAG)
6. Display token usage to user
7. Allow manual compaction via command
```

---

## References

- GitHub Copilot CLI Documentation: Context Management
- EvoLink.AI: Context Length Exceeded in LLM API Calls
- Kiro Blog: Efficient Token Usage on Kiro
- Windsurf Documentation: Context Awareness
- Qodo Blog: Context Engineering & Context Windows

---

**Next Steps for ForgeAI:**

1. Implement token pre-check in OllamaClient
2. Add sliding window to AgentLoop
3. Inject ConversationMemory summary into system prompt
4. Add `/context` command to show token usage
5. Implement compaction at 80% capacity
