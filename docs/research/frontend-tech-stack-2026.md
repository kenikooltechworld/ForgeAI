# Frontend Tech Stack Research — 2026

**Project:** ForgeAI - Autonomous AI Coding Assistant  
**Research Date:** May 3, 2026  
**Focus Areas:** React, Tailwind CSS, VS Code Theming, State Management, Tab/Session Management  
**Primary Sources:**
- [React 19 Documentation](https://react.dev)
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)
- [GitHub Next - React Webview UI Toolkit](https://githubnext.com/projects/react-webview-ui-toolkit)

---

## Executive Summary

This research provides a comprehensive analysis of frontend technologies for building ForgeAI's VS Code extension webview. The key finding is that the official **VS Code Webview UI Toolkit has been deprecated** (January 1, 2025), requiring a custom solution. The recommended stack combines **React 19**, **Tailwind CSS v4.0**, and **Zustand v5** with **VS Code's native theme system** for perfect theme integration.

**Key Findings:**
- ⚠️ VS Code Webview UI Toolkit deprecated - cannot use
- ✅ 400+ VS Code CSS variables available for theming
- ✅ Tailwind CSS v4.0 provides perfect VS Code theme integration
- ✅ React 19 introduces game-changing hooks (useActionState, useOptimistic)
- ✅ Zustand v5 offers lightweight state management (1KB) with VS Code storage adapters
- ✅ VS Code storage APIs superior to localStorage for extensions
- ✅ Custom tab management required (no native API)

**Recommended Stack:**
- **UI Framework:** React 19
- **Styling:** Tailwind CSS v4.0 + VS Code CSS Variables
- **State Management:** Zustand v5
- **Persistence:** VS Code workspaceState/globalState APIs
- **Total Bundle Size:** ~96KB gzipped

---

## Table of Contents

1. [VS Code Webview UI Toolkit (Deprecated)](#1-vs-code-webview-ui-toolkit-deprecated)
2. [VS Code Native Theme System](#2-vs-code-native-theme-system)
3. [Tailwind CSS v4.0](#3-tailwind-css-v40-latest---january-2026)
4. [React 19](#4-react-19-latest---2026)
5. [Zustand v5 State Management](#5-zustand-v5-latest-state-management)
6. [VS Code State Persistence](#6-vs-code-state-persistence)
7. [Tab/Session Management Architecture](#7-tabsession-management-architecture)
8. [Recommended Architecture](#recommended-architecture)
9. [Implementation Roadmap](#implementation-roadmap)

---

## 1. VS Code Webview UI Toolkit (Deprecated)

### Status: ⚠️ **DEPRECATED (January 1, 2025)**

**Official Announcement:**
> "The Webview UI Toolkit for VS Code will be deprecated on January 1, 2025."

**What it was:**
- Official Microsoft component library for VS Code webviews
- Components: buttons, checkboxes, dropdowns, text fields, data grids, progress rings, etc.
- Automatic theme synchronization with VS Code
- React wrapper available: `@vscode/webview-ui-toolkit/react`
- Built on Microsoft FAST framework

**Why deprecated:**
- Microsoft is no longer maintaining it
- No future updates or bug fixes
- Community needs to find alternatives
- Focus shifted to other priorities

**Installation (for reference only):**
```bash
npm install @vscode/webview-ui-toolkit
```

**Example Usage (deprecated):**
```tsx
import { VSCodeButton, VSCodeTextField } from '@vscode/webview-ui-toolkit/react';

function MyComponent() {
  return (
    <div>
      <VSCodeTextField placeholder="Enter text" />
      <VSCodeButton>Click me</VSCodeButton>
    </div>
  );
}
```

**Conclusion:** ❌ **Cannot use** - deprecated, no future support

**Alternative:** Build custom components with Tailwind CSS + VS Code CSS variables

---

## 2. VS Code Native Theme System

### Status: ✅ **STABLE - 400+ CSS Variables Available**

VS Code provides a comprehensive theming system with over 400 CSS variables that automatically adapt to the user's selected theme (dark, light, high-contrast). These variables cover every aspect of the VS Code UI.

### Key CSS Variables

**Backgrounds:**
```css
--vscode-editor-background
--vscode-editor-foreground
--vscode-input-background
--vscode-input-foreground
--vscode-button-background
--vscode-button-foreground
--vscode-button-hoverBackground
```

**Borders:**
```css
--vscode-input-border
--vscode-focusBorder
--vscode-contrastBorder
```

**Text:**
```css
--vscode-foreground
--vscode-descriptionForeground
--vscode-errorForeground
```

**Lists:**
```css
--vscode-list-activeSelectionBackground
--vscode-list-hoverBackground
```

**Sidebar:**
```css
--vscode-sideBar-background
--vscode-sideBar-foreground
```

**And 390+ more variables...**

### Usage Example

```css
.my-component {
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
}
```

### Advantages

- ✅ Perfect alignment with VS Code UI
- ✅ Automatic theme adaptation (dark/light/high-contrast)
- ✅ Zero configuration required
- ✅ Consistent user experience
- ✅ No build step needed

### Disadvantages

- ❌ Limited to VS Code's design system
- ❌ No component library (toolkit deprecated)
- ❌ Less flexibility for custom designs
- ❌ Manual component building required
- ❌ No utility classes

**Conclusion:** VS Code CSS variables are essential for theme integration, but lack the developer experience of modern CSS frameworks.

---

## 3. Tailwind CSS v4.0 (Latest - January 2026)

### Status: ✅ **LATEST RELEASE - Major Rewrite (5x Faster)**

Tailwind CSS v4.0 was released in January 2026 with a complete rewrite of the engine, delivering massive performance improvements and a new CSS-first configuration approach.

### New Features in v4.0

#### 1. CSS-First Configuration
No more `tailwind.config.js` - configure directly in CSS:

```css
@import "tailwindcss";

@theme {
  --font-display: "Satoshi", "sans-serif";
  --breakpoint-3xl: 1920px;
  --color-brand-500: oklch(0.84 0.18 117.33);
  --spacing: 0.25rem;
}
```

#### 2. Built-in Import Support
No `postcss-import` plugin needed:

```css
@import "tailwindcss";
@import "./components.css";
@import "./utilities.css";
```

#### 3. Dynamic Utility Values
Works out of the box, no configuration needed:

```html
<!-- Any numeric value works automatically -->
<div class="grid grid-cols-15">
<div class="mt-29 w-17">
<div data-current class="opacity-75 data-current:opacity-100">
```

#### 4. Arbitrary Values with CSS Variables
Cleaner syntax for CSS variables:

```html
<!-- Old way (v3) -->
<div class="bg-[var(--vscode-input-background)]">

<!-- New way (v4) - cleaner syntax -->
<div class="bg-(--vscode-input-background)">
<div class="text-(--vscode-foreground)">
<div class="border-(--vscode-input-border)">
```

### Performance Improvements

- **Full builds:** 3.78x faster
- **Incremental builds:** 8.8x faster  
- **No new CSS:** 182x faster (measured in microseconds!)

### Modern CSS Features

- ✅ Native cascade layers (`@layer`)
- ✅ Registered custom properties (`@property`)
- ✅ `color-mix()` for opacity
- ✅ Logical properties for RTL support

### Integration with VS Code Themes

Perfect integration example combining Tailwind utilities with VS Code CSS variables:

```tsx
<div className="
  flex items-center gap-2 p-4
  bg-(--vscode-editor-background)
  text-(--vscode-editor-foreground)
  border border-(--vscode-input-border)
">
  <button className="
    px-4 py-2 rounded
    bg-(--vscode-button-background)
    text-(--vscode-button-foreground)
    hover:bg-(--vscode-button-hoverBackground)
    focus:ring-2 focus:ring-(--vscode-focusBorder)
  ">
    Click me
  </button>
</div>
```

### Advantages

- ✅ Full design flexibility
- ✅ Can access ALL VS Code CSS variables
- ✅ Modern tooling and developer experience
- ✅ Utility-first approach (fast development)
- ✅ Automatic theme adaptation (via CSS variables)
- ✅ Best of both worlds

### Disadvantages

- ❌ Additional build step required
- ❌ Larger bundle size (~50KB gzipped)
- ❌ Learning curve for team

**Conclusion:** Tailwind CSS v4.0 provides the perfect balance between developer experience and VS Code theme integration.

---

## 4. React 19 (Latest - 2026)

### Status: ✅ **LATEST RELEASE - Biggest Update Since Hooks**

React 19 introduces revolutionary new hooks and features that dramatically simplify form handling, optimistic UI updates, and async data fetching.

### New Hooks in React 19

#### 1. `useActionState` - Form Handling Made Easy

**Before (React 18):**
```tsx
function OldForm() {
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsPending(true);
    try {
      await submitForm(new FormData(e.target));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPending(false);
    }
  }

  return <form onSubmit={handleSubmit}>...</form>;
}
```

**After (React 19):**
```tsx
import { useActionState } from 'react';

function NewForm() {
  const [state, formAction, isPending] = useActionState(
    async (prevState, formData) => {
      try {
        await submitForm(formData);
        return { success: true, error: null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
    { success: false, error: null }
  );

  return (
    <form action={formAction}>
      {state.error && <p className="text-red-500">{state.error}</p>}
      <input name="email" type="email" />
      <button disabled={isPending}>
        {isPending ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
}
```

#### 2. `useOptimistic` - Instant UI Updates

```tsx
import { useOptimistic, useActionState } from 'react';

interface Message {
  id: string;
  text: string;
  pending?: boolean;
}

function MessageList({ initialMessages }: { initialMessages: Message[] }) {
  const [optimisticMessages, addOptimistic] = useOptimistic(
    initialMessages,
    (state, newMessage: Message) => [...state, newMessage]
  );

  const [, formAction] = useActionState(
    async (_, formData: FormData) => {
      const text = formData.get('text') as string;
      const optimisticMsg = { 
        id: crypto.randomUUID(), 
        text, 
        pending: true 
      };

      // Show immediately (optimistic)
      addOptimistic(optimisticMsg);

      // Then send to server
      await sendMessage(text);
    },
    null
  );

  return (
    <>
      <ul>
        {optimisticMessages.map(msg => (
          <li
            key={msg.id}
            className={msg.pending ? 'opacity-50' : 'opacity-100'}
          >
            {msg.text} {msg.pending && '(sending...)'}
          </li>
        ))}
      </ul>
      <form action={formAction}>
        <input name="text" placeholder="Type a message" />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

#### 3. `use()` Hook - Read Promises in Render

```tsx
import { use, Suspense } from 'react';

function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  // Suspends until promise resolves
  const user = use(userPromise);

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

function Page() {
  const userPromise = fetchUser(1);

  return (
    <Suspense fallback={<Skeleton />}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}
```

#### 4. `ref` as Prop (No More `forwardRef`)

```tsx
// React 19: ref is just a prop now
function Input({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} className="border rounded px-3 py-2" />;
}

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={() => inputRef.current?.focus()}>
      <Input ref={inputRef} type="text" />
    </form>
  );
}
```

#### 5. Document Metadata Auto-Hoisting

```tsx
function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      {/* These get hoisted to <head> automatically */}
      <title>{post.title} | My Blog</title>
      <meta name="description" content={post.excerpt} />
      <link rel="canonical" href={`https://example.com/blog/${post.slug}`} />

      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}
```

#### 6. Context Without Provider

```tsx
const ThemeContext = createContext('light');

// Before (React 18):
<ThemeContext.Provider value="dark">
  <Page />
</ThemeContext.Provider>

// After (React 19):
<ThemeContext value="dark">
  <Page />
</ThemeContext>
```

### React 19 vs React 18 Comparison

| Feature | React 18 | React 19 |
|---------|----------|----------|
| Form handling | Manual state | `useActionState` |
| Optimistic UI | Manual | `useOptimistic` |
| Async data | `useEffect` | `use()` + Suspense |
| Ref forwarding | `forwardRef` | Ref as prop |
| Context | `Context.Provider` | Context directly |
| Error tracking | Limited | 3 new callbacks |

**Conclusion:** React 19's new hooks dramatically simplify common patterns and reduce boilerplate code.

---

## 5. Zustand v5 (Latest State Management)

### Status: ✅ **LATEST RELEASE - Ultra-Lightweight (1KB gzipped)**

Zustand v5 is a minimalist state management library that provides a simple, unopinionated API with powerful middleware support.

### Basic Usage

```tsx
import { create } from 'zustand';

interface BearStore {
  bears: number;
  increase: () => void;
  decrease: () => void;
}

const useBearStore = create<BearStore>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  decrease: () => set((state) => ({ bears: state.bears - 1 })),
}));

// Usage in component
function BearCounter() {
  const bears = useBearStore((state) => state.bears);
  const increase = useBearStore((state) => state.increase);
  
  return (
    <div>
      <h1>{bears} bears</h1>
      <button onClick={increase}>Add bear</button>
    </div>
  );
}
```

### Key APIs

- **`create()`** - Create React-bound store
- **`createStore()`** - Vanilla store (no React)
- **`useStore()`** - Subscribe to store
- **`useShallow()`** - Shallow comparison

### Middlewares

#### 1. Persist Middleware (with Custom VS Code Storage)

```tsx
import { create } from 'zustand';
import { persist, StorageValue } from 'zustand/middleware';

// Custom VS Code storage adapter
function createVSCodeStorage(memento: vscode.Memento) {
  return {
    getItem: async (name: string): Promise<StorageValue<unknown> | null> => {
      const value = memento.get(name);
      return value ? JSON.parse(value as string) : null;
    },
    setItem: async (name: string, value: StorageValue<unknown>): Promise<void> => {
      await memento.update(name, JSON.stringify(value));
    },
    removeItem: async (name: string): Promise<void> => {
      await memento.update(name, undefined);
    },
  };
}

interface ConversationStore {
  conversations: Conversation[];
  activeTab: string;
  addConversation: (conv: Conversation) => void;
}

const useConversationStore = create<ConversationStore>()(
  persist(
    (set) => ({
      conversations: [],
      activeTab: '',
      addConversation: (conv) => set((state) => ({ 
        conversations: [...state.conversations, conv] 
      })),
    }),
    {
      name: 'forgeai-conversations',
      storage: createVSCodeStorage(context.workspaceState), // ✅ VS Code storage!
    }
  )
);
```

#### 2. DevTools Middleware

```tsx
import { devtools } from 'zustand/middleware';

const useStore = create<Store>()(
  devtools(
    (set) => ({
      // ... your store
    }),
    { name: 'ForgeAI Store' }
  )
);
```

#### 3. Immer Middleware (Mutable Syntax)

```tsx
import { immer } from 'zustand/middleware/immer';

const useStore = create<Store>()(
  immer((set) => ({
    todos: [],
    addTodo: (todo) => set((state) => {
      state.todos.push(todo); // Mutable syntax!
    }),
  }))
);
```

### Why Zustand for VS Code Extensions

- ✅ Lightweight (1KB vs Redux 20KB)
- ✅ No boilerplate
- ✅ Easy VS Code storage integration
- ✅ DevTools support
- ✅ TypeScript-first
- ✅ Can sync across webviews

**Conclusion:** Zustand provides the perfect balance of simplicity and power for VS Code extension state management.

---

## 6. VS Code State Persistence

### Status: ✅ **STABLE - 5 Storage Options Available**

VS Code provides multiple storage APIs for persisting extension data, each optimized for different use cases.

### Storage Options

```tsx
export function activate(context: vscode.ExtensionContext) {
  // 1. Workspace State (per-workspace key/value)
  await context.workspaceState.update('key', 'value');
  const value = context.workspaceState.get('key');

  // 2. Global State (global key/value, syncs across machines)
  await context.globalState.update('key', 'value');
  context.globalState.setKeysForSync(['key']); // Sync this key
  
  // 3. Storage URI (workspace-specific file storage)
  const workspaceStorageUri = context.storageUri;
  // Write files to: workspaceStorageUri.fsPath
  
  // 4. Global Storage URI (global file storage)
  const globalStorageUri = context.globalStorageUri;
  // Write files to: globalStorageUri.fsPath
  
  // 5. Secrets (encrypted storage)
  await context.secrets.store('apiKey', 'secret-value');
  const secret = await context.secrets.get('apiKey');
}
```

### Storage Comparison Table

| Storage Type | Use For | Syncs? | Encrypted? |
|--------------|---------|--------|------------|
| `workspaceState` | Workspace-specific data (conversations per workspace) | ❌ No | ❌ No |
| `globalState` | User preferences, global settings | ✅ Yes (with `setKeysForSync`) | ❌ No |
| `storageUri` | Large workspace files (embeddings, cache) | ❌ No | ❌ No |
| `globalStorageUri` | Large global files (models, databases) | ❌ No | ❌ No |
| `secrets` | API keys, tokens, passwords | ❌ No | ✅ Yes |

### Zustand + VS Code Storage Integration

#### Extension Side (extension.ts)

```tsx
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    'forgeai',
    'ForgeAI',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  // Listen for storage requests from webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'getState':
          const state = context.workspaceState.get(message.key);
          panel.webview.postMessage({ 
            command: 'stateResponse', 
            key: message.key, 
            value: state 
          });
          break;
        case 'setState':
          await context.workspaceState.update(message.key, message.value);
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}
```

#### Webview Side (React Component)

```tsx
import { create } from 'zustand';
import { persist, StateStorage } from 'zustand/middleware';

// VS Code webview storage adapter
const vscodeStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      // Request state from extension
      vscode.postMessage({ command: 'getState', key: name });
      
      // Listen for response
      const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === 'stateResponse' && message.key === name) {
          window.removeEventListener('message', handler);
          resolve(message.value);
        }
      };
      window.addEventListener('message', handler);
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    vscode.postMessage({ command: 'setState', key: name, value });
  },
  removeItem: async (name: string): Promise<void> => {
    vscode.postMessage({ command: 'setState', key: name, value: undefined });
  },
};

