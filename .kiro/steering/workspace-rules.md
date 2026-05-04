---
inclusion: auto
---

# Workspace Rules - Critical Guidelines

## 🚨 NO JUNK FILES

**FORBIDDEN - Never create these files unless explicitly requested:**

- ❌ TESTING.md, TEST_GUIDE.md, TESTING_INSTRUCTIONS.md
- ❌ SUMMARY.md, ANALYSIS.md, REPORT.md
- ❌ FIX_GUIDE.md, TROUBLESHOOTING.md, DEBUG_GUIDE.md
- ❌ CHANGELOG.md, NOTES.md, TODO.md
- ❌ Any documentation files not part of the project structure

**ONLY create files that are:**

- ✅ Part of the spec (requirements.md, design.md, tasks.md)
- ✅ Source code files (_.ts, _.tsx, _.js, _.jsx)
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Essential project documentation (README.md in project root)
- ✅ Research documents (in docs/research/ when explicitly requested)

## 🚫 NEVER MAKE DECISIONS WITHOUT USER PERMISSION

**ALWAYS ask the user before:**

- Creating new files (except when implementing a task)
- Changing project structure
- Installing new dependencies
- Modifying configuration files
- Refactoring existing code
- Changing build processes
- Adding new features not in the spec

**Example - FORBIDDEN:**

```
❌ "I'll create a helper utility for this..."
❌ "Let me add a new dependency to solve this..."
❌ "I'll refactor this code to make it better..."
```

**Example - REQUIRED:**

```
✅ "I found an issue with X. Here are 3 solutions:
   1. Solution A (pros/cons)
   2. Solution B (pros/cons)
   3. Solution C (pros/cons)
   Which approach would you like me to use?"

✅ "To implement this, I need to install dependency X.
   Should I proceed?"

✅ "The current code has issue Y. I can fix it by doing Z.
   Should I make this change?"
```

## ❓ ALWAYS ASK FOR CLARIFICATION

**When you're not clear about:**

- Requirements or specifications
- Expected behavior
- Implementation approach
- File locations or naming
- Dependencies or tools to use
- Any ambiguity in the task

**DO NOT:**

- ❌ Guess what the user wants
- ❌ Make assumptions about requirements
- ❌ Implement features not explicitly requested
- ❌ Choose technologies without confirmation

**DO:**

- ✅ Ask specific questions
- ✅ Provide options with pros/cons
- ✅ Request clarification on ambiguous requirements
- ✅ Confirm understanding before implementing

## 🐛 AVOID CREATING CODE WITH BUGS

**Before writing code:**

1. Read requirements.md and design.md thoroughly
2. Read steering files (coding-standards.md, vscode-extension-patterns.md)
3. Understand the complete context
4. Verify the approach is correct

**After writing code:**

1. Run TypeScript compiler to check for errors
2. Use getDiagnostics tool to verify no issues
3. Verify code follows all steering file rules
4. Ensure code is production-ready (no placeholders, no TODOs)
5. Test the code if possible

**If you find a bug:**

- ❌ DON'T: Silently fix it and move on
- ✅ DO: Tell the user about the bug, explain the fix, and ask for confirmation

## ✅ PRODUCTION-READY CODE ONLY

**Every line of code must be:**

- ✅ Complete implementation (no placeholders)
- ✅ No TODO comments
- ✅ No mock data or fake implementations
- ✅ Follows OOP patterns (classes, not functions)
- ✅ Has proper error handling
- ✅ Has explicit return types
- ✅ Follows TypeScript strict mode
- ✅ Passes all diagnostics checks
- ✅ Follows all steering file rules

## 📋 PROBLEM REPORTING FORMAT

**When you encounter a problem, use this format:**

```
🚨 PROBLEM FOUND

Issue: [Clear description of the problem]

Impact: [What this affects]

Possible Solutions:
1. [Solution A]
   - Pros: ...
   - Cons: ...

2. [Solution B]
   - Pros: ...
   - Cons: ...

Recommendation: [Your recommended solution with reasoning]

Question: Which solution would you like me to implement?
```

## 🎯 SUMMARY

1. **NO junk files** - Only create files that are part of the project
2. **NO decisions without permission** - Always ask before making changes
3. **ALWAYS ask for clarification** - Never guess or assume
4. **AVOID bugs** - Verify code before and after writing
5. **Production-ready only** - No placeholders, no TODOs, no mock data
6. **Report problems clearly** - Provide solutions and ask for direction

---

**These rules are MANDATORY. Violations will result in rejected code.**
