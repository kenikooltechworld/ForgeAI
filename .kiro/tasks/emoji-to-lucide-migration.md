# Emoji to Lucide-React Migration

## Overview

Replace all emoji usage across the ForgeAI project with lucide-react icons for a more professional, consistent, and accessible UI.

**Why Lucide-React?**
- ✅ 1,500+ professional icons
- ✅ React 19 compatible
- ✅ Tree-shakeable (smaller bundle)
- ✅ TypeScript support
- ✅ Customizable (size, color, stroke)
- ✅ Accessible (proper ARIA attributes)
- ✅ VS Code theme integration

## Installation

```bash
npm install lucide-react
```

## Emoji → Lucide Icon Mapping

| Emoji | Lucide Icon | Import | Usage |
|-------|-------------|--------|-------|
| 🐛 | `Bug` | `import { Bug } from "lucide-react"` | Fix a bug |
| ✨ | `Sparkles` | `import { Sparkles } from "lucide-react"` | Build a feature |
| 📖 | `BookOpen` | `import { BookOpen } from "lucide-react"` | Explain code |
| 🧪 | `TestTube` | `import { TestTube } from "lucide-react"` | Generate tests |
| 🔍 | `Search` | `import { Search } from "lucide-react"` | Review changes / Search |
| 📝 | `FileText` | `import { FileText } from "lucide-react"` | Write docs |
| 🚀 | `Rocket` | `import { Rocket } from "lucide-react"` | Welcome / Launch |
| 💡 | `Lightbulb` | `import { Lightbulb } from "lucide-react"` | Tip / Idea |
| 🔧 | `Wrench` | `import { Wrench } from "lucide-react"` | Tool / Settings |
| 🖥️ | `Terminal` | `import { Terminal } from "lucide-react"` | Terminal / Command |
| ⏳ | `Clock` or `Loader2` | `import { Clock, Loader2 } from "lucide-react"` | Pending / Loading |
| ✓ / ✅ | `Check` or `CheckCircle` | `import { Check, CheckCircle } from "lucide-react"` | Success / Complete |
| ⚠️ | `AlertTriangle` | `import { AlertTriangle } from "lucide-react"` | Warning |
| 📄 | `File` | `import { File } from "lucide-react"` | File / Document |
| 🧠 | `Brain` | `import { Brain } from "lucide-react"` | Thinking / AI reasoning |
| ▼ | `ChevronDown` | `import { ChevronDown } from "lucide-react"` | Expand / Dropdown |
| ▲ | `ChevronUp` | `import { ChevronUp } from "lucide-react"` | Collapse |
| ✗ / ❌ | `X` or `XCircle` | `import { X, XCircle } from "lucide-react"` | Close / Error |
| 📷 | `Camera` | `import { Camera } from "lucide-react"` | Vision / Image |
| ☁️ | `Cloud` | `import { Cloud } from "lucide-react"` | Cloud models |
| ↓ | `Download` | `import { Download } from "lucide-react"` | Download / Local |
| 🔴 | `Circle` (with red color) | `import { Circle } from "lucide-react"` | Status indicator |

## Tasks

### 1. Update WelcomeScreen Component

**File:** `src/webview/components/WelcomeScreen/WelcomeScreen.tsx`

**Changes:**
```tsx
// Before
<h1>Welcome to ForgeAI 🚀</h1>
<button>🐛 Fix a bug</button>
<button>✨ Build a feature</button>
<button>📖 Explain code</button>
<button>🧪 Generate tests</button>
<button>🔍 Review changes</button>
<button>📝 Write docs</button>
<p>💡 Tip: Use Cmd+K...</p>

// After
import { Rocket, Bug, Sparkles, BookOpen, TestTube, Search, FileText, Lightbulb } from "lucide-react";

<h1>
  <Rocket size={24} className="inline mr-2" />
  Welcome to ForgeAI
</h1>
<button>
  <Bug size={20} className="mr-2" />
  Fix a bug
</button>
<button>
  <Sparkles size={20} className="mr-2" />
  Build a feature
</button>
<button>
  <BookOpen size={20} className="mr-2" />
  Explain code
</button>
<button>
  <TestTube size={20} className="mr-2" />
  Generate tests
</button>
<button>
  <Search size={20} className="mr-2" />
  Review changes
</button>
<button>
  <FileText size={20} className="mr-2" />
  Write docs
</button>
<p>
  <Lightbulb size={16} className="inline mr-1" />
  Tip: Use Cmd+K...
</p>
```

### 2. Update ThinkingBlock Component

**File:** `src/webview/components/ActivityStream/ThinkingBlock.tsx`

**Changes:**
```tsx
// Before
<div>🧠 Thinking...</div>
<button>Expand ▼</button>
<button>Collapse ▲</button>

// After
import { Brain, ChevronDown, ChevronUp } from "lucide-react";

<div>
  <Brain size={18} className="inline mr-2" />
  Thinking...
</div>
<button>
  Expand <ChevronDown size={16} className="inline ml-1" />
</button>
<button>
  Collapse <ChevronUp size={16} className="inline ml-1" />
</button>
```

