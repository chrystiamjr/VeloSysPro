---
title: Environment-Aware Interactive Question Tools
keywords: ask_question, AskUserQuestion, AskUser, multi-select, recommendation, UI
---

# Environment-Aware Interactive Question Tools

## Overview
When soliciting design feedback, feature selection, or presenting multi-option choices to the user, ALWAYS use the environment's native interactive modal question tool instead of static markdown text lists.

## Native Tool Mapping
- **Antigravity / AGY**: `ask_question`
- **Claude Code**: `AskUserQuestion`
- **OpenAI Codex**: `AskUser`

## Formatting & Best Practices
1. **Recommendations**: Prefix primary recommendations with `(Recommended)` / `(Recomendado)`.
2. **Multi-Select**: Set `is_multi_select: true` when multiple options can apply simultaneously.
3. **No Duplicate Options**: Do not manually add an "Other" option or "Select all options that apply" text, as the native UI modal handles write-ins and multi-selection automatically.