// Zustand store with VS Code storage
const useConversationStore = create(
  persist(
    (set) => ({
      conversations: [],
      addConversation: (conv) => set((state) => ({ 
        conversations: [...state.conversations, conv] 
      })),
    }),
    {
      name: 'forgeai-conversations',
      storage: vscodeStorage, // ✅ Uses VS Code storage!
    }
  )
);
```

**Conclusion:** VS Code storage APIs provide superior persistence compared to localStorage, with workspace isolation and optional sync capabilities.

---

## 7. Tab/Session Management Architecture

### Status: ⚠️ **No Native API - Custom Implementation Required**

VS Code does not provide a native API for tab management in webviews. Extensions must implement custom tab systems using state management and UI components.

### Existing Extension Patterns

- **Tab Stack extension:** Saves/restores tab layouts
- **Worktab extension:** Uses webview bridge pattern
- **Terminal Workspaces:** Visual sidebar interface

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│              ForgeAI Webview UI                         │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Tab Bar (Browser-like)                           │ │
│  │  [Conversation 1] [Conversation 2] [+]            │ │
│  │   └─ Active                                       │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Active Conversation View                         │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │ Messages                                    │ │ │
│  │  │ - User: "Fix this bug"                      │ │ │
│  │  │ - AI: "I'll analyze the code..."            │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │ Input Box                                   │ │ │
│  │  │ [Type your message...] [Send]               │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  State Management: Zustand                             │
│  ┌───────────────────────────────────────────────────┐ │
│  │ - tabs: Tab[]                                     │ │
│  │ - activeTabId: string                             │ │
│  │ - conversations: Map<tabId, Conversation[]>       │ │
│  │ - addTab()                                        │ │
│  │ - closeTab()                                      │ │
│  │ - switchTab()                                     │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Persistence: workspaceState                           │
│  - Per-workspace conversations                         │
│  - Tab state                                           │
│  - Active tab ID                                       │
└─────────────────────────────────────────────────────────┘
```

