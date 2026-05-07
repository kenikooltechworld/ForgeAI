# How to See Token Usage - Quick Guide

## Step-by-Step Instructions

### 1. Rebuild the Extension ✅ (Already Done)

The extension has been rebuilt with enhanced logging.

### 2. Launch Extension Development Host

Press `F5` in VS Code to launch the Extension Development Host.

### 3. Open ForgeAI

Click the ForgeAI icon in the activity bar (left sidebar).

### 4. Send a Message

Type any message and press Enter. For example: "Hello, how are you?"

### 5. **IMPORTANT: Expand the Thinking Block**

This is the most common issue - token usage **ONLY shows when the thinking block is expanded**.

1. Look for the thinking block with 🧠 icon
2. Click the **"Expand ▼"** button
3. Token usage will appear at the bottom in small gray text

### 6. What You Should See

When expanded, at the bottom of the thinking block:

```
Thinking tokens: 70 | Total: 142
```

---

## Troubleshooting

### "I don't see any thinking block"

- Make sure the AI is using thinking mode (`think: true`)
- Check if the model supports thinking (gpt-oss:120b-cloud should)

### "I see the thinking block but no token usage"

**Check Backend Logs:**

1. Open VS Code Output panel: `Ctrl+Shift+U` (Windows) or `Cmd+Shift+U` (Mac)
2. Select "ForgeAI" from the dropdown
3. Look for these emoji markers:
   - ✅✅✅ CAPTURED PROMPT TOKENS
   - ✅✅✅ CAPTURED COMPLETION TOKENS
   - 🏁🏁🏁 STREAM COMPLETED
   - 📊📊📊 SENDING TOKEN USAGE TO WEBVIEW
   - 🌐🌐🌐 POSTING TOKEN USAGE TO WEBVIEW

**Check Frontend Logs:**

1. Open Browser DevTools: `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac)
2. Go to Console tab
3. Look for: "✅✅✅ Token usage received in FINAL chunk"

### "I see backend logs but not frontend logs"

This means the token usage is being captured but not reaching the UI. Check:

- Is the thinking block **expanded**? (Token usage only shows when expanded)
- Are there any errors in the browser console?

### "I don't see any token logs at all"

This means Ollama is not returning token counts. Possible causes:

- The model `gpt-oss:120b-cloud` doesn't support token counts
- Ollama version is too old
- Try a different model: `ollama run qwen3-coder:30b`

---

## Expected Log Flow

When everything works correctly, you should see this sequence:

**Backend (VS Code Output → ForgeAI):**

```
✅✅✅ CAPTURED PROMPT TOKENS: 72
✅✅✅ CAPTURED COMPLETION TOKENS: 70
🏁🏁🏁 STREAM COMPLETED. Token usage object: {"promptTokens":72,"completionTokens":70,"totalTokens":142}
📊📊📊 SENDING TOKEN USAGE TO WEBVIEW: {"promptTokens":72,"completionTokens":70,"totalTokens":142}
🌐🌐🌐 POSTING TOKEN USAGE TO WEBVIEW: {"promptTokens":72,"completionTokens":70,"totalTokens":142}
```

**Frontend (Browser DevTools Console):**

```
✅✅✅ Token usage received in FINAL chunk: {thinkingTokens: 70, totalTokens: 142}
```

**UI (Expanded Thinking Block):**

```
Thinking tokens: 70 | Total: 142
```

---

## Quick Test

Run this test script to verify Ollama is returning token counts:

```bash
node test-token-usage.js
```

Look for:

```
✅ TOKEN COUNTS FOUND!
prompt_eval_count: 72
eval_count: 70
```

If you see "❌ NO" then the issue is with Ollama/model, not the extension.

---

## Still Not Working?

Share the following information:

1. **Backend logs** (from VS Code Output → ForgeAI)
2. **Frontend logs** (from Browser DevTools Console)
3. **Test script output** (from `node test-token-usage.js`)
4. **Screenshot** of the expanded thinking block

This will help identify exactly where the issue is in the pipeline.
