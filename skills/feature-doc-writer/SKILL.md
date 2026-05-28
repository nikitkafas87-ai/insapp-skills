---
name: feature-doc-writer
description: Write tester-facing Markdown/Wiki articles for product features based on completed QA work, Tracker tasks, comments, journals, test reports, screenshots, DB/API checks, and production verification. Use when asked to write, update, save, or prepare documentation/articles for a feature after testing, including requests like "напиши статью", "сделай доку", "по примеру wiki", "документация для тестировщиков", or "описать фичу по задаче/комментариям".
---

# Feature Doc Writer

## Workflow

1. Read local project rules first when available: `AGENTS.md`, relevant `memory/MEMORY.md`, and existing task journals.
2. If the task references Tracker, use the Tracker skill/workflow for read-only context: issue description, comments, checklist, attachments, linked issues when mentioned, and current status.
3. Create or update a task journal before doing multi-step documentation work. Record sources read, decisions, conflicts, output path, and final state.
4. Build a factual context map before writing:
   - feature purpose;
   - business/user flow;
   - actual scope and rollout;
   - environments/domains/partners where it works;
   - UI behavior;
   - API/DB behavior;
   - flags/statuses and what they affect;
   - tested positive and negative scenarios;
   - unresolved blockers, caveats, and known risks.
5. Resolve contradictions explicitly. If an early requirement differs from later comments or production retest, document the current verified behavior and mention the old wording only when it prevents mis-testing.
6. Write the article as a saved `.md` file unless the user explicitly asks for chat text only.
7. Verify the file exists and inspect key fragments or diff before final response.

## Source Priority

Use sources in this order when they disagree:

1. Current production behavior verified by QA.
2. Latest Tracker comments from product/dev/QA.
3. Tracker checklist and testing report.
4. Original task description.
5. Inferences from logs, DB, API, screenshots.

Clearly label inferences. Do not present an assumption as confirmed behavior.

## Article Structure

Use this structure by default and remove sections that do not apply:

```markdown
# <Feature Name>

## Зачем это нужно
<business/user purpose>

## Тикеты
| Тикет | Что |
|---|---|

## Область действия
<product, partner, domain, environment, rollout scope>

## Как работает общий процесс
1. ...

## Поведение в интерфейсе
<screens, statuses, buttons, forms, visibility rules>

## API
<endpoints, request/response contract, validation, who calls it>

## БД и флаги
<tables, key columns, flags, statuses, side effects>

## SQL для проверки
```sql
-- safe read-only queries with placeholders
```

## Что проверять тестировщику
<positive, negative, regression, edge cases>

## Матрица проверок
| № | Условие | Ожидаемый результат |
|---:|---|---|

## Особенности и риски
<known caveats, limitations, cross-feature interactions>

## Проверено на PROD/DEV
<only concrete verified scenarios>
```

For user-facing or management docs, omit API/DB/SQL unless asked. For tester docs, include technical details.

## Writing Rules

- Write in Russian when the user writes in Russian.
- Keep Markdown plain and pasteable into Wiki/Tracker.
- Save the full text to a `.md` file for long articles; do not rely only on chat output.
- Do not include real API keys, tokens, passwords, or secrets. Replace with placeholders like `API_KEY`.
- Never shorten GUIDs in docs, SQL notes, or reports.
- Use concrete statuses, field names, table names, endpoint names, and domain names when they matter.
- Use read-only SQL by default. For production DateTimeOffset filters, include timezone, usually `+03:00`.
- Do not add unverified domains, partners, tables, flags, or scenarios.
- Separate current behavior from planned/future work.
- If screenshots are referenced for Tracker/Wiki, use the project’s screenshot formatting rules when publishing; for a saved article, list screenshot names or leave placeholders only when actual images are not available.

## Tester-Focused Content Checklist

Before finalizing, ensure the article answers:

- Who can use the feature?
- Where is it available?
- What exact user flow triggers it?
- Which statuses/buttons/forms are involved?
- What backend/API call or DB state changes?
- Which flags affect UI behavior?
- What negative scenarios were checked?
- What data is needed for retest?
- What is out of scope?
- What risks or cross-feature interactions can hide the expected result?

## Final Response

Return a concise summary with:

- saved file path;
- journal path;
- main decisions or caveats, especially contradictions resolved from Tracker comments;
- note whether the article is ready for Wiki/Tracker publication or only saved locally.
