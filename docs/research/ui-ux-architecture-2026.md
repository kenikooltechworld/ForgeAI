# UI/UX Architecture Research — 2026

**Project:** ForgeAI - Autonomous AI Coding Assistant  
**Research Date:** May 3, 2026  
**Focus Areas:** Interface Design, Thinking Visualization, Activity Feeds, Conversation Persistence, First Launch Experience  
**Primary Sources:**
- [Xcapit - Designing UX for AI Agents](https://www.xcapit.com/en/blog/designing-ux-ai-agents)
- [InfoQ - Cursor 3 Agent-First Interface](https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/)
- [MindStudio - Claude Interactive Visualization](https://www.mindstudio.ai/blog/what-is-claude-interactive-visualization-generative-ui)
- [GitHub - ThinkChain (Claude Streaming with Thinking)](https://github.com/martinbowling/ThinkChain)
- [Microsoft - Chat History Storage Patterns](https://devblogs.microsoft.com/agent-framework/chat-history-storage-patterns-in-microsoft-agent-framework)
- [Cloudscape Design System - GenAI History Patterns](https://cloudscape.design/patterns/genai/history/)
- [LangChain - Frontend Tool Calling Patterns](https://docs.langchain.com/oss/javascript/langchain/frontend/tool-calling)

---

## Executive Summary

This research provides a comprehensive analysis of UI/UX architecture patterns for building ForgeAI's autonomous AI coding assistant interface. The key finding is that **modern AI assistants require a fundamental shift from traditional chat interfaces to agent-centric, activity-driven experiences** that make AI thinking visible, tool execution transparent, and conversations persistent.

**Key Findings:**
- ✅ **Split-screen architecture** - Chat/activity stream + live code preview (Claude Artifacts pattern)
- ✅ **Inline thinking visualization** - Show AI reasoning process in real-time (ThinkChain pattern)
- ✅ **Real-time activity feed** - Live tool execution status with expandable details
- ✅ **Progressive autonomy** - 3-tier system (supervised → semi-autonomous → autonomous)
- ✅ **Conversation persistence** - Per-workspace, per-tab storage with VS Code APIs
- ✅ **Command palette + suggestion chips** - Eliminate "blank prompt problem"
- ⚠️ **Chat is not always the answer** - Structured UI for repeated workflows
- ⚠️ **Trust through transparency** - Confidence indicators, "Why?" buttons, escape hatches

**Critical Insight from Xcapit:**
> "Nobody wants to see the prompt. The best AI experience is one where the user doesn't think about AI at all. The agent's capabilities are woven so naturally into the workflow that they feel like features of the product, not interactions with an AI system."

**Recommended Architecture:**
- **Primary Interface:** Split-screen with activity stream + live preview
- **Interaction Model:** Command palette (Cmd+K) + suggestion chips + natural language
- **Thinking Visualization:** Collapsible inline blocks with confidence indicators
- **Tool Feedback:** Real-time status cards with expandable details
- **Persistence:** VS Code workspaceState with per-tab isolation
- **First Launch:** Auto-select Qwen3-Coder-397B + quick start suggestions

---

## Table of Contents

1. [First Launch Experience](#1-first-launch-experience)
2. [Main Interface Architecture](#2-main-interface-architecture)
3. [AI Thinking Visualization](#3-ai-thinking-visualization)
4. [Activity Feed & Tool Execution](#4-activity-feed--tool-execution)
5. [Conversation Persistence](#5-conversation-persistence)
6. [Progressive Autonomy System](#6-progressive-autonomy-system)
7. [Trust & Transparency Patterns](#7-trust--transparency-patterns)
8. [Error Handling & Graceful Degradation](#8-error-handling--graceful-degradation)
9. [Multi-Step Workflows](#9-multi-step-workflows)
10. [Command Palette & Suggestion Chips](#10-command-palette--suggestion-chips)
11. [Implementation Examples](#11-implementation-examples)
12. [Recommended Component Architecture](#12-recommended-component-architecture)

---

## 1. First Launch Experience

### Status: ✅ **CRITICAL - Sets User Expectations**

The first launch experience is the user's introduction to ForgeAI. It must be welcoming, clear about capabilities, and guide users to their first successful interaction.

### Design Principles

1. **Auto-configuration** - Qwen3-Coder-397B pre-selected (no model choice paralysis)
2. **Immediate value** - Show what ForgeAI can do, not what it is
3. **Progressive disclosure** - Don't overwhelm with features
4. **Quick wins** - Guide to first successful task

### Welcome Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    Welcome to ForgeAI 🚀                        │
│                                                                 │
│            Your autonomous AI coding assistant                  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ ✓ Connected to Qwen3-Coder-397B (Cloud)                  │ │
│  │   Fast, intelligent, and ready to help                    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 🎯 What would you like to do?                             │ │
│  │                                                           │ │
│  │  [🐛 Fix a bug]           [✨ Build a feature]           │ │
│  │                                                           │ │
│  │  [📖 Explain code]        [🧪 Generate tests]            │ │
│  │                                                           │ │
│  │  [🔍 Review changes]      [📝 Write docs]                │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Or just start typing below...                                 │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Ask ForgeAI anything...                            [Send] │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  💡 Tip: Use Cmd+K anywhere to open the command palette        │
│                                                                 │
│  [View Documentation]  [Settings]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Empty State (No Conversations)

When the user has no active conversations:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                         💬                                      │
│                                                                 │
│              Start a conversation with ForgeAI                  │
│                                                                 │
│  Try asking:                                                    │
│  • "Fix the authentication bug in login.ts"                    │
│  • "Add a user dashboard with charts"                          │
│  • "Explain how the payment flow works"                        │
│  • "Generate unit tests for UserService"                       │
│  • "Review my last commit for issues"                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Quick Actions:                                            │ │
│  │                                                           │ │
│  │  [Analyze Codebase]  [Fix Bugs]  [Generate Tests]        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Or use Cmd+K to open command palette                          │
└─────────────────────────────────────────────────────────────────┘
```

### First Interaction Flow

**Step 1: User clicks "Fix a bug"**
```
ForgeAI: I'll help you fix a bug. Can you describe the issue, 
or should I analyze recent error logs and test failures?

[Describe the bug]  [Analyze logs]  [Check test failures]
```

**Step 2: User describes bug**
```
User: The login form crashes when email is empty

ForgeAI: 🧠 Let me investigate...

[Activity Stream shows:]
📖 Reading src/components/LoginForm.tsx
✓  Found the login form component
🧠 Analyzing the validation logic...
⚠️  Found the issue: Missing null check on line 45
🔧 Generating fix...
```

**Step 3: Show fix with explanation**
```
ForgeAI: I found the issue! The form doesn't validate empty 
email before submission. Here's the fix:

[Code diff shown in preview panel]

This adds email validation before the API call, preventing 
the crash.

[Apply Fix]  [Explain More]  [Show Tests]
```

### Onboarding Tooltips (Progressive)

Show contextual tooltips on first use:

**First message sent:**
```
┌─────────────────────────────────────────┐
│ 💡 Tip: ForgeAI shows its thinking      │
│    process. Click any thinking block    │
│    to see detailed reasoning.           │
│                                         │
│    [Got it]  [Don't show again]        │
└─────────────────────────────────────────┘
```

**First tool execution:**
```
┌─────────────────────────────────────────┐
│ 💡 Tip: Click any tool card to see     │
│    execution details and results.       │
│                                         │
│    [Got it]  [Don't show again]        │
└─────────────────────────────────────────┘
```

**First code change:**
```
┌─────────────────────────────────────────┐
│ 💡 Tip: All changes can be undone.     │
│    Use Cmd+Z or click the undo button. │
│                                         │
│    [Got it]  [Don't show again]        │
└─────────────────────────────────────────┘
```

### Settings (Minimal on First Launch)

Only show essential settings:

```
┌─────────────────────────────────────────────────┐
│ ⚙️  ForgeAI Settings                            │
├─────────────────────────────────────────────────┤
│                                                 │
│ Model Configuration                             │
│ ✓ Qwen3-Coder-397B (Cloud) - Auto-selected     │
│                                                 │
│ Autonomy Level                                  │
│ ○ Supervised - Ask before every action         │
│ ● Semi-Autonomous - Ask for unusual actions    │
│ ○ Autonomous - Act independently               │
│                                                 │
│ Thinking Visibility                             │
│ ● Show thinking process (recommended)           │
│ ○ Hide thinking process                        │
│                                                 │
│ [Save Settings]  [Advanced Settings]           │
└─────────────────────────────────────────────────┘
```

**Conclusion:** First launch should feel welcoming, not overwhelming. Auto-select model, provide clear quick actions, and guide users to their first successful interaction.

---

## 2. Main Interface Architecture

### Status: ✅ **CORE PATTERN - Split-Screen with Activity Stream**

Based on research from Cursor 3, Claude Artifacts, and Xcapit UX patterns, the main interface uses a **split-screen layout** with activity stream on the left and live preview/code on the right.

### Overall Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ForgeAI                                    [Tabs] [Settings] [History] [?]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────────────────────────────────┬─────────────────────────────────┐ │
│ │ Activity Stream & Conversation      │ Live Preview / Code View        │ │
│ │                                     │                                 │ │
│ │ [Tab: Fix Auth Bug] [+]            │ ┌─────────────────────────────┐ │ │
│ │ ─────────────────────────────────  │ │ src/auth/login.ts           │ │ │
│ │                                     │ │                             │ │ │
│ │ User: Fix the auth bug              │ │ - const token = req.token;  │ │ │
│ │                                     │ │ + const token = req.token   │ │ │
│ │ 🧠 Analyzing request...              │ │ +   || null;                │ │ │
│ │                                     │ │                             │ │ │
│ │ 📖 Reading src/auth/login.ts        │ │ [Apply] [Reject] [Explain]  │ │ │
│ │ ✓  Found authentication logic       │ └─────────────────────────────┘ │ │
│ │                                     │                                 │ │
│ │ 🧠 Identified the issue...           │ ┌─────────────────────────────┐ │ │
│ │                                     │ │ Test Results                │ │ │
│ │ 🔧 Generating fix...                 │ │                             │ │ │
│ │ ✓  Fix generated                    │ │ ✓ login.test.ts (5/5)       │ │ │
│ │                                     │ │ ✓ auth.test.ts (12/12)      │ │ │
│ │ ForgeAI: I found the issue!         │ │                             │ │ │
│ │ The token validation is missing...  │ │ All tests passing ✓         │ │ │
│ │                                     │ └─────────────────────────────┘ │ │
│ │ [View Details ▼]                    │                                 │ │
│ │                                     │                                 │ │
│ │ ─────────────────────────────────  │                                 │ │
│ │                                     │                                 │ │
│ │ ┌─────────────────────────────────┐ │                                 │ │
│ │ │ Ask ForgeAI...          [Send] │ │                                 │ │
│ │ └─────────────────────────────────┘ │                                 │ │
│ └─────────────────────────────────────┴─────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Left Panel: Activity Stream & Conversation

**Components:**
1. **Tab Bar** - Browser-like tabs for multiple conversations
2. **Activity Stream** - Real-time feed of AI actions
3. **Conversation History** - User messages + AI responses
4. **Input Box** - Natural language input with suggestions

**Layout Breakdown:**

```
┌─────────────────────────────────────────┐
│ [Conversation 1] [Conversation 2] [+]   │ ← Tab Bar
├─────────────────────────────────────────┤
│                                         │
│ User: Fix the authentication bug        │ ← User Message
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🧠 Thinking                         │ │ ← Thinking Block
│ │ I need to first understand the      │ │   (Collapsible)
│ │ current auth implementation...      │ │
│ │ [Collapse ▲]                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔧 readFile              [Expand ▼] │ │ ← Tool Card
│ │ src/auth/login.ts                   │ │   (Expandable)
│ │ Status: ✓ Complete (234ms)          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🧠 Thinking                         │ │
│ │ I found the issue - missing null    │ │
│ │ check on line 45...                 │ │
│ │ [Collapse ▲]                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ForgeAI: I found the issue! The token  │ ← AI Response
│ validation is missing a null check.    │
│ Here's the fix:                        │
│                                         │
│ [View Code] [Apply Fix] [Explain More] │ ← Action Buttons
│                                         │
│ ─────────────────────────────────────  │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Ask ForgeAI anything...     [Send] │ │ ← Input Box
│ │                                     │ │
│ │ [📎] [🎤] [⚙️]                      │ │ ← Attachments,
│ └─────────────────────────────────────┘ │   Voice, Settings
└─────────────────────────────────────────┘
```

### Right Panel: Live Preview / Code View

**Dynamic Content Based on Context:**

**1. Code Diff View (when showing changes):**
```
┌─────────────────────────────────────────┐
│ src/auth/login.ts              [×]      │
├─────────────────────────────────────────┤
│ 43 | export async function login() {   │
│ 44 |   const user = await getUser();   │
│ 45 | - const token = req.token;        │ ← Removed
│ 46 | + const token = req.token || null;│ ← Added
│ 47 |   return { user, token };         │
│ 48 | }                                 │
├─────────────────────────────────────────┤
│ [Apply Changes] [Reject] [Open in Editor]│
└─────────────────────────────────────────┘
```

**2. Test Results View (when running tests):**
```
┌─────────────────────────────────────────┐
│ Test Results                   [×]      │
├─────────────────────────────────────────┤
│ ✓ login.test.ts                         │
│   ✓ should login with valid credentials │
│   ✓ should reject invalid credentials   │
│   ✓ should handle empty email           │
│   ✓ should handle empty password        │
│   ✓ should handle network errors        │
│                                         │
│ ✓ auth.test.ts                          │
│   ✓ should validate token               │
│   ✓ should refresh expired token        │
│   ... (10 more tests)                   │
│                                         │
│ Summary: 17/17 tests passed ✓           │
│ Duration: 2.3s                          │
├─────────────────────────────────────────┤
│ [View Details] [Run Again]              │
└─────────────────────────────────────────┘
```

**3. File Preview (when reading files):**
```
┌─────────────────────────────────────────┐
│ src/auth/login.ts              [×]      │
├─────────────────────────────────────────┤
│  1 | import { User } from './types';   │
│  2 |                                   │
│  3 | export async function login(      │
│  4 |   email: string,                  │
│  5 |   password: string                │
│  6 | ): Promise<LoginResult> {         │
│  7 |   // Validate credentials         │
│  8 |   const user = await getUser(...);│
│  9 |   const token = req.token;        │ ← Highlighted
│ 10 |   return { user, token };         │
│ 11 | }                                 │
├─────────────────────────────────────────┤
│ [Open in Editor] [Copy]                 │
└─────────────────────────────────────────┘
```

**4. Documentation View (when explaining):**
```
┌─────────────────────────────────────────┐
│ Authentication Flow Explanation [×]     │
├─────────────────────────────────────────┤
│                                         │
│ # How Authentication Works              │
│                                         │
│ 1. User submits credentials             │
│ 2. Server validates against database    │
│ 3. JWT token generated and returned     │
│ 4. Token stored in localStorage         │
│ 5. Token sent with each API request     │
│                                         │
│ ## Key Files                            │
│ - src/auth/login.ts - Login logic       │
│ - src/auth/middleware.ts - Token verify │
│ - src/auth/types.ts - Type definitions  │
│                                         │
│ [View Diagram] [See Code]               │
└─────────────────────────────────────────┘
```

**5. Empty State (no active preview):**
```
┌─────────────────────────────────────────┐
│                                         │
│              📄                         │
│                                         │
│     Code changes and previews           │
│     will appear here                    │
│                                         │
└─────────────────────────────────────────┘
```

### Tab Management

**Tab Bar Features:**
- **Multiple conversations** - Each tab is independent
- **Persistent across sessions** - Saved to VS Code workspaceState
- **Drag to reorder** - Organize tabs
- **Close with × or middle-click** - Standard browser behavior
- **New tab with +** - Start fresh conversation

**Tab States:**
```
[Active Tab]  [Inactive Tab]  [Thinking... ⏳]  [Error ⚠️]  [+]
```

**Tab Context Menu (right-click):**
```
┌─────────────────────────┐
│ Rename                  │
│ Duplicate               │
│ ─────────────────────── │
│ Close                   │
│ Close Others            │
│ Close All               │
│ ─────────────────────── │
│ Export Conversation     │
└─────────────────────────┘
```

### Responsive Behavior

**Narrow Window (< 1200px):**
- Right panel collapses
- Activity stream takes full width
- Preview opens in modal/overlay when needed

**Wide Window (> 1600px):**
- Right panel can show multiple views (code + tests)
- Activity stream can expand for more context

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+T` | New conversation tab |
| `Cmd+W` | Close current tab |
| `Cmd+Shift+T` | Reopen closed tab |
| `Cmd+1-9` | Switch to tab 1-9 |
| `Cmd+Enter` | Send message |
| `Cmd+/` | Toggle thinking visibility |
| `Cmd+Shift+H` | Toggle history sidebar |
| `Esc` | Cancel current operation |

**Conclusion:** Split-screen architecture provides the best balance between conversation flow and live feedback, following proven patterns from Claude Artifacts and Cursor 3.

---

## 3. AI Thinking Visualization

### Status: ✅ **CRITICAL - Builds Trust Through Transparency**

Based on ThinkChain and Xcapit research, showing the AI's thinking process is essential for building user trust. Users need to understand **why** the AI is making decisions, not just **what** it's doing.

### Design Principles

1. **Visible by default, collapsible** - Show thinking but don't overwhelm
2. **Inline with actions** - Thinking appears before related tool calls
3. **Natural language** - No technical jargon or raw prompts
4. **Confidence indicators** - Show certainty level
5. **"Why?" button** - Deeper explanation on demand

### Thinking Block Component

**Collapsed State (Default):**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              [Expand ▼]     │
│ I need to understand the auth implementation first...   │
└─────────────────────────────────────────────────────────┘
```

**Expanded State:**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              [Collapse ▲]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ I need to understand the current authentication         │
│ implementation before I can fix the bug. Let me:        │
│                                                         │
│ 1. Read the login component to see how it handles       │
│    form submission                                      │
│ 2. Check the validation logic for email/password        │
│ 3. Look at the API call to understand the flow          │
│                                                         │
│ This will help me identify where the crash occurs       │
│ when the email field is empty.                          │
│                                                         │
│ [Why this approach?]                                    │
└─────────────────────────────────────────────────────────┘
```

### Thinking with Confidence Indicators

**High Confidence (Green):**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              ✅ High         │
├─────────────────────────────────────────────────────────┤
│ I found the issue! The form doesn't validate the email  │
│ field before submission. This is a common pattern and   │
│ I'm confident this is causing the crash.                │
│                                                         │
│ The fix is straightforward: add email validation        │
│ before the API call on line 45.                         │
└─────────────────────────────────────────────────────────┘
```

**Medium Confidence (Amber):**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              ⚠️  Medium      │
├─────────────────────────────────────────────────────────┤
│ I think the issue is in the validation logic, but I     │
│ need to check the API response handling too. The crash  │
│ could be happening in either place.                     │
│                                                         │
│ Let me read both files to be sure before suggesting     │
│ a fix.                                                  │
│                                                         │
│ [Worth reviewing before applying]                       │
└─────────────────────────────────────────────────────────┘
```

**Low Confidence (Red):**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              🔴 Low          │
├─────────────────────────────────────────────────────────┤
│ I'm not certain about the root cause. The code looks    │
│ correct, but the crash might be related to:             │
│                                                         │
│ 1. Browser-specific behavior                            │
│ 2. Race condition in async code                         │
│ 3. External library issue                               │
│                                                         │
│ I recommend manual debugging or providing more context  │
│ about when exactly the crash occurs.                    │
│                                                         │
│ [Requires human judgment]                               │
└─────────────────────────────────────────────────────────┘
```

### Thinking Flow Example

**Complete thinking sequence for a bug fix:**

```
User: Fix the login crash when email is empty

┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              [Collapse ▲]   │
├─────────────────────────────────────────────────────────┤
│ I need to understand the current authentication         │
│ implementation. Let me read the login component first.  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              [Expand ▼]     │
│ src/components/LoginForm.tsx                            │
│ Status: ✓ Complete (234ms)                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              ✅ High         │
├─────────────────────────────────────────────────────────┤
│ Found it! The form submits without validating the email │
│ field. Line 45 calls the API directly with the form     │
│ data, which causes a crash when email is undefined.     │
│                                                         │
│ The fix: Add email validation before the API call.     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔧 generateFix                           [Expand ▼]     │
│ Generating code fix...                                  │
│ Status: ✓ Complete (1.2s)                               │
└─────────────────────────────────────────────────────────┘

ForgeAI: I found the issue! The form doesn't validate 
the email field before submission. Here's the fix:

[Code diff shown in right panel]
```

### "Why?" Button - Deeper Explanation

When user clicks "Why this approach?":

```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Detailed Reasoning                    [Close ×]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Why I chose this approach:                              │
│                                                         │
│ 1. **Root Cause Analysis**                              │
│    I read the login component first because form        │
│    crashes typically happen at submission time, not     │
│    during rendering.                                    │
│                                                         │
│ 2. **Common Pattern Recognition**                       │
│    Missing validation before API calls is a common      │
│    bug pattern in React forms. I've seen this in        │
│    90% of similar crash reports.                        │
│                                                         │
│ 3. **Minimal Change Principle**                         │
│    Adding validation is safer than refactoring the      │
│    entire form. It fixes the immediate issue without    │
│    introducing new risks.                               │
│                                                         │
│ 4. **Data I Used**                                      │
│    - LoginForm.tsx (156 lines)                          │
│    - Your description: "crashes when email is empty"    │
│    - Common React form patterns                         │
│                                                         │
│ 5. **What I Didn't Have Access To**                     │
│    - Browser console errors                             │
│    - Network request logs                               │
│    - User session data                                  │
│                                                         │
│    These might provide additional context, but aren't   │
│    necessary for this fix.                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Thinking Visibility Settings

**User Preferences:**

```
┌─────────────────────────────────────────┐
│ Thinking Visibility                     │
├─────────────────────────────────────────┤
│ ● Show thinking process (recommended)   │
│   See how ForgeAI reasons through       │
│   problems                              │
│                                         │
│ ○ Show only high-level steps           │
│   See actions without detailed thinking │
│                                         │
│ ○ Hide thinking process                │
│   Show only results                     │
│                                         │
│ ☑ Show confidence indicators            │
│ ☑ Enable "Why?" buttons                │
│ ☐ Auto-collapse thinking blocks         │
└─────────────────────────────────────────┘
```

### Streaming Thinking (Real-Time)

**As AI thinks, show progressive updates:**

```
🧠 Thinking...
↓
🧠 I need to understand the auth implementation...
↓
🧠 I need to understand the auth implementation first.
   Let me read the login component...
↓
🧠 I need to understand the auth implementation first.
   Let me read the login component to see how it handles
   form submission...
```

### Thinking Block States

**1. Thinking (In Progress):**
```
┌─────────────────────────────────────────┐
│ 🧠 Thinking...                  ⏳      │
│ [Animated dots or spinner]              │
└─────────────────────────────────────────┘
```

**2. Thinking (Complete):**
```
┌─────────────────────────────────────────┐
│ 🧠 Thinking                  [Expand ▼] │
│ I need to understand the auth...        │
└─────────────────────────────────────────┘
```

**3. Thinking (Error):**
```
┌─────────────────────────────────────────┐
│ 🧠 Thinking                  ⚠️  Error   │
│ I encountered an issue while analyzing  │
│ the code. Let me try a different...     │
└─────────────────────────────────────────┘
```

### Integration with Tool Calls

**Thinking always precedes related tool calls:**

```
🧠 Thinking: I need to read the login component
       ↓
🔧 Tool: readFile(src/components/LoginForm.tsx)
       ↓
🧠 Thinking: Found the issue on line 45
       ↓
🔧 Tool: generateFix(...)
       ↓
🧠 Thinking: Fix generated, ready to apply
```

### Accessibility Considerations

- **Screen readers:** Thinking blocks announced as "AI reasoning"
- **Keyboard navigation:** Tab through thinking blocks
- **High contrast:** Confidence indicators use patterns + colors
- **Reduced motion:** Disable streaming animations

**Conclusion:** Visible thinking builds trust by showing the AI's reasoning process. Confidence indicators help users know when to trust vs. verify. "Why?" buttons provide deeper explanations without cluttering the interface.

---

## 4. Activity Feed & Tool Execution

### Status: ✅ **CRITICAL - Real-Time Transparency**

Based on LangChain frontend patterns and Xcapit research, users need to see **what the AI is doing in real-time**, not just the final result. This builds trust and allows early intervention if the AI goes off track.

### Design Principles

1. **Real-time updates** - Show actions as they happen
2. **Expandable details** - Click to see full context
3. **Status indicators** - Clear visual feedback
4. **Actionable** - Allow intervention/cancellation
5. **Persistent** - Save in conversation history

### Tool Execution States

**Visual Status Indicators:**

| State | Icon | Color | Description |
|-------|------|-------|-------------|
| Queued | ⏳ | Gray | Tool waiting to execute |
| Running | 🔄 | Blue | Tool currently executing |
| Complete | ✓ | Green | Tool finished successfully |
| Warning | ⚠️ | Amber | Tool completed with warnings |
| Failed | ❌ | Red | Tool execution failed |
| Cancelled | ⏸️ | Gray | User cancelled execution |

### Tool Card Component

**Collapsed State (Default):**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              [Expand ▼]     │
│ src/auth/login.ts                                       │
│ Status: ✓ Complete (234ms)                              │
└─────────────────────────────────────────────────────────┘
```

**Expanded State:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              [Collapse ▲]   │
├─────────────────────────────────────────────────────────┤
│ File: src/auth/login.ts                                 │
│ Status: ✓ Complete (234ms)                              │
│ Lines read: 156                                         │
│ Size: 4.2 KB                                            │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Preview:                                            │ │
│ │                                                     │ │
│ │  1 | import { User } from './types';               │ │
│ │  2 |                                               │ │
│ │  3 | export async function login(                  │ │
│ │  4 |   email: string,                              │ │
│ │  5 |   password: string                            │ │
│ │  6 | ): Promise<LoginResult> {                     │ │
│ │  7 |   // Validate credentials                     │ │
│ │  8 |   const user = await getUser(...);            │ │
│ │  9 |   const token = req.token;                    │ │
│ │ 10 |   return { user, token };                     │ │
│ │ 11 | }                                             │ │
│ │                                                     │ │
│ │ [Show more...]                                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View Full File] [Open in Editor] [Copy Path]          │
└─────────────────────────────────────────────────────────┘
```

### Tool Execution Flow

**Complete sequence for a bug fix:**

```
User: Fix the authentication bug

┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                                             │
│ I need to understand the auth implementation first...   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              ⏳ Queued      │
│ src/auth/login.ts                                       │
└─────────────────────────────────────────────────────────┘
       ↓ (starts executing)
┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              🔄 Running     │
│ src/auth/login.ts                                       │
│ Reading file... [████████░░] 80%                        │
└─────────────────────────────────────────────────────────┘
       ↓ (completes)
┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              ✓ Complete     │
│ src/auth/login.ts                                       │
│ Status: ✓ Complete (234ms)                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🧠 Thinking                              ✅ High         │
│ Found the issue! Missing null check on line 45...       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔧 writeFile                             🔄 Running     │
│ src/auth/login.ts                                       │
│ Applying fix... [Cancel]                                │
└─────────────────────────────────────────────────────────┘
       ↓ (completes)
┌─────────────────────────────────────────────────────────┐
│ 🔧 writeFile                             ✓ Complete     │
│ src/auth/login.ts                                       │
│ Status: ✓ File updated (89ms)                           │
│ [View Changes] [Undo]                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔧 runTests                              🔄 Running     │
│ Running test suite...                                   │
│ [████████████░░░░] 75% (15/20 tests)                    │
└─────────────────────────────────────────────────────────┘
       ↓ (completes)
┌─────────────────────────────────────────────────────────┐
│ 🔧 runTests                              ✓ Complete     │
│ All tests passed (20/20)                                │
│ Duration: 2.3s                                          │
│ [View Results]                                          │
└─────────────────────────────────────────────────────────┘

ForgeAI: ✓ Fix applied successfully! All tests passing.
```

### Tool-Specific Cards

**1. File Read:**
```
┌─────────────────────────────────────────────────────────┐
│ 📖 readFile                              ✓ Complete     │
├─────────────────────────────────────────────────────────┤
│ File: src/auth/login.ts                                 │
│ Lines: 156 | Size: 4.2 KB | Modified: 2 hours ago      │
│                                                         │
│ [View Content] [Open in Editor]                         │
└─────────────────────────────────────────────────────────┘
```

**2. File Write:**
```
┌─────────────────────────────────────────────────────────┐
│ ✏️  writeFile                             ✓ Complete     │
├─────────────────────────────────────────────────────────┤
│ File: src/auth/login.ts                                 │
│ Changes: +3 lines, -1 line                              │
│ Backup created: .forgeai/backups/login.ts.bak           │
│                                                         │
│ [View Diff] [Undo] [Open in Editor]                    │
└─────────────────────────────────────────────────────────┘
```

**3. Search:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 grepSearch                            ✓ Complete     │
├─────────────────────────────────────────────────────────┤
│ Query: "authentication"                                 │
│ Found: 47 matches in 12 files                           │
│                                                         │
│ Top Results:                                            │
│ • src/auth/login.ts (12 matches)                        │
│ • src/auth/middleware.ts (8 matches)                    │
│ • src/components/LoginForm.tsx (6 matches)              │
│                                                         │
│ [View All Results] [Refine Search]                      │
└─────────────────────────────────────────────────────────┘
```

**4. Test Execution:**
```
┌─────────────────────────────────────────────────────────┐
│ 🧪 runTests                              ✓ Complete     │
├─────────────────────────────────────────────────────────┤
│ Test Suite: auth.test.ts                                │
│ Results: 17/17 passed ✓                                 │
│ Duration: 2.3s                                          │
│ Coverage: 94.2%                                         │
│                                                         │
│ ✓ login with valid credentials                          │
│ ✓ reject invalid credentials                            │
│ ✓ handle empty email                                    │
│ ✓ handle empty password                                 │
│ ... (13 more tests)                                     │
│                                                         │
│ [View Full Report] [Run Again]                          │
└─────────────────────────────────────────────────────────┘
```

**5. Command Execution:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚡ executePwsh                           ✓ Complete     │
├─────────────────────────────────────────────────────────┤
│ Command: npm run build                                  │
│ Exit code: 0                                            │
│ Duration: 12.4s                                         │
│                                                         │
│ Output:                                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ > forgeai@1.0.0 build                               │ │
│ │ > tsc && vite build                                 │ │
│ │                                                     │ │
│ │ vite v5.0.0 building for production...             │ │
│ │ ✓ 234 modules transformed.                         │ │
│ │ dist/index.html                  2.45 kB            │ │
│ │ dist/assets/index-a3b4c5d6.js   145.23 kB          │ │
│ │ ✓ built in 12.38s                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View Full Output] [Copy]                               │
└─────────────────────────────────────────────────────────┘
```

**6. API Call:**
```
┌─────────────────────────────────────────────────────────┐
│ 🌐 apiCall                               ✓ Complete     │
├─────────────────────────────────────────────────────────┤
│ Endpoint: POST /api/auth/login                          │
│ Status: 200 OK                                          │
│ Duration: 234ms                                         │
│                                                         │
│ Response:                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ {                                                   │ │
│ │   "success": true,                                  │ │
│ │   "token": "eyJhbGciOiJIUzI1NiIs...",              │ │
│ │   "user": {                                         │ │
│ │     "id": "123",                                    │ │
│ │     "email": "user@example.com"                     │ │
│ │   }                                                 │ │
│ │ }                                                   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View Headers] [Copy Response]                          │
└─────────────────────────────────────────────────────────┘
```

### Error Handling in Tool Cards

**Failed Tool Execution:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 readFile                              ❌ Failed       │
├─────────────────────────────────────────────────────────┤
│ File: src/auth/login.ts                                 │
│ Error: File not found                                   │
│                                                         │
│ The file may have been moved or deleted. Common fixes:  │
│ • Check if the file path is correct                     │
│ • Verify the file exists in the workspace               │
│ • Check file permissions                                │
│                                                         │
│ [Retry] [Search for File] [Skip]                        │
└─────────────────────────────────────────────────────────┘
```

**Tool with Warnings:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 writeFile                             ⚠️  Warning     │
├─────────────────────────────────────────────────────────┤
│ File: src/auth/login.ts                                 │
│ Status: File updated with warnings                      │
│                                                         │
│ Warnings:                                               │
│ • File was modified by another process                  │
│ • Backup may be out of sync                             │
│                                                         │
│ The changes were applied, but you should review them.   │
│                                                         │
│ [View Changes] [Undo] [Ignore Warning]                  │
└─────────────────────────────────────────────────────────┘
```

### Progress Indicators

**For Long-Running Tools:**

**1. Indeterminate Progress:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 analyzeCodebase                       🔄 Running     │
│ Analyzing 1,234 files...                                │
│ [████████████████████] Analyzing...                     │
│ [Cancel]                                                │
└─────────────────────────────────────────────────────────┘
```

**2. Determinate Progress:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 runTests                              🔄 Running     │
│ Running test suite...                                   │
│ [████████████░░░░░░░░] 65% (13/20 tests)                │
│ Current: auth.test.ts                                   │
│ [Cancel]                                                │
└─────────────────────────────────────────────────────────┘
```

**3. Multi-Step Progress:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 deployToProduction                    🔄 Running     │
│ Step 3 of 5: Building application...                    │
│                                                         │
│ ✓ Step 1: Running tests                                │
│ ✓ Step 2: Linting code                                 │
│ ⏳ Step 3: Building application [████████░░] 80%        │
│ ⏳ Step 4: Uploading to server                          │
│ ⏳ Step 5: Restarting services                          │
│                                                         │
│ [Cancel Deployment]                                     │
└─────────────────────────────────────────────────────────┘
```

### Cancellation & Intervention

**User Can Cancel Long-Running Tools:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔧 analyzeCodebase                       🔄 Running     │
│ Analyzing 1,234 files...                                │
│ [████████████████████] 45% (556/1234)                   │
│                                                         │
│ [Cancel] ← Click to stop                                │
└─────────────────────────────────────────────────────────┘

[After clicking Cancel:]

┌─────────────────────────────────────────────────────────┐
│ 🔧 analyzeCodebase                       ⏸️  Cancelled   │
│ Analysis stopped by user                                │
│ Analyzed: 556/1234 files (45%)                          │
│                                                         │
│ Partial results available.                              │
│                                                         │
│ [View Partial Results] [Resume] [Discard]               │
└─────────────────────────────────────────────────────────┘
```

### Activity Stream Filtering

**Filter Controls:**
```
┌─────────────────────────────────────────────────────────┐
│ Activity Stream                          [Filter ▼]     │
├─────────────────────────────────────────────────────────┤
│ Show: [All] [Thinking] [Tools] [Messages]              │
│ Status: [All] [Running] [Complete] [Failed]             │
│ ☑ Auto-scroll to latest                                │
└─────────────────────────────────────────────────────────┘
```

### Accessibility

- **Screen readers:** Announce tool status changes
- **Keyboard navigation:** Tab through tool cards, Enter to expand
- **High contrast:** Status colors have text labels too
- **Reduced motion:** Disable progress animations

**Conclusion:** Real-time activity feed with expandable tool cards provides transparency and allows users to understand and intervene in the AI's actions. This builds trust and prevents the "black box" problem.

---

## 5. Conversation Persistence

### Status: ✅ **CRITICAL - Users Expect Conversations to Persist**

Based on Microsoft Agent Framework and Cloudscape Design System research, conversation history must be persistent, searchable, and isolated per workspace. Users expect their conversations to survive VS Code restarts and be available across sessions.

### Design Principles

1. **Per-workspace isolation** - Conversations tied to workspace
2. **Per-tab sessions** - Each tab has independent conversation
3. **Automatic saving** - No manual save required
4. **Searchable** - Full-text search across all conversations
5. **Exportable** - Users can export conversations

### Storage Architecture

**VS Code Storage Strategy:**

```typescript
// Storage hierarchy
workspaceState (per-workspace)
  └── conversations/
      ├── tab_1_uuid/
      │   ├── metadata (title, created, updated)
      │   ├── messages[] (user + AI messages)
      │   ├── toolCalls[] (all tool executions)
      │   └── thinking[] (AI reasoning blocks)
      ├── tab_2_uuid/
      └── tab_3_uuid/

globalState (cross-workspace)
  └── settings/
      ├── autonomyLevel
      ├── thinkingVisibility
      └── recentWorkspaces[]
```

### Conversation Data Model

```typescript
interface Conversation {
  id: string;                    // Unique conversation ID
  workspaceId: string;           // Workspace identifier
  tabId: string;                 // Tab identifier
  title: string;                 // Auto-generated or user-set
  createdAt: number;             // Timestamp
  updatedAt: number;             // Last activity timestamp
  messages: Message[];           // All messages
  metadata: ConversationMetadata;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];        // Tools executed
  thinking?: ThinkingBlock[];    // AI reasoning
  confidence?: 'high' | 'medium' | 'low';
  attachments?: Attachment[];    // Files, images, etc.
}

interface ToolCall {
  id: string;
  tool: string;                  // Tool name
  args: Record<string, any>;     // Tool arguments
  result?: any;                  // Tool result
  status: 'queued' | 'running' | 'complete' | 'failed';
  duration?: number;             // Execution time (ms)
  timestamp: number;
}

interface ThinkingBlock {
  id: string;
  content: string;
  confidence?: 'high' | 'medium' | 'low';
  timestamp: number;
  collapsed: boolean;            // UI state
}

interface ConversationMetadata {
  model: string;                 // Model used
  totalTokens: number;           // Token usage
  toolCallsCount: number;        // Number of tools called
  tags: string[];                // User-defined tags
  starred: boolean;              // User starred
}
```

### History Sidebar

**Sidebar Layout:**

```
┌─────────────────────────────────────────────────────────┐
│ 📚 Conversation History                    [Search 🔍]  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Search conversations...                             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Filter: [All] [Starred] [Today] [This Week]            │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📁 Today                                            │ │
│ │                                                     │ │
│ │ ⭐ Fix authentication bug                           │ │
│ │    2 hours ago • 12 messages                        │ │
│ │                                                     │ │
│ │ 💬 Add user dashboard                               │ │
│ │    4 hours ago • 8 messages                         │ │
│ │                                                     │ │
│ │ 💬 Generate tests for UserService                   │ │
│ │    6 hours ago • 5 messages                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📁 Yesterday                                        │ │
│ │                                                     │ │
│ │ 💬 Refactor API endpoints                           │ │
│ │    Yesterday • 15 messages                          │ │
│ │                                                     │ │
│ │ 💬 Update documentation                             │ │
│ │    Yesterday • 6 messages                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📁 Last 7 Days                                      │ │
│ │                                                     │ │
│ │ 💬 Implement payment flow                           │ │
│ │    3 days ago • 24 messages                         │ │
│ │                                                     │ │
│ │ 💬 Debug production issue                           │ │
│ │    5 days ago • 18 messages                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📁 Older                                            │ │
│ │    [Load more...]                                   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Conversation Card

**Individual conversation in history:**

```
┌─────────────────────────────────────────────────────────┐
│ ⭐ Fix authentication bug                    [⋮]        │
├─────────────────────────────────────────────────────────┤
│ 2 hours ago • 12 messages • 3 files changed             │
│                                                         │
│ Preview: "The login form crashes when email is empty.  │
│ I found the issue - missing null check..."             │
│                                                         │
│ Tags: [bug] [authentication]                            │
│                                                         │
│ [Open] [Export] [Delete]                                │
└─────────────────────────────────────────────────────────┘
```

**Context Menu (click ⋮):**
```
┌─────────────────────────┐
│ Open in New Tab         │
│ Rename                  │
│ Add Tags                │
│ ─────────────────────── │
│ Star / Unstar           │
│ Export as Markdown      │
│ Export as JSON          │
│ ─────────────────────── │
│ Delete                  │
└─────────────────────────┘
```

### Search Functionality

**Search Interface:**

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Search: "authentication bug"              [×]        │
├─────────────────────────────────────────────────────────┤
│ Found 3 conversations                                   │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Fix authentication bug                              │ │
│ │ 2 hours ago                                         │ │
│ │                                                     │ │
│ │ "...The login form crashes when email is empty.    │ │
│ │ I found the authentication bug - missing null..."   │ │
│ │                                                     │ │
│ │ [Open]                                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Debug authentication middleware                     │ │
│ │ 3 days ago                                          │ │
│ │                                                     │ │
│ │ "...The authentication middleware is rejecting      │ │
│ │ valid tokens. Let me investigate the bug..."        │ │
│ │                                                     │ │
│ │ [Open]                                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Show more results...]                                  │
└─────────────────────────────────────────────────────────┘
```

**Search Features:**
- Full-text search across all messages
- Search in thinking blocks
- Search in tool results
- Filter by date range
- Filter by tags
- Filter by model used

### Auto-Generated Titles

**Title Generation Logic:**

```typescript
// Generate title from first user message
function generateTitle(firstMessage: string): string {
  // Take first 50 characters
  let title = firstMessage.substring(0, 50);
  
  // Remove incomplete words at the end
  const lastSpace = title.lastIndexOf(' ');
  if (lastSpace > 0) {
    title = title.substring(0, lastSpace);
  }
  
  // Add ellipsis if truncated
  if (firstMessage.length > 50) {
    title += '...';
  }
  
  return title;
}

// Examples:
"Fix the authentication bug in login.ts"
→ "Fix the authentication bug in login.ts"

"I need help implementing a user dashboard with charts and analytics for the admin panel"
→ "I need help implementing a user dashboard with..."
```

**User Can Rename:**
```
┌─────────────────────────────────────────────────────────┐
│ Rename Conversation                                     │
├─────────────────────────────────────────────────────────┤
│ Current: "Fix the authentication bug in login.ts"       │
│                                                         │
│ New name:                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Auth Bug Fix - Login Form                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Save] [Cancel]                                         │
└─────────────────────────────────────────────────────────┘
```

### Export Functionality

**Export Options:**

**1. Export as Markdown:**
```markdown
# Fix authentication bug

**Date:** May 3, 2026, 2:30 PM  
**Model:** Qwen3-Coder-397B  
**Messages:** 12  
**Files Changed:** 3  

---

## Conversation

**User:** Fix the authentication bug in login.ts

**ForgeAI (Thinking):**
I need to understand the current authentication implementation first.
Let me read the login component.

**ForgeAI (Tool: readFile):**
- File: src/auth/login.ts
- Status: Complete (234ms)

**ForgeAI (Thinking):**
Found the issue! The form doesn't validate the email field before
submission. Line 45 calls the API directly with the form data.

**ForgeAI:**
I found the issue! The form doesn't validate the email field before
submission. Here's the fix:

```diff
- const token = req.token;
+ const token = req.token || null;
```

**User:** Apply the fix

**ForgeAI (Tool: writeFile):**
- File: src/auth/login.ts
- Status: Complete (89ms)
- Changes: +1 line, -1 line

**ForgeAI:** ✓ Fix applied successfully!

---

## Files Changed
- src/auth/login.ts (+1, -1)

## Tools Used
- readFile (2 times)
- writeFile (1 time)
- runTests (1 time)
```

**2. Export as JSON:**
```json
{
  "id": "conv_123abc",
  "title": "Fix authentication bug",
  "createdAt": 1777777777000,
  "updatedAt": 1777784977000,
  "model": "qwen3-coder-397b",
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Fix the authentication bug in login.ts",
      "timestamp": 1777777777000
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "I found the issue!...",
      "timestamp": 1777777800000,
      "thinking": [
        {
          "content": "I need to understand...",
          "confidence": "high"
        }
      ],
      "toolCalls": [
        {
          "tool": "readFile",
          "args": { "path": "src/auth/login.ts" },
          "status": "complete",
          "duration": 234
        }
      ]
    }
  ],
  "metadata": {
    "totalTokens": 1234,
    "toolCallsCount": 4,
    "filesChanged": 3,
    "tags": ["bug", "authentication"]
  }
}
```

### Conversation Restoration

**When Opening Saved Conversation:**

```
┌─────────────────────────────────────────────────────────┐
│ 📚 Loading conversation...                              │
├─────────────────────────────────────────────────────────┤
│ [████████████████████] Loading messages...              │
└─────────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────────┐
│ [Fix authentication bug] [+]                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ [Previous conversation restored]                        │
│                                                         │
│ User: Fix the authentication bug in login.ts           │
│                                                         │
│ 🧠 Thinking: I need to understand...                    │
│                                                         │
│ 🔧 readFile: src/auth/login.ts ✓                        │
│                                                         │
│ ForgeAI: I found the issue!...                          │
│                                                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ Continue the conversation below...                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Ask ForgeAI anything...                     [Send] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Storage Limits & Cleanup

**Storage Management:**

```typescript
// Automatic cleanup strategy
interface StoragePolicy {
  maxConversationsPerWorkspace: 100;
  maxMessageAge: 90 * 24 * 60 * 60 * 1000; // 90 days
  maxTotalSize: 50 * 1024 * 1024; // 50 MB
  
  // Auto-delete unstarred conversations older than 90 days
  autoDeleteOld: true;
  
  // Keep starred conversations forever
  keepStarred: true;
}
```

**Storage Warning:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Storage Warning                                      │
├─────────────────────────────────────────────────────────┤
│ Your conversation history is using 45 MB of 50 MB.      │
│                                                         │
│ Recommendations:                                        │
│ • Delete old conversations (23 older than 90 days)      │
│ • Export and archive important conversations            │
│ • Increase storage limit in settings                    │
│                                                         │
│ [Clean Up Old] [Export All] [Settings]                  │
└─────────────────────────────────────────────────────────┘
```

### Cross-Workspace Sync (Optional)

**Using VS Code globalState:**

```typescript
// Enable sync for important conversations
interface SyncSettings {
  enableSync: boolean;
  syncStarredOnly: boolean;
  syncAcrossDevices: boolean;
}

// Synced conversations available across all workspaces
globalState.setKeysForSync(['starred-conversations']);
```

**Sync Indicator:**
```
┌─────────────────────────────────────────────────────────┐
│ ⭐ Fix authentication bug                    ☁️ Synced   │
├─────────────────────────────────────────────────────────┤
│ This conversation is synced across your devices         │
└─────────────────────────────────────────────────────────┘
```

### Privacy & Security

**Sensitive Data Handling:**

```typescript
// Don't store sensitive data in conversations
interface PrivacySettings {
  // Redact API keys, tokens, passwords
  redactSecrets: boolean;
  
  // Don't store file contents, only references
  storeFileReferences: boolean;
  
  // Encrypt conversations at rest
  encryptStorage: boolean;
}
```

**Redaction Example:**
```
Original: "API key: sk_live_abc123xyz789"
Stored:   "API key: [REDACTED]"
```

**Conclusion:** Conversation persistence with per-workspace isolation, full-text search, and export capabilities ensures users never lose their work. Auto-generated titles and smart cleanup keep the history manageable.

---

## 6. Progressive Autonomy System

### Status: ✅ **RECOMMENDED - Builds Trust Over Time**

Based on Xcapit research, progressive autonomy allows users to gradually increase the AI's authority as they build confidence. This 3-tier system balances safety with efficiency.

### Three Autonomy Levels

**Tier 1: Supervised Mode (Default for New Users)**
- AI suggests actions but takes none
- User approves every tool execution
- Best for: First-time users, critical operations

**Tier 2: Semi-Autonomous Mode (Recommended)**
- AI acts autonomously for routine tasks
- Asks permission for unusual actions
- Best for: Regular users, most workflows

**Tier 3: Autonomous Mode (Power Users)**
- AI operates fully independently
- Reports results after completion
- Best for: Trusted workflows, experienced users

### Autonomy Level Selector

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️  Autonomy Level                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ○ Supervised                                            │
│   Ask before every action                               │
│   • Safest option                                       │
│   • Best for learning                                   │
│   • Slower workflow                                     │
│                                                         │
│ ● Semi-Autonomous (Recommended)                         │
│   Ask for unusual actions only                          │
│   • Balanced approach                                   │
│   • Efficient for most tasks                            │
│   • Safe for production                                 │
│                                                         │
│ ○ Autonomous                                            │
│   Act independently within boundaries                   │
│   • Fastest workflow                                    │
│   • Requires trust                                      │
│   • Review results after                                │
│                                                         │
│ [Save Settings]                                         │
└─────────────────────────────────────────────────────────┘
```

### Approval Dialog (Supervised Mode)

**When AI wants to execute a tool:**

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 ForgeAI wants to execute a tool                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Tool: writeFile                                         │
│ File: src/auth/login.ts                                 │
│                                                         │
│ Changes:                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ - const token = req.token;                          │ │
│ │ + const token = req.token || null;                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Reason: Fix null reference bug in authentication       │
│                                                         │
│ ☐ Always allow writeFile for this conversation         │
│                                                         │
│ [Approve] [Deny] [Explain More]                         │
└─────────────────────────────────────────────────────────┘
```

### Auto-Approval Rules (Semi-Autonomous)

**User can configure which tools don't need approval:**

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️  Auto-Approval Rules                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Tools that don't need approval:                         │
│                                                         │
│ ✓ readFile - Read files                                │
│ ✓ grepSearch - Search in files                          │
│ ✓ listDirectory - List directory contents               │
│ ✓ getDiagnostics - Get code diagnostics                 │
│                                                         │
│ Tools that always need approval:                        │
│                                                         │
│ ☐ writeFile - Modify files                             │
│ ☐ deleteFile - Delete files                            │
│ ☐ executePwsh - Run shell commands                      │
│ ☐ apiCall - Make API requests                          │
│                                                         │
│ [Save Rules] [Reset to Defaults]                        │
└─────────────────────────────────────────────────────────┘
```

### Autonomy Upgrade Suggestion

**AI suggests moving to higher autonomy:**

```
┌─────────────────────────────────────────────────────────┐
│ 💡 Suggestion                                            │
├─────────────────────────────────────────────────────────┤
│ I've successfully completed 50 file operations with     │
│ 100% accuracy in the last week.                         │
│                                                         │
│ Would you like to enable auto-approval for readFile     │
│ and writeFile? This will speed up your workflow.        │
│                                                         │
│ You can always change this in settings.                 │
│                                                         │
│ [Enable Auto-Approval] [Not Now] [Never Ask]            │
└─────────────────────────────────────────────────────────┘
```

### Autonomy Boundaries

**Even in Autonomous mode, some actions always require approval:**

```typescript
// Always require approval (safety-critical)
const alwaysRequireApproval = [
  'deleteFile',           // File deletion
  'executePwsh',          // Shell commands
  'apiCall',              // External API calls
  'deployToProduction',   // Production deployments
  'modifyDatabase',       // Database changes
];

// Never require approval (read-only)
const neverRequireApproval = [
  'readFile',
  'listDirectory',
  'grepSearch',
  'getDiagnostics',
];
```

**Conclusion:** Progressive autonomy allows users to start safe and gradually increase efficiency as trust builds. The 3-tier system provides clear boundaries and user control.

---

## 7. Trust & Transparency Patterns

### Status: ✅ **CRITICAL - Trust is the Currency of AI UX**

Based on Xcapit research: "Trust is earned incrementally through consistent, transparent behavior." Three principles build trust reliably.

### 1. Show Confidence Levels

**Visual Confidence Indicators:**

```
✅ High Confidence (Green)
- AI is certain about the solution
- Based on clear patterns or explicit data
- Safe to trust and apply

⚠️  Medium Confidence (Amber)
- AI has some uncertainty
- Worth reviewing before applying
- May need additional context

🔴 Low Confidence (Red)
- AI is uncertain
- Requires human judgment
- Recommend manual verification
```

**In Messages:**
```
┌─────────────────────────────────────────────────────────┐
│ ForgeAI:                                 ✅ High         │
├─────────────────────────────────────────────────────────┤
│ I found the issue! The form doesn't validate the email  │
│ field before submission. This is a common pattern and   │
│ I'm confident this fix will resolve the crash.          │
│                                                         │
│ [Apply Fix] [Explain More]                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ForgeAI:                                 ⚠️  Medium      │
├─────────────────────────────────────────────────────────┤
│ I think the issue is in the validation logic, but the   │
│ crash could also be in the API response handling.       │
│                                                         │
│ I recommend reviewing both areas before applying.       │
│                                                         │
│ [Show Both Areas] [Investigate More]                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ForgeAI:                                 🔴 Low          │
├─────────────────────────────────────────────────────────┤
│ I'm not certain about the root cause. The code looks    │
│ correct, but the crash might be related to browser-     │
│ specific behavior or a race condition.                  │
│                                                         │
│ I recommend manual debugging with browser dev tools.    │
│                                                         │
│ [Show Debugging Steps] [Try Anyway]                     │
└─────────────────────────────────────────────────────────┘
```

### 2. Explain Reasoning on Demand

**"Why?" Button:**

```
┌─────────────────────────────────────────────────────────┐
│ ForgeAI: I found the issue! The form doesn't validate   │
│ the email field before submission.                      │
│                                                         │
│ [Apply Fix] [Why this approach? ▼]                      │
└─────────────────────────────────────────────────────────┘

[After clicking "Why?"]

┌─────────────────────────────────────────────────────────┐
│ 🧠 Detailed Reasoning                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ **Why I chose this approach:**                          │
│                                                         │
│ 1. **Root Cause Analysis**                              │
│    Form crashes typically happen at submission, not     │
│    during rendering. I focused on the submit handler.   │
│                                                         │
│ 2. **Pattern Recognition**                              │
│    Missing validation before API calls is a common      │
│    bug pattern. I've seen this in 90% of similar cases. │
│                                                         │
│ 3. **Data I Used**                                      │
│    • LoginForm.tsx (156 lines)                          │
│    • Your description: "crashes when email is empty"    │
│    • Common React form patterns                         │
│                                                         │
│ 4. **What I Didn't Have**                               │
│    • Browser console errors                             │
│    • Network request logs                               │
│    These might provide additional context.              │
│                                                         │
│ [Close]                                                 │
└─────────────────────────────────────────────────────────┘
```

### 3. Always Provide Escape Hatches

**Every Action is Reversible:**

**Undo Button (Always Visible):**
```
┌─────────────────────────────────────────────────────────┐
│ ✓ File updated: src/auth/login.ts                       │
│                                                         │
│ [Undo] [View Changes] [Open in Editor]                  │
└─────────────────────────────────────────────────────────┘
```

**Undo History:**
```
┌─────────────────────────────────────────────────────────┐
│ 📜 Undo History                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✓ Updated src/auth/login.ts                             │
│   2 minutes ago                                         │
│   [Undo]                                                │
│                                                         │
│ ✓ Created src/auth/types.ts                             │
│   5 minutes ago                                         │
│   [Undo]                                                │
│                                                         │
│ ✓ Deleted src/old-auth.ts                               │
│   10 minutes ago                                        │
│   [Restore]                                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Confirmation for Irreversible Actions:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Confirm Deletion                                     │
├─────────────────────────────────────────────────────────┤
│ Are you sure you want to delete these files?            │
│                                                         │
│ • src/old-auth.ts                                       │
│ • src/deprecated-utils.ts                               │
│                                                         │
│ This action cannot be undone.                           │
│                                                         │
│ ☐ Don't ask again for this conversation                 │
│                                                         │
│ [Delete] [Cancel]                                       │
└─────────────────────────────────────────────────────────┘
```

### Trust Indicators

**Trust Score (Optional):**
```
┌─────────────────────────────────────────────────────────┐
│ 📊 ForgeAI Performance (Last 7 Days)                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Success Rate: 94.2%                                     │
│ [████████████████████░] 94.2%                           │
│                                                         │
│ • 47 successful operations                              │
│ • 3 operations required corrections                     │
│ • 0 operations caused issues                            │
│                                                         │
│ Most Reliable:                                          │
│ • File operations (100%)                                │
│ • Code generation (96%)                                 │
│ • Test generation (92%)                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Conclusion:** Trust is built through confidence indicators, transparent reasoning, and always providing escape hatches. Users must feel in control at all times.

---

## 8. Error Handling & Graceful Degradation

### Status: ✅ **CRITICAL - How AI Handles Failure Defines Quality**

Based on Xcapit research: "The quality of an AI product is measured not by how often the agent succeeds but by how gracefully it handles failure."

### Graceful Degradation Principles

1. **Complete as much as possible**
2. **Clearly communicate what remains**
3. **Be specific, honest, and actionable**
4. **Offer alternatives**

### Error Message Patterns

**❌ Bad Error Message:**
```
┌─────────────────────────────────────────────────────────┐
│ ❌ Error                                                 │
├─────────────────────────────────────────────────────────┤
│ Something went wrong.                                   │
│                                                         │
│ [OK]                                                    │
└─────────────────────────────────────────────────────────┘
```

**✅ Good Error Message:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Partial Completion                                   │
├─────────────────────────────────────────────────────────┤
│ I couldn't access the sales database - the connection   │
│ timed out after 30 seconds.                             │
│                                                         │
│ What I completed:                                       │
│ ✓ Generated report with Q1, Q2 data                     │
│ ✓ Created charts and visualizations                     │
│                                                         │
│ What's missing:                                         │
│ ⏳ Q3 data (database unavailable)                        │
│                                                         │
│ This usually resolves in a few minutes.                 │
│                                                         │
│ [Retry Now] [Continue Without Q3] [Notify When Ready]   │
└─────────────────────────────────────────────────────────┘
```

### Error Categories

**1. Transient Errors (Retry-able):**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Temporary Issue                                      │
├─────────────────────────────────────────────────────────┤
│ The file is currently locked by another process.        │
│                                                         │
│ This usually happens when:                              │
│ • Another editor has the file open                      │
│ • A build process is running                            │
│ • File system is syncing                                │
│                                                         │
│ [Retry] [Wait and Retry] [Skip This File]               │
└─────────────────────────────────────────────────────────┘
```

**2. Permanent Errors (Alternative Needed):**
```
┌─────────────────────────────────────────────────────────┐
│ ❌ File Not Found                                        │
├─────────────────────────────────────────────────────────┤
│ The file src/auth/login.ts doesn't exist.               │
│                                                         │
│ Possible reasons:                                       │
│ • File was moved or renamed                             │
│ • File was deleted                                      │
│ • Path is incorrect                                     │
│                                                         │
│ What I can do:                                          │
│ • Search for similar files                              │
│ • Create the file from scratch                          │
│ • Check recent file changes                             │
│                                                         │
│ [Search for File] [Create New] [Show Recent Changes]    │
└─────────────────────────────────────────────────────────┘
```

**3. Ambiguous Errors (Need Clarification):**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Need More Information                                │
├─────────────────────────────────────────────────────────┤
│ I found 3 files that match "login":                     │
│                                                         │
│ • src/auth/login.ts (authentication logic)              │
│ • src/components/LoginForm.tsx (UI component)           │
│ • src/pages/login.tsx (page component)                  │
│                                                         │
│ Which file did you mean?                                │
│                                                         │
│ [auth/login.ts] [LoginForm.tsx] [pages/login.tsx]       │
│ [All of them]                                           │
└─────────────────────────────────────────────────────────┘
```

**4. Confidence Errors (AI Uncertain):**
```
┌─────────────────────────────────────────────────────────┐
│ 🔴 Low Confidence                                        │
├─────────────────────────────────────────────────────────┤
│ I'm not confident about this fix. The code looks        │
│ correct, but the issue might be:                        │
│                                                         │
│ 1. Browser-specific behavior (40% likely)               │
│ 2. Race condition in async code (30% likely)            │
│ 3. External library issue (20% likely)                  │
│ 4. Something else (10% likely)                          │
│                                                         │
│ I recommend:                                            │
│ • Manual debugging with browser dev tools               │
│ • Adding console logs to trace execution                │
│ • Checking browser console for errors                   │
│                                                         │
│ [Show Debugging Steps] [Try Anyway] [Get Help]          │
└─────────────────────────────────────────────────────────┘
```

### Partial Success Handling

**When Some Operations Succeed:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Partial Success                                      │
├─────────────────────────────────────────────────────────┤
│ I updated 4 of 5 files successfully.                    │
│                                                         │
│ ✓ src/auth/login.ts                                     │
│ ✓ src/auth/middleware.ts                                │
│ ✓ src/auth/types.ts                                     │
│ ✓ src/components/LoginForm.tsx                          │
│ ❌ src/pages/login.tsx (file locked)                     │
│                                                         │
│ The changes are consistent across the updated files.    │
│ You can manually update login.tsx or retry later.       │
│                                                         │
│ [Retry Failed File] [Continue] [Undo All]               │
└─────────────────────────────────────────────────────────┘
```

### Recovery Suggestions

**AI Suggests Recovery Actions:**
```
┌─────────────────────────────────────────────────────────┐
│ ❌ Build Failed                                          │
├─────────────────────────────────────────────────────────┤
│ The build failed with 3 TypeScript errors.              │
│                                                         │
│ Errors:                                                 │
│ • src/auth/login.ts:45 - Type 'null' not assignable    │
│ • src/auth/types.ts:12 - Property 'token' missing      │
│ • src/components/LoginForm.tsx:89 - Unused variable    │
│                                                         │
│ I can fix these automatically:                          │
│ • Add null check on line 45                             │
│ • Add 'token' property to interface                     │
│ • Remove unused variable                                │
│                                                         │
│ [Auto-Fix All] [Fix One by One] [Show Errors]           │
└─────────────────────────────────────────────────────────┘
```

**Conclusion:** Graceful error handling with specific, actionable messages and recovery suggestions turns failures into learning opportunities and maintains user trust.

---

## 9. Multi-Step Workflows

### Status: ✅ **ESSENTIAL - Many Tasks Require Multiple Steps**

Based on Xcapit research, valuable agent tasks often unfold over minutes or hours. These require progress indicators, checkpoints, and human approval gates.

### Progress Indicators

**Linear Progress:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Analyzing Codebase                                    │
├─────────────────────────────────────────────────────────┤
│ Progress: 45% (556/1234 files)                          │
│ [████████████████████░░░░░░░░░░░░░░░░░░░] 45%          │
│                                                         │
│ Current: src/components/Dashboard.tsx                   │
│ Estimated time remaining: 2 minutes                     │
│                                                         │
│ [Cancel]                                                │
└─────────────────────────────────────────────────────────┘
```

**Step-by-Step Progress:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Deploying to Production                               │
├─────────────────────────────────────────────────────────┤
│ Step 3 of 5: Building application...                    │
│                                                         │
│ ✓ Step 1: Running tests (12.3s)                         │
│ ✓ Step 2: Linting code (3.4s)                           │
│ ⏳ Step 3: Building application [████████░░] 80%        │
│ ⏳ Step 4: Uploading to server                          │
│ ⏳ Step 5: Restarting services                          │
│                                                         │
│ [Cancel Deployment]                                     │
└─────────────────────────────────────────────────────────┘
```

### Checkpoints

**Pause for Review:**
```
┌─────────────────────────────────────────────────────────┐
│ ⏸️  Checkpoint: Review Generated Tests                   │
├─────────────────────────────────────────────────────────┤
│ I've generated 15 unit tests for UserService.           │
│                                                         │
│ ✓ Test coverage: 94.2%                                  │
│ ✓ All edge cases covered                                │
│ ✓ Follows project conventions                           │
│                                                         │
│ Preview:                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ describe('UserService', () => {                     │ │
│ │   it('should create user with valid data', ...      │ │
│ │   it('should reject invalid email', ...             │ │
│ │   it('should handle duplicate users', ...           │ │
│ │   ... (12 more tests)                               │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View All Tests] [Continue] [Modify] [Cancel]           │
└─────────────────────────────────────────────────────────┘
```

### Human Approval Gates

**High-Stakes Actions:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Approval Required                                    │
├─────────────────────────────────────────────────────────┤
│ I'm about to send 847 personalized emails to your      │
│ customer list.                                          │
│                                                         │
│ Details:                                                │
│ • From: marketing@company.com                           │
│ • Subject: "New Feature Announcement"                   │
│ • Recipients: 847 active customers                      │
│ • Send rate: 2 hours (to avoid spam filters)            │
│                                                         │
│ Sample emails (5 random):                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ To: john@example.com                                │ │
│ │ Hi John, We're excited to announce...              │ │
│ │                                                     │ │
│ │ To: sarah@example.com                               │ │
│ │ Hi Sarah, We're excited to announce...             │ │
│ │ ... (3 more samples)                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [View All Emails] [Approve] [Modify] [Cancel]           │
└─────────────────────────────────────────────────────────┘
```

### Workflow Templates

**Common Multi-Step Workflows:**

**1. Bug Fix Workflow:**
```
Step 1: Analyze bug report
Step 2: Read relevant files
Step 3: Identify root cause
Step 4: Generate fix
Step 5: Apply fix
Step 6: Run tests
Step 7: Verify fix
```

**2. Feature Implementation Workflow:**
```
Step 1: Understand requirements
Step 2: Design architecture
Step 3: Create files
Step 4: Implement logic
Step 5: Write tests
Step 6: Update documentation
Step 7: Review and refine
```

**3. Refactoring Workflow:**
```
Step 1: Analyze current code
Step 2: Identify improvements
Step 3: Plan refactoring
Step 4: Apply changes
Step 5: Run tests
Step 6: Verify no regressions
```

### Workflow Visualization

**Visual Workflow Progress:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Feature Implementation Workflow                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ✓ Understand requirements                              │
│  │                                                      │
│  ✓ Design architecture                                  │
│  │                                                      │
│  ⏳ Create files [Current]                              │
│  │                                                      │
│  ⏳ Implement logic                                      │
│  │                                                      │
│  ⏳ Write tests                                          │
│  │                                                      │
│  ⏳ Update documentation                                 │
│  │                                                      │
│  ⏳ Review and refine                                    │
│                                                         │
│ [Pause] [Skip Step] [Cancel]                            │
└─────────────────────────────────────────────────────────┘
```

**Conclusion:** Multi-step workflows with progress indicators, checkpoints, and approval gates give users visibility and control over long-running operations.

---

## 10. Command Palette & Suggestion Chips

### Status: ✅ **ESSENTIAL - Eliminates "Blank Prompt Problem"**

Based on Xcapit research, the "blank prompt problem" is a major UX failure. Command palettes and suggestion chips guide users to successful interactions.

### Command Palette (Cmd+K)

**Keyboard-Driven Interface:**

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Command Palette                              [Esc]   │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Type a command or search...                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🐛 Fix a Bug                                            │
│    Analyze and fix bugs in your code                    │
│                                                         │
│ ✨ Build a Feature                                      │
│    Implement new functionality                          │
│                                                         │
│ 📖 Explain Code                                         │
│    Understand how code works                            │
│                                                         │
│ 🧪 Generate Tests                                       │
│    Create unit tests for your code                      │
│                                                         │
│ 🔍 Review Changes                                       │
│    Review recent code changes                           │
│                                                         │
│ 📝 Write Documentation                                  │
│    Generate docs for your code                          │
│                                                         │
│ [↑↓ Navigate] [Enter Select] [Esc Close]               │
└─────────────────────────────────────────────────────────┘
```

**With Search:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Command Palette                              [Esc]   │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ test                                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 🧪 Generate Tests                                       │
│    Create unit tests for your code                      │
│                                                         │
│ 🧪 Run Tests                                            │
│    Execute test suite                                   │
│                                                         │
│ 🧪 Fix Failing Tests                                    │
│    Debug and fix test failures                          │
│                                                         │
│ 🧪 Update Test Snapshots                                │
│    Update Jest snapshots                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Suggestion Chips

**Contextual Quick Actions:**

**1. Empty State Suggestions:**
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              Start a conversation                       │
│                                                         │
│  [🐛 Fix a bug]  [✨ Build feature]  [📖 Explain code] │
│                                                         │
│  [🧪 Generate tests]  [🔍 Review changes]               │
└─────────────────────────────────────────────────────────┘
```

**2. After User Message:**
```
User: The login form is broken

ForgeAI: I'll help you fix the login form. What would you like me to do?

[Debug the issue]  [Show error logs]  [Read login code]
```

**3. After AI Response:**
```
ForgeAI: I found the issue! Missing email validation.

[Apply fix]  [Explain more]  [Show tests]  [Try different approach]
```

**4. Context-Aware Suggestions:**
```
[Current file: src/auth/login.ts]

Quick actions for this file:
[Explain this file]  [Generate tests]  [Find bugs]  [Refactor]
```

### Command Categories

**Organized by Task Type:**

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Command Palette                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🐛 Debugging & Fixes                                    │
│    • Fix a bug                                          │
│    • Debug error                                        │
│    • Analyze crash                                      │
│    • Fix failing tests                                  │
│                                                         │
│ ✨ Feature Development                                  │
│    • Build a feature                                    │
│    • Add functionality                                  │
│    • Implement API endpoint                             │
│    • Create component                                   │
│                                                         │
│ 🧪 Testing                                              │
│    • Generate tests                                     │
│    • Run tests                                          │
│    • Fix failing tests                                  │
│    • Update snapshots                                   │
│                                                         │
│ 📖 Documentation                                        │
│    • Explain code                                       │
│    • Write docs                                         │
│    • Generate README                                    │
│    • Add comments                                       │
│                                                         │
│ 🔍 Code Review                                          │
│    • Review changes                                     │
│    • Check for bugs                                     │
│    • Suggest improvements                               │
│    • Analyze complexity                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Recent Commands

**Quick Access to Recent Actions:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Command Palette                                       │
├─────────────────────────────────────────────────────────┤
│ Recent:                                                 │
│                                                         │
│ 🐛 Fix a bug (used 2 hours ago)                         │
│ 🧪 Generate tests (used yesterday)                      │
│ 📖 Explain code (used 2 days ago)                       │
│                                                         │
│ ─────────────────────────────────────────────────────  │
│                                                         │
│ All Commands:                                           │
│ [Show all...]                                           │
└─────────────────────────────────────────────────────────┘
```

### Custom Commands

**User-Defined Quick Actions:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚙️  Custom Commands                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ My Commands:                                            │
│                                                         │
│ • "Run full test suite"                                 │
│   → npm test && npm run e2e                             │
│                                                         │
│ • "Deploy to staging"                                   │
│   → npm run build && deploy staging                     │
│                                                         │
│ • "Generate API docs"                                   │
│   → Generate OpenAPI docs from code                     │
│                                                         │
│ [Add Command] [Edit] [Delete]                           │
└─────────────────────────────────────────────────────────┘
```

**Conclusion:** Command palette and suggestion chips eliminate the blank prompt problem by guiding users to successful interactions. Contextual suggestions make the AI feel proactive and helpful.

---

## 11. Implementation Examples

### Status: ✅ **PRACTICAL - Ready-to-Use Code Patterns**

Complete TypeScript/React implementation examples for key UI components.

### Streaming Response Handler

```typescript
// Extension side - Handle streaming from Ollama
import * as vscode from 'vscode';

interface StreamMessage {
  type: 'thinking' | 'toolCall' | 'message' | 'complete';
  content?: string;
  tool?: string;
  args?: any;
  status?: 'queued' | 'running' | 'complete' | 'failed';
  confidence?: 'high' | 'medium' | 'low';
}

async function streamAgentResponse(
  prompt: string,
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen3-coder:397b',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        options: {
          temperature: 0.7,
          // Enable thinking/reasoning
          think: true
        }
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const data = JSON.parse(line);
          
          // Send different message types to webview
          if (data.thinking) {
            webview.postMessage({
              type: 'thinking',
              content: data.thinking,
              confidence: data.confidence || 'medium'
            });
          } else if (data.tool_call) {
            // Tool execution started
            webview.postMessage({
              type: 'toolCall',
              tool: data.tool_call.name,
              args: data.tool_call.arguments,
              status: 'running'
            });
            
            // Execute tool
            const result = await executeTool(
              data.tool_call.name,
              data.tool_call.arguments,
              context
            );
            
            // Send result
            webview.postMessage({
              type: 'toolCall',
              tool: data.tool_call.name,
              args: data.tool_call.arguments,
              status: result.success ? 'complete' : 'failed',
              result: result.data
            });
          } else if (data.message) {
            // Regular response
            webview.postMessage({
              type: 'message',
              content: data.message.content
            });
          }
        } catch (e) {
          console.error('Failed to parse stream chunk:', e);
        }
      }
    }

    // Stream complete
    webview.postMessage({ type: 'complete' });
    
  } catch (error) {
    webview.postMessage({
      type: 'error',
      content: `Failed to connect to Ollama: ${error.message}`
    });
  }
}

// Tool execution
async function executeTool(
  tool: string,
  args: any,
  context: vscode.ExtensionContext
): Promise<{ success: boolean; data: any }> {
  try {
    switch (tool) {
      case 'readFile':
        const content = await vscode.workspace.fs.readFile(
          vscode.Uri.file(args.path)
        );
        return {
          success: true,
          data: new TextDecoder().decode(content)
        };
        
      case 'writeFile':
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(args.path),
          new TextEncoder().encode(args.content)
        );
        return { success: true, data: 'File written successfully' };
        
      case 'grepSearch':
        // Implement search logic
        return { success: true, data: [] };
        
      default:
        return { success: false, data: `Unknown tool: ${tool}` };
    }
  } catch (error) {
    return { success: false, data: error.message };
  }
}
```

### React Activity Stream Component

```tsx
import { useState, useEffect, useRef } from 'react';

interface ActivityItem {
  id: string;
  type: 'thinking' | 'toolCall' | 'message';
  content: string;
  tool?: string;
  args?: any;
  result?: any;
  status?: 'queued' | 'running' | 'complete' | 'failed';
  confidence?: 'high' | 'medium' | 'low';
  timestamp: number;
  expanded?: boolean;
}

function ActivityStream() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Listen for messages from extension
    const handler = (event: MessageEvent) => {
      const message = event.data;
      
      switch (message.type) {
        case 'thinking':
          setActivities(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'thinking',
            content: message.content,
            confidence: message.confidence,
            timestamp: Date.now(),
            expanded: false
          }]);
          break;
          
        case 'toolCall':
          if (message.status === 'running') {
            // Add new tool call
            setActivities(prev => [...prev, {
              id: crypto.randomUUID(),
              type: 'toolCall',
              content: '',
              tool: message.tool,
              args: message.args,
              status: 'running',
              timestamp: Date.now(),
              expanded: false
            }]);
          } else {
            // Update existing tool call
            setActivities(prev => prev.map(item =>
              item.tool === message.tool && item.status === 'running'
                ? { ...item, status: message.status, result: message.result }
                : item
            ));
          }
          break;
          
        case 'message':
          setActivities(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'message',
            content: message.content,
            timestamp: Date.now()
          }]);
          break;
          
        case 'complete':
          setIsStreaming(false);
          break;
          
        case 'error':
          setActivities(prev => [...prev, {
            id: crypto.randomUUID(),
            type: 'message',
            content: `Error: ${message.content}`,
            timestamp: Date.now()
          }]);
          setIsStreaming(false);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activities]);

  const toggleExpand = (id: string) => {
    setActivities(prev => prev.map(item =>
      item.id === id ? { ...item, expanded: !item.expanded } : item
    ));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Activity Stream */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2"
      >
        {activities.map(activity => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            onToggleExpand={() => toggleExpand(activity.id)}
          />
        ))}
        
        {isStreaming && (
          <div className="flex items-center gap-2 text-sm text-(--vscode-descriptionForeground)">
            <span className="animate-pulse">●</span>
            <span>ForgeAI is thinking...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-(--vscode-input-border) p-4">
        <MessageInput disabled={isStreaming} />
      </div>
    </div>
  );
}

function ActivityCard({
  activity,
  onToggleExpand
}: {
  activity: ActivityItem;
  onToggleExpand: () => void;
}) {
  if (activity.type === 'thinking') {
    return (
      <div
        className="flex items-start gap-2 p-3 rounded cursor-pointer
                   bg-(--vscode-editor-inactiveSelectionBackground)
                   hover:bg-(--vscode-list-hoverBackground)"
        onClick={onToggleExpand}
      >
        <span className="text-lg">🧠</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-(--vscode-descriptionForeground)">
              Thinking
            </span>
            {activity.confidence && (
              <ConfidenceBadge level={activity.confidence} />
            )}
          </div>
          <div className="text-sm text-(--vscode-editor-foreground)">
            {activity.expanded
              ? activity.content
              : activity.content.substring(0, 100) + '...'}
          </div>
          <button className="text-xs text-(--vscode-textLink-foreground) mt-1">
            {activity.expanded ? 'Collapse ▲' : 'Expand ▼'}
          </button>
        </div>
      </div>
    );
  }

  if (activity.type === 'toolCall') {
    return (
      <div
        className="flex items-start gap-2 p-3 rounded cursor-pointer
                   bg-(--vscode-editor-inactiveSelectionBackground)
                   hover:bg-(--vscode-list-hoverBackground)"
        onClick={onToggleExpand}
      >
        <StatusIcon status={activity.status!} />
        <div className="flex-1">
          <div className="text-xs text-(--vscode-descriptionForeground) mb-1">
            Tool Execution
          </div>
          <code className="text-sm text-(--vscode-editor-foreground)">
            {activity.tool}({JSON.stringify(activity.args)})
          </code>
          {activity.expanded && activity.result && (
            <pre className="mt-2 p-2 rounded bg-(--vscode-editor-background) text-xs overflow-x-auto">
              {JSON.stringify(activity.result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded">
      <span className="text-lg">🤖</span>
      <div className="flex-1 text-sm text-(--vscode-editor-foreground)">
        {activity.content}
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { icon: '✅', label: 'High', color: 'text-green-500' },
    medium: { icon: '⚠️', label: 'Medium', color: 'text-yellow-500' },
    low: { icon: '🔴', label: 'Low', color: 'text-red-500' }
  };

  const { icon, label, color } = config[level];

  return (
    <span className={`text-xs ${color} flex items-center gap-1`}>
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  const icons = {
    queued: '⏳',
    running: '🔄',
    complete: '✓',
    failed: '❌'
  };

  return <span className="text-lg">{icons[status] || '●'}</span>;
}

function MessageInput({ disabled }: { disabled: boolean }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;

    // Send message to extension
    vscode.postMessage({
      command: 'sendMessage',
      text: message
    });

    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Ask ForgeAI anything..."
        disabled={disabled}
        className="flex-1 px-4 py-2 rounded
                   bg-(--vscode-input-background)
                   text-(--vscode-input-foreground)
                   border border-(--vscode-input-border)
                   focus:outline-none focus:ring-2
                   focus:ring-(--vscode-focusBorder)
                   disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="px-4 py-2 rounded
                   bg-(--vscode-button-background)
                   text-(--vscode-button-foreground)
                   hover:bg-(--vscode-button-hoverBackground)
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </form>
  );
}

export default ActivityStream;
```

### Conversation Storage Service

```typescript
import * as vscode from 'vscode';

interface Conversation {
  id: string;
  workspaceId: string;
  tabId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  metadata: ConversationMetadata;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  thinking?: ThinkingBlock[];
  confidence?: 'high' | 'medium' | 'low';
}

class ConversationStorageService {
  constructor(private context: vscode.ExtensionContext) {}

  async saveConversation(conversation: Conversation): Promise<void> {
    const workspaceId = this.getWorkspaceId();
    const key = `conversation_${workspaceId}_${conversation.id}`;
    
    await this.context.workspaceState.update(key, {
      ...conversation,
      savedAt: Date.now()
    });
  }

  async loadConversation(conversationId: string): Promise<Conversation | null> {
    const workspaceId = this.getWorkspaceId();
    const key = `conversation_${workspaceId}_${conversationId}`;
    
    return this.context.workspaceState.get<Conversation>(key) || null;
  }

  async loadAllConversations(): Promise<Conversation[]> {
    const workspaceId = this.getWorkspaceId();
    const keys = this.context.workspaceState.keys();
    const prefix = `conversation_${workspaceId}_`;
    
    const conversations: Conversation[] = [];
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        const conv = this.context.workspaceState.get<Conversation>(key);
        if (conv) conversations.push(conv);
      }
    }
    
    // Sort by most recent first
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const workspaceId = this.getWorkspaceId();
    const key = `conversation_${workspaceId}_${conversationId}`;
    await this.context.workspaceState.update(key, undefined);
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    const allConversations = await this.loadAllConversations();
    const lowerQuery = query.toLowerCase();
    
    return allConversations.filter(conv => {
      // Search in title
      if (conv.title.toLowerCase().includes(lowerQuery)) return true;
      
      // Search in messages
      return conv.messages.some(msg =>
        msg.content.toLowerCase().includes(lowerQuery)
      );
    });
  }

  async exportConversation(
    conversationId: string,
    format: 'markdown' | 'json'
  ): Promise<string> {
    const conversation = await this.loadConversation(conversationId);
    if (!conversation) throw new Error('Conversation not found');

    if (format === 'json') {
      return JSON.stringify(conversation, null, 2);
    }

    // Markdown format
    let markdown = `# ${conversation.title}\n\n`;
    markdown += `**Date:** ${new Date(conversation.createdAt).toLocaleString()}\n`;
    markdown += `**Model:** ${conversation.metadata.model}\n`;
    markdown += `**Messages:** ${conversation.messages.length}\n\n`;
    markdown += `---\n\n`;
    markdown += `## Conversation\n\n`;

    for (const message of conversation.messages) {
      if (message.role === 'user') {
        markdown += `**User:** ${message.content}\n\n`;
      } else {
        markdown += `**ForgeAI:** ${message.content}\n\n`;
        
        if (message.thinking) {
          for (const think of message.thinking) {
            markdown += `*Thinking: ${think.content}*\n\n`;
          }
        }
        
        if (message.toolCalls) {
          for (const tool of message.toolCalls) {
            markdown += `*Tool: ${tool.tool}(${JSON.stringify(tool.args)})*\n\n`;
          }
        }
      }
    }

    return markdown;
  }

  private getWorkspaceId(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'global';
  }
}

export default ConversationStorageService;
```

**Conclusion:** These implementation examples provide ready-to-use patterns for streaming responses, activity visualization, and conversation persistence using VS Code APIs.

---

## 12. Recommended Component Architecture

### Status: ✅ **COMPLETE - Production-Ready Structure**

Final component hierarchy and architecture for ForgeAI's UI.

### Component Hierarchy

```
ForgeAIExtension (VS Code Extension)
│
├── WebviewPanel (Main UI Container)
│   │
│   ├── SplitView
│   │   │
│   │   ├── LeftPanel (Activity & Conversation)
│   │   │   │
│   │   │   ├── TabBar
│   │   │   │   ├── Tab (multiple)
│   │   │   │   └── NewTabButton
│   │   │   │
│   │   │   ├── ActivityStream
│   │   │   │   ├── ThinkingBlock (multiple)
│   │   │   │   ├── ToolCard (multiple)
│   │   │   │   └── MessageBubble (multiple)
│   │   │   │
│   │   │   └── MessageInput
│   │   │       ├── TextArea
│   │   │       ├── AttachmentButton
│   │   │       └── SendButton
│   │   │
│   │   └── RightPanel (Live Preview)
│   │       │
│   │       ├── CodeDiffView
│   │       ├── TestResultsView
│   │       ├── FilePreview
│   │       └── DocumentationView
│   │
│   ├── CommandPalette (Cmd+K)
│   │   ├── SearchInput
│   │   └── CommandList
│   │
│   ├── HistorySidebar
│   │   ├── SearchBar
│   │   ├── FilterControls
│   │   └── ConversationList
│   │       └── ConversationCard (multiple)
│   │
│   └── SettingsPanel
│       ├── AutonomySettings
│       ├── ThinkingVisibility
│       └── AutoApprovalRules
│
└── StorageService
    ├── ConversationStorage
    ├── SettingsStorage
    └── CacheStorage
```

### Core Components

**1. ForgeAIExtension (extension.ts)**
```typescript
import * as vscode from 'vscode';
import ConversationStorageService from './services/storage';
import { streamAgentResponse } from './services/ollama';

export function activate(context: vscode.ExtensionContext) {
  const storageService = new ConversationStorageService(context);
  
  // Register command to open ForgeAI
  const openCommand = vscode.commands.registerCommand(
    'forgeai.open',
    () => {
      const panel = vscode.window.createWebviewPanel(
        'forgeai',
        'ForgeAI',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'dist')
          ]
        }
      );

      // Set webview HTML
      panel.webview.html = getWebviewContent(panel.webview, context);

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'sendMessage':
              await streamAgentResponse(
                message.text,
                panel.webview,
                context
              );
              break;
              
            case 'saveConversation':
              await storageService.saveConversation(message.conversation);
              break;
              
            case 'loadConversations':
              const conversations = await storageService.loadAllConversations();
              panel.webview.postMessage({
                command: 'conversationsLoaded',
                conversations
              });
              break;
          }
        },
        undefined,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(openCommand);
}

function getWebviewContent(
  webview: vscode.Webview,
  context: vscode.ExtensionContext
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.css')
  );

  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="${styleUri}" rel="stylesheet">
      <title>ForgeAI</title>
    </head>
    <body>
      <div id="root"></div>
      <script src="${scriptUri}"></script>
    </body>
    </html>`;
}
```

**2. Main App Component (App.tsx)**
```typescript
import { useState } from 'react';
import SplitView from './components/SplitView';
import CommandPalette from './components/CommandPalette';
import HistorySidebar from './components/HistorySidebar';
import WelcomeScreen from './components/WelcomeScreen';

function App() {
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [hasConversations, setHasConversations] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      
      // Cmd+Shift+H or Ctrl+Shift+H
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'h') {
        e.preventDefault();
        setShowHistory(!showHistory);
      }
      
      // Escape
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistory]);

  if (!hasConversations) {
    return <WelcomeScreen onStart={() => setHasConversations(true)} />;
  }

  return (
    <div className="h-screen flex">
      {/* History Sidebar */}
      {showHistory && (
        <HistorySidebar onClose={() => setShowHistory(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1">
        <SplitView />
      </div>

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
    </div>
  );
}

export default App;
```

**3. State Management (Zustand)**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Tab {
  id: string;
  title: string;
  conversationId: string;
  createdAt: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: any[];
  thinking?: any[];
}

interface ForgeAIStore {
  // Tabs
  tabs: Tab[];
  activeTabId: string | null;
  addTab: () => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  
  // Messages
  messages: Record<string, Message[]>;
  addMessage: (tabId: string, message: Message) => void;
  
  // UI State
  showHistory: boolean;
  showCommandPalette: boolean;
  toggleHistory: () => void;
  toggleCommandPalette: () => void;
  
  // Settings
  autonomyLevel: 'supervised' | 'semi-autonomous' | 'autonomous';
  thinkingVisible: boolean;
  setAutonomyLevel: (level: string) => void;
  setThinkingVisible: (visible: boolean) => void;
}

const useForgeAIStore = create<ForgeAIStore>()(
  persist(
    (set, get) => ({
      // Initial state
      tabs: [],
      activeTabId: null,
      messages: {},
      showHistory: false,
      showCommandPalette: false,
      autonomyLevel: 'semi-autonomous',
      thinkingVisible: true,
      
      // Tab actions
      addTab: () => {
        const newTab: Tab = {
          id: crypto.randomUUID(),
          title: 'New Conversation',
          conversationId: crypto.randomUUID(),
          createdAt: Date.now()
        };
        
        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
          messages: {
            ...state.messages,
            [newTab.id]: []
          }
        }));
      },
      
      closeTab: (tabId) => {
        const state = get();
        const tabs = state.tabs.filter((t) => t.id !== tabId);
        const activeTabId = state.activeTabId === tabId
          ? tabs[tabs.length - 1]?.id || null
          : state.activeTabId;
        
        set({ tabs, activeTabId });
      },
      
      switchTab: (tabId) => {
        set({ activeTabId: tabId });
      },
      
      // Message actions
      addMessage: (tabId, message) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [tabId]: [...(state.messages[tabId] || []), message]
          }
        }));
      },
      
      // UI actions
      toggleHistory: () => {
        set((state) => ({ showHistory: !state.showHistory }));
      },
      
      toggleCommandPalette: () => {
        set((state) => ({ showCommandPalette: !state.showCommandPalette }));
      },
      
      // Settings actions
      setAutonomyLevel: (level) => {
        set({ autonomyLevel: level as any });
      },
      
      setThinkingVisible: (visible) => {
        set({ thinkingVisible: visible });
      }
    }),
    {
      name: 'forgeai-store',
      storage: vscodeStorage // Custom VS Code storage adapter
    }
  )
);

export default useForgeAIStore;
```

### File Structure

```
forgeai-extension/
├── src/
│   ├── extension.ts                 # VS Code extension entry
│   ├── services/
│   │   ├── ollama.ts                # Ollama API integration
│   │   ├── storage.ts               # Conversation storage
│   │   └── tools.ts                 # Tool execution
│   │
│   └── webview/
│       ├── index.tsx                # React entry point
│       ├── App.tsx                  # Main app component
│       │
│       ├── components/
│       │   ├── SplitView.tsx
│       │   ├── ActivityStream.tsx
│       │   ├── ThinkingBlock.tsx
│       │   ├── ToolCard.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── MessageInput.tsx
│       │   ├── TabBar.tsx
│       │   ├── CommandPalette.tsx
│       │   ├── HistorySidebar.tsx
│       │   ├── WelcomeScreen.tsx
│       │   └── SettingsPanel.tsx
│       │
│       ├── hooks/
│       │   ├── useVSCodeMessage.ts
│       │   ├── useConversation.ts
│       │   └── useKeyboardShortcuts.ts
│       │
│       ├── store/
│       │   └── forgeai.ts           # Zustand store
│       │
│       ├── types/
│       │   └── index.ts             # TypeScript types
│       │
│       └── styles/
│           └── globals.css          # Tailwind + VS Code vars
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

### Build Configuration

**package.json:**
```json
{
  "name": "forgeai",
  "displayName": "ForgeAI",
  "description": "Autonomous AI Coding Assistant",
  "version": "1.0.0",
  "engines": {
    "vscode": "^1.85.0"
  },
  "activationEvents": [
    "onCommand:forgeai.open"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "forgeai.open",
        "title": "Open ForgeAI"
      }
    ],
    "keybindings": [
      {
        "command": "forgeai.open",
        "key": "ctrl+shift+f",
        "mac": "cmd+shift+f"
      }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run build",
    "build": "vite build && tsc -p tsconfig.extension.json",
    "dev": "vite",
    "watch": "tsc -watch -p tsconfig.extension.json"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "@types/react": "^19.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

**tailwind.config.js:**
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/webview/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // VS Code theme colors will be injected via CSS variables
      }
    }
  },
  plugins: []
};
```

**Conclusion:** This component architecture provides a complete, production-ready structure for ForgeAI with clear separation of concerns, type safety, and VS Code integration.

---

## Summary & Next Steps

### Key Takeaways

1. **Split-screen architecture** with activity stream + live preview is the optimal layout
2. **Inline thinking visualization** with confidence indicators builds trust
3. **Real-time tool execution feedback** with expandable cards provides transparency
4. **Progressive autonomy** (3-tier system) balances safety with efficiency
5. **Conversation persistence** with per-workspace isolation is essential
6. **Command palette + suggestion chips** eliminate the blank prompt problem
7. **Graceful error handling** defines product quality

### Implementation Priority

**Phase 1: Core UI (Weeks 1-2)**
- ✅ Split-screen layout
- ✅ Activity stream with thinking blocks
- ✅ Tool execution cards
- ✅ Message input/output

**Phase 2: Persistence (Week 3)**
- ✅ Conversation storage (VS Code workspaceState)
- ✅ Tab management
- ✅ History sidebar

**Phase 3: Intelligence (Week 4)**
- ✅ Ollama streaming integration
- ✅ Tool execution
- ✅ Thinking visualization

**Phase 4: Trust & Control (Week 5)**
- ✅ Progressive autonomy
- ✅ Confidence indicators
- ✅ Approval dialogs
- ✅ Undo/escape hatches

**Phase 5: Polish (Week 6)**
- ✅ Command palette
- ✅ Suggestion chips
- ✅ Error handling
- ✅ Keyboard shortcuts

### Resources

- **Design System:** VS Code CSS Variables + Tailwind CSS v4.0
- **State Management:** Zustand v5
- **UI Framework:** React 19
- **Storage:** VS Code workspaceState/globalState APIs
- **Model:** Qwen3-Coder-397B (auto-selected)

---

**Research Completed:** May 3, 2026  
**Next Steps:** Begin Phase 1 implementation with split-screen layout and activity stream

---

## Additional Resources

### Official Documentation
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
- [React 19 Documentation](https://react.dev)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4)

### Research Sources
- [Xcapit - Designing UX for AI Agents](https://www.xcapit.com/en/blog/designing-ux-ai-agents)
- [InfoQ - Cursor 3 Agent-First Interface](https://www.infoq.com/news/2026/04/cursor-3-agent-first-interface/)
- [MindStudio - Claude Interactive Visualization](https://www.mindstudio.ai/blog/what-is-claude-interactive-visualization-generative-ui)
- [GitHub - ThinkChain](https://github.com/martinbowling/ThinkChain)
- [Microsoft - Chat History Storage Patterns](https://devblogs.microsoft.com/agent-framework/chat-history-storage-patterns-in-microsoft-agent-framework)
- [Cloudscape Design System - GenAI History](https://cloudscape.design/patterns/genai/history/)
- [LangChain - Frontend Patterns](https://docs.langchain.com/oss/javascript/langchain/frontend/tool-calling)