### 3. Update ToolCard Component

**File:** `src/webview/components/ActivityStream/ToolCard.tsx`

**Changes:**
```tsx
// Before
const icon = type === 'file' ? '🔧' : '🖥️';
<span>{icon}</span>
<span>⏳ Pending</span>
<span>✓ Complete</span>
<span>⚠️ Error</span>
<button>Expand ▼</button>

// After
import { Wrench, Terminal, Clock, Check, AlertTriangle, ChevronDown } from "lucide-react";

const Icon = type === 'file' ? Wrench : Terminal;
<Icon size={18} />
<Clock size={16} className="inline mr-1" /> Pending
<Check size={16} className="inline mr-1" /> Complete
<AlertTriangle size={16} className="inline mr-1" /> Error
<button>
  Expand <ChevronDown size={14} className="inline ml-1" />
</button>
```

### 4. Update LivePreview Component

**File:** `src/webview/components/LivePreview/LivePreview.tsx`

**Changes:**
```tsx
// Before
<div>📄 Code changes and previews will appear here</div>

// After
import { File } from "lucide-react";

<div>
  <File size={48} className="mb-4 opacity-50" />
  <p>Code changes and previews will appear here</p>
</div>
```

### 5. Update OnboardingTooltip Component

**File:** `src/webview/components/OnboardingTooltip/OnboardingTooltip.tsx`

**Changes:**
```tsx
// Before
<p>💡 Tip: ForgeAI shows its thinking process...</p>
<p>💡 Tip: Click any tool card...</p>
<p>💡 Tip: All changes can be undone...</p>

// After
import { Lightbulb } from "lucide-react";

<p>
  <Lightbulb size={16} className="inline mr-2" />
  Tip: ForgeAI shows its thinking process...
</p>
<p>
  <Lightbulb size={16} className="inline mr-2" />
  Tip: Click any tool card...
</p>
<p>
  <Lightbulb size={16} className="inline mr-2" />
  Tip: All changes can be undone...
</p>
```

### 6. Update MessageFilter Component

**File:** `src/webview/components/ActivityStream/MessageFilter.tsx`

**Changes:**
```tsx
// Before
<input placeholder="🔍 Search messages..." />

// After
import { Search } from "lucide-react";

<div className="relative">
  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-50" />
  <input placeholder="Search messages..." className="pl-10" />
</div>
```

### 7. Update TestResults Component

**File:** `src/webview/components/LivePreview/TestResults.tsx`

**Changes:**
```tsx
// Before
<h3>🧪 Test Results</h3>
<div>✓ filename.test.ts (5/5 passed)</div>
<div>⚠️ filename.test.ts (3/5 passed)</div>
<div>✗ filename.test.ts (0/5 passed)</div>
<div>✓ test name (duration)</div>
<div>✗ test name (duration)</div>
<div>17/17 tests passed ✓ | Duration: 2.3s</div>

// After
import { TestTube, CheckCircle, AlertTriangle, XCircle, Check, X } from "lucide-react";

<h3>
  <TestTube size={20} className="inline mr-2" />
  Test Results
</h3>
<div>
  <CheckCircle size={16} className="inline mr-2 text-green-500" />
  filename.test.ts (5/5 passed)
</div>
<div>
  <AlertTriangle size={16} className="inline mr-2 text-amber-500" />
  filename.test.ts (3/5 passed)
</div>
<div>
  <XCircle size={16} className="inline mr-2 text-red-500" />
  filename.test.ts (0/5 passed)
</div>
<div>
  <Check size={14} className="inline mr-2 text-green-500" />
  test name (duration)
</div>
<div>
  <X size={14} className="inline mr-2 text-red-500" />
  test name (duration)
</div>
<div>
  17/17 tests passed <Check size={16} className="inline ml-1" /> | Duration: 2.3s
</div>
```

### 8. Update Settings Component (Model Selection)

**File:** `src/webview/components/Settings/Settings.tsx`

