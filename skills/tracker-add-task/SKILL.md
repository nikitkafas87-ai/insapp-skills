---
name: tracker-add-task
description: Use when creating one or more Yandex Tracker tasks, especially child tasks under an INS parent issue, from a user-provided checklist, QA plan, bug split, or implementation plan. Also applies to bulk task creation where every created issue must be verified.
metadata:
  short-description: Create Tracker tasks
---

# Tracker Add Task

Use this skill for creating Yandex Tracker tasks. It depends on the general `$tracker` skill rules for auth, field verification, comments, and no unrequested summonees.

## Inputs

- Queue: default `INS` only when the context clearly uses INS.
- Parent issue: optional but required for child-task batches.
- Task list: summaries and, when available, descriptions or acceptance criteria.
- Assignee, priority, tags/components: optional; infer only from explicit context or existing parent issue fields.

## Workflow

1. Read the parent issue first when a parent key is provided.
2. Normalize each task:
   - short Russian summary;
   - concise markdown description;
   - parent link when requested;
   - queue-specific fields only after reading queue metadata if available.
3. Before creating a bulk batch, prepare the final list and count.
4. If Tracker MCP tools are available, create tasks one by one and verify each returned key with `issue_get`.
5. If Tracker MCP is unavailable, prepare exact `issue_create` payloads and state that live creation is blocked.
6. Return a compact table: created key, summary, parent, verification status.

## Rules

- Do not create duplicate tasks if an identical existing child is found under the parent.
- Do not summon developers unless the user explicitly asks.
- Do not shorten GUIDs in descriptions or final reports.
- Do not claim creation succeeded without reading the created issue back.
- Put verifiable checks and acceptance criteria into Tracker checklist items, not into the issue description. The description should say what needs to be implemented.