### Implementation Example

#### Tab Store with Zustand

```tsx
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Tab {
  id: string;
  title: string;
  conversationId: string;
  createdAt: number;
}

interface Conversation {
  id: string;
  messages: Message[];
  model: string;
}

interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  conversations: Record<string, Conversation>;
  
  // Tab actions
  addTab: () => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;
  
  // Conversation actions
  addMessage: (tabId: string, message: Message) => void;
  clearConversation: (tabId: string) => void;
}

const useTabStore = create<TabStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      conversations: {},
      
      addTab: () => {
        const newTab: Tab = {
          id: crypto.randomUUID(),
          title: 'New Conversation',
          conversationId: crypto.randomUUID(),
          createdAt: Date.now(),
        };
        
        set((state) => ({
          tabs: [...state.tabs, newTab],
          activeTabId: newTab.id,
          conversations: {
            ...state.conversations,
            [newTab.conversationId]: {
              id: newTab.conversationId,
              messages: [],
              model: 'qwen3-coder-397b',
            },
          },
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
      
      updateTabTitle: (tabId, title) => {
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, title } : t
          ),
        }));
      },
      
      addMessage: (tabId, message) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        
        set((state) => ({
          conversations: {
            ...state.conversations,
            [tab.conversationId]: {
              ...state.conversations[tab.conversationId],
              messages: [
                ...state.conversations[tab.conversationId].messages,
                message,
              ],
            },
          },
        }));
      },
      
      clearConversation: (tabId) => {
        const state = get();
        const tab = state.tabs.find((t) => t.id === tabId);
        if (!tab) return;
        
        set((state) => ({
          conversations: {
            ...state.conversations,
            [tab.conversationId]: {
              ...state.conversations[tab.conversationId],
              messages: [],
            },
          },
        }));
      },
    }),
    {
      name: 'forgeai-tabs',
      storage: vscodeStorage, // Custom VS Code storage adapter
    }
  )
);
```