**Changes:**
```tsx
// Before
<option>gpt-oss:120b-cloud - Main coding (default) | Tools ✓ | Context: 128K</option>
<option>gemma4:31b-cloud - Vision + coding | Tools ✓ | Vision 📷 | Context: 128K</option>
<option>deepseek-v3.1:671b-cloud - Deep research | Tools ✓ | Thinking 🧠 | Context: 64K</option>
<option>kimi-k2.5:cloud - Long context, multimodal | Tools ✓ | Vision 📷 | Context: 200K+</option>
<option>qwen3-vl:8b - Local vision | Tools ✓ | Vision 📷 | ~6GB VRAM</option>
<option>deepseek-r1:8b - Local reasoning | Tools ✓ | Thinking 🧠 | ~6GB VRAM</option>
<div>Cloud (☁️)</div>
<div>Local (↓)</div>
<div>✓ gpt-oss:120b-cloud (Cloud) - Auto-selected</div>
<div>↓ Not installed</div>
<div>✓ Ready</div>

// After
import { Check, Camera, Brain, Cloud, Download } from "lucide-react";

<option>gpt-oss:120b-cloud - Main coding (default) | Tools ✓ | Context: 128K</option>
<option>
  gemma4:31b-cloud - Vision + coding | Tools ✓ | Vision <Camera size={12} className="inline" /> | Context: 128K
</option>
<option>
  deepseek-v3.1:671b-cloud - Deep research | Tools ✓ | Thinking <Brain size={12} className="inline" /> | Context: 64K
</option>
<option>
  kimi-k2.5:cloud - Long context, multimodal | Tools ✓ | Vision <Camera size={12} className="inline" /> | Context: 200K+
</option>
<option>
  qwen3-vl:8b - Local vision | Tools ✓ | Vision <Camera size={12} className="inline" /> | ~6GB VRAM
</option>
<option>
  deepseek-r1:8b - Local reasoning | Tools ✓ | Thinking <Brain size={12} className="inline" /> | ~6GB VRAM
</option>
<div>
  <Cloud size={16} className="inline mr-2" />
  Cloud
</div>
<div>
  <Download size={16} className="inline mr-2" />
  Local
</div>
<div>
  <Check size={16} className="inline mr-2 text-green-500" />
  gpt-oss:120b-cloud (Cloud) - Auto-selected
</div>
<div>
  <Download size={16} className="inline mr-2 opacity-50" />
  Not installed
</div>
<div>
  <Check size={16} className="inline mr-2 text-green-500" />
  Ready
</div>
```

### 9. Update Error Notifications

**File:** `src/webview/components/ErrorNotification.tsx` (if exists) or inline error displays

**Changes:**
```tsx
// Before
<div>⚠️ Agent reached maximum iterations (20). Task may be incomplete.</div>
<div>⚠️ Cannot connect to Ollama...</div>

// After
import { AlertTriangle } from "lucide-react";

<div>
  <AlertTriangle size={20} className="inline mr-2 text-amber-500" />
  Agent reached maximum iterations (20). Task may be incomplete.
</div>
<div>
  <AlertTriangle size={20} className="inline mr-2 text-red-500" />
  Cannot connect to Ollama...
</div>
```

### 10. Update ChatParticipant Progress Messages

**File:** `src/extension/providers/ChatParticipant.ts`

**Changes:**
```typescript
// Before
stream.progress("🔧 Executing forgeai_listDirectory...");
stream.progress("✅ forgeai_listDirectory completed (45ms)");
stream.progress("⚠️ Error occurred");

// After
// Note: VS Code chat doesn't support React components, so keep text-based icons
// But make them consistent:
stream.progress("🔧 Executing forgeai_listDirectory...");
stream.progress("✅ forgeai_listDirectory completed (45ms)");
stream.progress("⚠️ Error occurred");

// OR use text alternatives:
stream.progress("[TOOL] Executing forgeai_listDirectory...");
stream.progress("[DONE] forgeai_listDirectory completed (45ms)");
stream.progress("[ERROR] Error occurred");
```

### 11. Update Documentation Files

**Files:** 
- `.kiro/specs/core-extension-foundation-phase-1/tasks.md`
- `TOKEN_USAGE_DEBUG_REPORT.md`
- `test-token-usage.js`
- `test-ollama.js`

**Changes:** Replace emoji in comments and console.log statements with text descriptions or keep them (documentation can have emoji for readability).

**Decision:** Keep emoji in documentation files for readability. Only replace in UI components.

## Testing Checklist

After migration, verify:

- [ ] All components render correctly with lucide-react icons
- [ ] Icons have appropriate sizes (16-24px typically)
- [ ] Icons have proper spacing (mr-1, mr-2, etc.)
- [ ] Icons inherit VS Code theme colors via `style={{ color: 'var(--vscode-...)' }}` or className
- [ ] Icons are accessible (proper aria-labels on icon-only buttons)
- [ ] Bundle size hasn't increased significantly (lucide is tree-shakeable)
- [ ] No console errors related to missing icons
- [ ] Icons look good in both dark and light themes
- [ ] Icons scale properly at different zoom levels

## Benefits After Migration

1. **Professional Appearance** - Consistent, scalable vector icons
2. **Better Accessibility** - Proper ARIA attributes, screen reader support
3. **Theme Integration** - Icons automatically adapt to VS Code theme colors
4. **Smaller Bundle** - Tree-shaking removes unused icons
5. **Customizable** - Easy to adjust size, color, stroke width
6. **Maintainable** - Easier to update and modify than emoji

## Rollback Plan

If issues arise:
1. Revert changes via Git: `git revert <commit-hash>`
2. Remove lucide-react: `npm uninstall lucide-react`
3. Restore emoji from backup

## Estimated Time

- **Setup:** 10 minutes (install lucide-react)
- **Component Updates:** 2-3 hours (11 components)
- **Testing:** 1 hour (verify all themes and scenarios)
- **Total:** ~4 hours
