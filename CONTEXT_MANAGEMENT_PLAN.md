# ForgeAI Context Management Implementation Plan

## Problem Statement

**Current Issue:** ForgeAI returns `400 Bad Request` when conversation context exceeds model's token limit

**Root Cause:** No proactive context management - request sent without checking if it fits

**Industry Standard:** All major AI coding assistants (Copilot, Qodo, Windsurf, Kiro) prevent this by managing context BEFORE sending

---

## Solution Architecture

### Layer 1: Token Pre-Check (CRITICAL)

**Location:** `OllamaClient.ts` before sending request

```typescript
// BEFORE sending to Ollama, check if request fits
const totalTokens = countTokens(systemPrompt + messages + toolDefinitions);
const modelContextWindow = getModelContextWindow(model); // 8192 for Gemma4

if (totalTokens > modelContextWindow * 0.95) {
  // Apply strategy BEFORE sending
  // Don't let request reach API in invalid state
}
```

**Benefit:** Prevents 400 errors entirely

---

### Layer 2: Sliding Window (IMMEDIATE)

**Location:** `AgentLoop.ts` when building messages array

**Strategy:** Keep system prompt + most recent messages within 80% of context window

```
Total Budget: 8192 tokens
Safe Limit: 6554 tokens (80%)
Buffer: 1638 tokens (20%)

Allocation:
- System Prompt: 2000 tokens (fixed)
- Tool Definitions: 1000 tokens (fixed)
- Available for Messages: 3554 tokens
- Keep most recent messages until budget exhausted
- Drop oldest messages first
```

**Benefit:** Prevents overflow while preserving recent context

---

### Layer 3: Conversation Memory Injection (HIGH IMPACT)

**Location:** `AgentLoop.ts` when building system prompt

**Current State:** ConversationMemory tracks what agent did, but this info is NEVER used

**Fix:** Inject memory summary into system prompt

```typescript
// Get what agent already did in this conversation
const memorySummary = conversationMemory.getMemorySummary(conversationId);

// Add to system prompt
const systemPrompt = `
${baseSystemPrompt}

## What You've Already Done in This Conversation

${memorySummary}

IMPORTANT: Do NOT repeat these operations:
- Do NOT re-read files you've already read
- Do NOT re-list directories you've already listed
- Do NOT re-search topics you've already researched
`;
```

**Benefit:** 30-50% fewer iterations, prevents redundant operations

---

### Layer 4: Compaction at 80% (ADVANCED)

**Location:** `AgentLoop.ts` when context reaches 80%

**Strategy:** Summarize old conversation history using cheaper model

```
When context reaches 80%:
1. Take snapshot of conversation history
2. Send to Gemma4-31B with summarization prompt
3. Replace old messages with summary
4. Keep recent messages intact
5. Create checkpoint for session resumption

Result: Frees up 60-70% of context window
```

**Benefit:** Enables long-running sessions without hitting limits

---

### Layer 5: Checkpoints (SESSION CONTINUITY)

**Location:** `ConversationMemory.ts`

**Strategy:** Save compaction summaries as checkpoints

```
Checkpoint Structure:
- Checkpoint ID (auto-incrementing)
- Title (auto-generated from conversation phase)
- Summary (from compaction)
- Timestamp
- Files touched
- Key decisions made

User Commands:
- `/checkpoints` - List all checkpoints
- `/checkpoint 2` - View checkpoint 2
- `/resume` - Resume from checkpoint
```

**Benefit:** Users can resume long sessions, review earlier phases

---

## Implementation Roadmap

### Phase 1: Prevent 400 Errors (Week 1)

**Priority:** 🔴 CRITICAL

**Tasks:**

1. Add token counting to OllamaClient
2. Implement pre-check before sending request
3. Add sliding window to AgentLoop
4. Display token usage in webview

**Files to Modify:**

- `src/extension/ollama/OllamaClient.ts`
- `src/extension/ollama/AgentLoop.ts`
- `src/extension/utils/ConversationMemory.ts`

**Expected Outcome:** No more 400 errors

---

### Phase 2: Improve Quality (Week 2)

**Priority:** 🟠 HIGH

**Tasks:**

1. Inject conversation memory into system prompt
2. Implement compaction at 80% capacity
3. Add checkpoint system
4. Add `/context` command to show token usage

**Files to Modify:**

- `src/extension/ollama/AgentLoop.ts`
- `src/extension/utils/ConversationMemory.ts`
- `src/extension/utils/WebviewMessageRouter.ts`

**Expected Outcome:** 30-50% fewer iterations, better context preservation

---

### Phase 3: Optimize (Week 3)

**Priority:** 🟡 MEDIUM

**Tasks:**

1. Model-specific context window configuration
2. Smart tool result truncation
3. RAG context refresh during loop
4. Session resumption from checkpoints

**Files to Modify:**

- `src/extension/ollama/ModelRouter.ts`
- `src/extension/ollama/AgentLoop.ts`
- `src/extension/rag/RagService.ts`

**Expected Outcome:** Better token utilization, longer sessions

---

## Token Budget Breakdown (Current)

**Context Window:** 8192 tokens (Gemma4-31B)

| Component                  | Tokens   | %       |
| -------------------------- | -------- | ------- |
| System Prompt              | 2000     | 24%     |
| Tool Definitions           | 1000     | 12%     |
| Conversation History       | 2000     | 24%     |
| Tool Results               | 2000     | 24%     |
| **Available for Response** | **1192** | **15%** |