#### Tab Bar Component

```tsx
function TabBar() {
  const tabs = useTabStore((state) => state.tabs);
  const activeTabId = useTabStore((state) => state.activeTabId);
  const switchTab = useTabStore((state) => state.switchTab);
  const closeTab = useTabStore((state) => state.closeTab);
  const addTab = useTabStore((state) => state.addTab);

  return (
    <div className="flex items-center gap-1 bg-(--vscode-editorGroupHeader-tabsBackground) border-b border-(--vscode-editorGroupHeader-tabsBorder)">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`
            flex items-center gap-2 px-3 py-2 cursor-pointer
            ${tab.id === activeTabId 
              ? 'bg-(--vscode-tab-activeBackground) text-(--vscode-tab-activeForeground)' 
              : 'bg-(--vscode-tab-inactiveBackground) text-(--vscode-tab-inactiveForeground) hover:bg-(--vscode-tab-hoverBackground)'
            }
          `}
          onClick={() => switchTab(tab.id)}
        >
          <span className="text-sm">{tab.title}</span>
          <button
            className="hover:bg-(--vscode-toolbar-hoverBackground) rounded p-1"
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="px-3 py-2 hover:bg-(--vscode-toolbar-hoverBackground)"
        onClick={addTab}
      >
        +
      </button>
    </div>
  );
}
```

