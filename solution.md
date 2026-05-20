Ah, look at that—I completely tripped over my own feet on this one. I completely spaced on our previous talks about **ForgeAI** being a VS Code _extension_, not a standalone fork. I subbed out your actual setup for a full IDE build in my head. That's entirely on me!

Now that my head is screwed on straight: You are building a **VS Code Extension**, you want that exact Kiro-style step wizard/custom toolbar workflow, but you are hitting the hard wall of VS Code's extension API layout restrictions.

Let's look at exactly how to pull off this illusion inside an extension without losing your mind over VS Code's API limits.

---

## The Hard Truth of the VS Code Extension API

You already know this, but to state it plainly so we are on the same page: **VS Code absolutely forbids extensions from injecting HTML/CSS/React into the native tab title bar or breadcrumbs area.** If you are writing a standard extension, you cannot touch that native top row. So, how do we hack around it to make ForgeAI look like Kiro?

You have two real, viable options to achieve this exact UI structure.

---

## Solution 1: The "Custom Editor" Illusion (Recommended)

This is the closest you can get to replicating the Kiro screenshot exactly within the bounds of a standard extension.

Instead of opening a `.md` file in the native text editor, you register a **Custom Text Editor** (`CustomTextEditorProvider`) in your extension. When a user opens a spec file, your extension intercepts it and renders a full-tab **Webview**.

Inside that Webview, you build the entire layout yourself from scratch:

```
+-------------------------------------------------------+
|  [1 Requirements] > [2 Design]        [Sync] [Cont.]  | <-- Your Custom HTML Titlebar (Tailwind)
+-------------------------------------------------------+
|                                                       |
|  1  # Requirements Document                           |
|  2                                                    | <-- Embedded Monaco Editor (Real code text)
|  3  This document defines...                          |
|                                                       |
+-------------------------------------------------------+

```

### How to implement it:

1. **The Header:** You write standard React/HTML + Tailwind CSS for the wizard row (`Requirements > Design > Task list` and the `Sync Files / Continue` buttons).
2. **The Editor Pane:** Directly below your custom header, you embed an instance of the **Monaco Editor** (using `@monaco-editor/react`) inside the webview.
3. **Data Syncing:** You pass the document's text from VS Code's extension context into the Webview. When the user types in your embedded Monaco editor, you post a message back to your extension backend to save the file:

```typescript
// Inside the Webview when text changes
vscode.postMessage({ type: 'TEXT_CHANGE', content: newText });
```

**Why this works:** To the user, it looks like you magically appended a custom toolbar to the top of their markdown file. In reality, the _entire tab_ is your custom UI, and you've just re-created a fully functional code editor pane underneath your toolbar.

---

## Solution 2: The Native Webview View + Editor Synchronization

If you don't want to embed a custom Monaco instance and instead want to use VS Code’s _actual, native_ text editor for the markdown file, you have to split the layout.

You can't put the wizard bar _above_ the code, but you can put it _beside_ or _below_ it using the **Webview View API** or an **Editor Webview Panel**.

1. **Open the File:** The markdown file opens in the native text editor.
2. **Open the Control Panel:** Your extension opens a Webview panel grouped either to the side or split directly above/below the editor tab (`ViewColumn.Two` or dragging it into a split pane).
3. **The Layout:** The webview holds your step wizard and buttons (`Sync Files`, `Continue`), while the native editor holds the code.

_The catch with Solution 2:_ It won't look unified like Kiro. It will look like two separate windows side-by-side or stacked, which breaks that clean, single-pane "wizard" aesthetic you are going for.

---

## Summary: Go with Solution 1

If your goal is to make a user say _"Wow, how did this extension put a step-by-step agent wizard directly inside my code tab?"_, **Solution 1** is your only choice. By using a Webview that contains both your custom header and an embedded Monaco editor, you bypass VS Code's layout limits completely by drawing the entire playing field yourself.

Does the Custom Editor + Embedded Monaco approach sound like something you can fit into ForgeAI's architecture?
