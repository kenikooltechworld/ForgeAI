# Bugfix Document: {SPEC_NAME}

## Introduction

{Description of the bug: what is broken, what the impact is, and why it needs to be fixed.}

---

## Bug Analysis

### Current Behavior

{Detailed description of what happens now — the incorrect/buggy behavior.}

### Expected Behavior

{Detailed description of what should happen instead.}

### Unchanged Behavior

{Explicitly state what should NOT change — parts of the system that must remain the same.}

---

## Root Cause

{Analysis of why the bug occurs.}

---

## Fix Strategy

### Approach

{High-level approach to fixing the bug.}

### Files to Modify

- `{filepath}` — {What to change}
- `{filepath}` — {What to change}

### Testing

- {How to verify the fix works}
- {Regression tests to prevent recurrence}

---

## Acceptance Criteria

1. WHEN {condition}, THE {system} SHALL {expected behavior}
2. THE {system} SHALL NOT {old buggy behavior}
3. WHEN {test condition}, THE {fix} SHALL {expected result}