**Conclusion:** Custom tab management is required but straightforward with Zustand and VS Code storage.

---

## Recommended Architecture

### Final Stack Decision

**✅ Recommended Stack:**
- **UI Framework:** React 19
- **Styling:** Tailwind CSS v4.0 + VS Code CSS Variables
- **State Management:** Zustand v5
- **Persistence:** VS Code `workspaceState`/`globalState` APIs
- **Total Bundle Size:** ~96KB gzipped

### Key Decision Points

#### 1. Tailwind CSS v4 + VS Code CSS Variables ✅ **RECOMMENDED**

**Why:**
- Full design flexibility
- Can access ALL VS Code theme variables
- Modern developer experience with v4's improvements
- Automatic theme adaptation
- Best of both worlds

**Example:**
```tsx
<div className="bg-(--vscode-editor-background) text-(--vscode-editor-foreground)">
  <button className="bg-(--vscode-button-background) hover:bg-(--vscode-button-hoverBackground)">
    Click me
  </button>
</div>
```

#### 2. Zustand v5 for State Management ✅ **RECOMMENDED**

**Why:**
- Lightweight (1KB)
- Simple API
- Easy VS Code storage integration
- DevTools support
- Perfect for extensions

#### 3. VS Code Storage > localStorage ✅ **ALWAYS**