**Problem:** Only 15% available for actual response!

---

## Token Budget After Fixes (Projected)

**With Sliding Window + Memory Injection + Compaction:**

| Component                   | Tokens   | %       |
| --------------------------- | -------- | ------- |
| System Prompt               | 1500     | 18%     |
| Tool Definitions            | 800      | 10%     |
| Conversation Memory Summary | 500      | 6%      |
| Recent Messages             | 2000     | 24%     |
| Tool Results                | 1500     | 18%     |
| **Available for Response**  | **1892** | **23%** |

**Improvement:** 15% → 23% (53% more space for responses)

---

## Comparison: Before vs After

### Before (Current)

```
User: "Implement user authentication"
  ↓
AgentLoop sends full conversation history
  ↓
Context fills up (8192 tokens)
  ↓
400 Bad Request ❌
  ↓
User frustrated, session lost
```

### After (Proposed)

```
User: "Implement user authentication"
  ↓
Pre-check: 6200 tokens (safe)
  ↓
Inject memory: "You already read auth.ts, created login.ts"
  ↓
Agent avoids redundant operations
  ↓
At 80% capacity: Compaction triggered
  ↓
Old messages summarized, checkpoint created
  ↓
Session continues smoothly ✅
  ↓
User can `/resume` later from checkpoint
```

---

## Key Metrics to Track

### Before Implementation

- [ ] Average tokens per request
- [ ] Requests hitting 400 errors
- [ ] Average iterations per task
- [ ] Redundant tool calls (re-reads, re-lists)
- [ ] Session abandonment rate

### After Implementation

- [ ] Average tokens per request (should decrease)
- [ ] Requests hitting 400 errors (should be 0)
- [ ] Average iterations per task (should decrease 30-50%)
- [ ] Redundant tool calls (should decrease 50%+)
- [ ] Session abandonment rate (should decrease)
- [ ] Compaction frequency
- [ ] Checkpoint usage

---

## Risk Assessment

### Risk 1: Losing Important Context During Compaction

**Severity:** 🟠 MEDIUM  
**Mitigation:**

- Checkpoints preserve full summaries
- Users can review checkpoints
- Compaction only happens at 80%, not aggressively

### Risk 2: Summarization Adds Latency

**Severity:** 🟡 LOW  
**Mitigation:**

- Summarization happens in background
- Uses cheaper model (Gemma4-31B)
- Only triggered at 80%, not every message

### Risk 3: Memory Injection Causes Hallucination

**Severity:** 🟡 LOW  
**Mitigation:**

- Memory summary is factual (tool calls, files read)
- Not speculative
- Can be disabled if issues arise

### Risk 4: Sliding Window Loses Early Context

**Severity:** 🟠 MEDIUM  
**Mitigation:**

- Only drops oldest messages
- Compaction preserves key points
- Checkpoints save full history

---

## Success Criteria

### Phase 1 (Week 1)

- ✅ No 400 errors in test sessions
- ✅ Token usage displayed to user
- ✅ Sliding window working correctly
- ✅ Pre-check prevents overflow

### Phase 2 (Week 2)

- ✅ Memory injection reduces iterations by 30%+
- ✅ Compaction triggers at 80%
- ✅ Checkpoints created and retrievable
- ✅ `/context` command shows accurate usage

### Phase 3 (Week 3)

- ✅ Model-specific context windows working
- ✅ Smart truncation preserves structure
- ✅ RAG refresh improves documentation grounding
- ✅ Session resumption from checkpoints works

---

## Implementation Checklist

### Phase 1: Token Pre-Check & Sliding Window

- [ ] Add `countTokens()` function to OllamaClient
- [ ] Add `getModelContextWindow()` function to ModelRouter
- [ ] Implement pre-check in OllamaClient.chat()
- [ ] Implement sliding window in AgentLoop.execute()
- [ ] Add token usage display to webview
- [ ] Test with long conversations
- [ ] Verify no 400 errors

### Phase 2: Memory Injection & Compaction

- [ ] Implement `getMemorySummary()` in ConversationMemory
- [ ] Inject memory into system prompt in AgentLoop
- [ ] Implement compaction trigger at 80%
- [ ] Create summarization prompt
- [ ] Implement checkpoint system
- [ ] Add `/context` command
- [ ] Test with multi-phase tasks
- [ ] Verify iteration reduction

### Phase 3: Optimization

- [ ] Create model context window mapping
- [ ] Implement smart truncation by content type
- [ ] Implement RAG refresh logic
- [ ] Add session resumption
- [ ] Test with large codebases
- [ ] Performance benchmarking

---

## Questions for User

1. **Compaction Frequency:** Should compaction happen at 80% or 90%?
2. **Summarization Model:** Use Gemma4-31B or different model?
3. **Checkpoint Retention:** How many checkpoints to keep? (default: 10)
4. **Memory Injection:** Always inject, or only when approaching limit?
5. **User Notifications:** Show compaction happening, or silent?

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize phases** based on urgency
3. **Assign implementation tasks**
4. **Set up monitoring** for metrics
5. **Begin Phase 1** implementation

---

**Document Created:** May 26, 2026  
**Status:** Ready for Implementation  
**Estimated Effort:** 3-4 weeks (all phases)
