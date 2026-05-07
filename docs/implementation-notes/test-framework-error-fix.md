# Test Framework Error Handling Fix

**Date:** May 6, 2026  
**Issue:** AI was not intelligent enough to fix "expect is not defined" errors  
**Status:** ✅ Fixed

## Problem Identified

From the screenshots, the AI was encountering:

```
ReferenceError: expect is not defined
```

And the AI was:

1. Running tests repeatedly (10+ times)
2. Hitting the 20-iteration limit in AgentLoop
3. NOT fixing the root cause (missing imports in test files)
4. Giving up with "Agent reached maximum iterations (20)"

## Root Cause

The error "expect is not defined" means:

- ✅ Test framework (vitest/jest) IS installed
- ❌ Test files are MISSING proper imports
- ❌ AI was treating this as a "missing dependency" error
- ❌ AI was trying to install packages instead of fixing imports

## Solution Implemented

Added a **specific error pattern** to the ERROR RECOVERY section in SystemPrompt.ts:

### New Error Pattern: "Test Framework Not Configured Error"

```
Error: "expect is not defined" or "describe is not defined" or "it is not defined"
→ ROOT CAUSE: Missing imports or setup in test files
→ ACTION:
  1. Read the test file to see what's missing
  2. Add proper imports at the top:
     - For vitest: import { describe, it, expect } from 'vitest';
     - For jest: No imports needed, but ensure jest.config.js exists
  3. Update the test file with correct imports
→ THEN: Retry running the tests
```

### Critical Instruction Added

```
CRITICAL: "expect is not defined" means the test file is missing imports,
NOT that vitest/jest is not installed. DO NOT just install packages -
FIX THE TEST FILE IMPORTS FIRST.
```

### Example Workflow Added

```
Error: ReferenceError: expect is not defined in src/App.test.tsx

Step 1: Read src/App.test.tsx
Step 2: Notice it's missing imports at the top
Step 3: Add this line at the top of the file:
   import { describe, it, expect } from 'vitest';
Step 4: Write the updated file
Step 5: Retry npm test
Result: Tests should run now
```

## How This Fixes the Problem

**Before:**

1. AI sees "expect is not defined"
2. AI thinks: "Missing dependency"
3. AI tries: npm install vitest (already installed)
4. AI retries: npm test (still fails)
5. Repeat 20 times → Give up

**After:**

1. AI sees "expect is not defined"
2. AI thinks: "Missing imports in test file"
3. AI reads: src/App.test.tsx
4. AI notices: No imports at top
5. AI adds: `import { describe, it, expect } from 'vitest';`
6. AI writes: Updated file
7. AI retries: npm test → SUCCESS ✅

## Expected Behavior Now

When the AI encounters "expect is not defined":

1. **Immediately recognize** it's a test file import issue
2. **Read the test file** to see what's missing
3. **Add the correct imports** at the top of the file
4. **Write the updated file**
5. **Retry the test** → Should pass now
6. **Report success** to user

## Testing the Fix

To test this fix:

1. Create a test file WITHOUT imports:

```typescript
// src/App.test.tsx (WRONG - missing imports)
describe('App', () => {
  it('should render', () => {
    expect(true).toBe(true);
  });
});
```

2. Ask AI to "run tests"

3. AI should:
   - See "expect is not defined" error
   - Read the test file
   - Add `import { describe, it, expect } from 'vitest';`
   - Write the updated file
   - Retry tests → SUCCESS

## Files Modified

- ✅ `src/extension/ollama/SystemPrompt.ts` - Added specific "Test Framework Not Configured Error" pattern

## Impact

- AI will now **immediately fix** "expect is not defined" errors
- AI will **not waste iterations** trying to install already-installed packages
- AI will **fix the root cause** (missing imports) on first attempt
- Users will see **faster error resolution** for test framework issues

## Additional Notes

This fix addresses the specific error pattern shown in the screenshots. The AI is now intelligent enough to:

1. **Distinguish between**:
   - Missing package (install it)
   - Missing imports (add them to file)
   - Missing configuration (create config file)

2. **Take the correct action** for each type of error

3. **Not waste iterations** on wrong solutions

The 20-iteration limit in AgentLoop is still in place, but the AI should now solve this type of error in 2-3 iterations instead of hitting the limit.