**Why:**
- ✅ Persists across VS Code restarts
- ✅ Syncs across machines (with `setKeysForSync`)
- ✅ Workspace-specific storage
- ✅ Encrypted secrets storage
- ✅ Better UX (users expect VS Code to remember state)

**Never use localStorage in VS Code extensions!**

#### 4. Custom Tab Management ✅ **REQUIRED**

**Why:**
- No native API available
- Need browser-like tabs for conversations
- Per-workspace session management
- Zustand + `workspaceState` = perfect solution

### Technology Summary Table

| Technology | Version | Status | Use For | Bundle Size |
|------------|---------|--------|---------|-------------|
| React | 19 | ✅ Latest | UI framework | ~45KB |
| Tailwind CSS | 4.0 | ✅ Latest | Styling + VS Code themes | ~50KB |
| Zustand | 5.x | ✅ Latest | State management | ~1KB |
| VS Code Storage | Native | ✅ Stable | Persistence | 0KB |
| VS Code Themes | Native | ✅ Stable | Theme variables | 0KB |
| Webview UI Toolkit | Deprecated | ❌ Avoid | Components | N/A |

**Total Bundle Size:** ~96KB gzipped (very reasonable!)

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- Set up React 19 + TypeScript project
- Configure Tailwind CSS v4.0 with VS Code CSS variables
- Create VS Code extension boilerplate
- Implement webview communication bridge

### Phase 2: State Management (Week 3)
- Set up Zustand v5 stores
- Implement VS Code storage adapters
- Create persistence middleware
- Test workspace isolation

### Phase 3: Tab System (Week 4)
- Build tab bar component
- Implement tab state management
- Add conversation routing
- Test tab persistence

### Phase 4: UI Components (Week 5-6)
- Build custom components with Tailwind + VS Code themes
- Implement message list
- Create input component
- Add loading states

### Phase 5: Integration (Week 7-8)
- Connect to Ollama backend
- Implement chat functionality
- Add multi-agent orchestration
- Test end-to-end workflows

### Phase 6: Polish (Week 9-10)
- Performance optimization
- Accessibility testing
- Theme testing (dark/light/high-contrast)
- Documentation

---

## Additional Resources

### Official Documentation
- [React 19 Documentation](https://react.dev)
- [Tailwind CSS v4.0 Blog](https://tailwindcss.com/blog/tailwindcss-v4)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [VS Code Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Extension Capabilities](https://code.visualstudio.com/api/extension-capabilities/common-capabilities)

### Community Resources
- [GitHub Next - React Webview UI Toolkit (Deprecated)](https://githubnext.com/projects/react-webview-ui-toolkit)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [Tailwind CSS v4 Migration Guide](https://tailwindcss.com/docs/v4-beta)

---

**Research Completed:** May 3, 2026  
**Next Steps:** Begin Phase 1 implementation with React 19 + Tailwind CSS v4.0 setup
