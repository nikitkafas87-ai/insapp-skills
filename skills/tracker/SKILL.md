---
name: tracker
description: "Use when working with Yandex Tracker issues: create INS bugs or tasks, update issue fields, add comments or worklogs, search issues, prepare standardized bug reports, or publish QA results to Tracker. Applies to requests like 'заведи баг', 'создай задачу', 'добавь комментарий', 'залоги время', 'найди задачу', 'опубликуй в Трекер', 'напиши баг-репорт', or 'оформи отчет в задачу'."
---

# Tracker

Use this skill for Yandex Tracker work through the `tracker` MCP server, usually `mcp__tracker__...` tools after Codex reloads MCP configuration.

## Required MCP

Expected Codex config:

```toml
[mcp_servers.tracker]
command = "C:\\Users\\nikit\\.local\\bin\\uvx.exe"
args = ["--python", "3.12", "yandex-tracker-mcp@latest"]
```

Required environment variables:

- `TRACKER_TOKEN`
- `TRACKER_ORG_ID` or `TRACKER_CLOUD_ORG_ID`

If Tracker MCP is unavailable, do not pretend MCP was used. Use the available approved fallback only when the local task context already provides it; otherwise prepare the exact issue/comment/worklog payload and say that publishing is blocked until Tracker access is connected.

## Core Rules

- Use Russian unless the target issue already uses another language.
- Before any Yandex Tracker write operation, ask the user for explicit permission. This includes adding/updating/deleting comments, publishing testing reports or bug reports into issues, creating/updating issues, adding worklogs, changing statuses/transitions, and summoning/calling/inviting users or mailing lists. Read-only issue/comment/checklist/attachment/transition lookup is allowed without asking. If the user asks for report or bug text "сюда", return it in chat only and do not publish it unless the user separately confirms.
- Do not summon developers in comments unless the user explicitly asks to call, summon, or invite someone.
- Do not include application numbers like `#5940433` in bug reports. Use only full `ApplicationId` GUID values.
- Do not include `ApplicationId` in frontend bug reports. Use `ApplicationId` only for backend/API/DB/log/calculation/state bugs where the specific application is needed for investigation.
- In Tracker testing and retest report comments, do not mention the task number/key in the report text or heading unless the user explicitly asks.
- Use only these report headings:
  - `**Тестирование ДЭВ**` for DEV testing reports.
  - `**Тестирование ПРОД**` for production testing reports.
  - `**Ретест багов ДЭВ**` for DEV bug retest reports.
  - `**Ретест багов ПРОД**` for production bug retest reports.
- Every Tracker testing/retest report must include the exact session journal path so future sessions can recover context without searching the project. Add a concise line such as `**Журнал сессии:** \`journals/YYYY-MM-DD-short-task-name/log.md\``. If DEV and PROD are published as separate comments, include the relevant journal line in each comment. If no journal exists yet, create one before publishing the report.
- In testing and retest reports, color the final check result and status lines with YFM color markup: use `{green}(...)` for passed/fixed checks and `{red}(...)` for failed/blocking checks. Example: `{green}(3/3 бага перепроверены, все три исправлены.)` and `{green}(PASS)`.
- When a testing/retest report verifies API requests or API responses, include every checked request/response as a fenced code block inside its own YFM cut block. If both request and response are shown, put them in separate fenced code blocks and separate cut blocks, not in one combined JSON object. Put a blank line after `{% cut "..." %}` and before `{% endcut %}` so Tracker renders the code inside the cut. A summary table alone is not enough for API checks. Use the exact endpoint, relevant request body, response body, full `ApiKey` values, and full GUIDs; mask only tokens, passwords, private credentials, or personal data that is not needed for the evidence. Always use the repeated scenario structure from INS-2923 for API request/response evidence: scenario title, full `applicationId`, then one request cut and one response cut for that exact scenario before moving to the next scenario. Do not collect all requests or all responses in one shared section. If there are more than two API examples/scenarios in one report, add visual separators between scenarios.
- For frontend task testing reports, always attach current screenshots/photos to the Tracker report. Frontend tasks include visible UI, landing pages, widgets, dashboards, layout, navigation, validation display, browser behavior, or any task marked `ФРОНТ`. The report is not complete without at least one relevant screenshot attached inline or as an issue attachment; if upload is blocked, say that explicitly instead of silently publishing a screenshotless report.
- Screenshots in Tracker reports must be placed inside YFM cut blocks. Do not leave report screenshots as bare inline images outside `{% cut "..." %}` / `{% endcut %}`.
- Correct Tracker screenshot format inside a cut requires blank lines around the image and an explicit size suffix. Use:
  `{% cut "Скриншот" %}`
  blank line
  `![image.png](/ajax/v2/attachments/<attachment_id>?inline=true =1365x934)`
  blank line
  `{% endcut %}`
  Do not publish compact one-line cut/image/endcut blocks and do not omit the ` =WIDTHxHEIGHT` part, because Tracker may leave the screenshot outside the cut or fail to render it inline.
- Report screenshots must visibly show the checked data or UI state. If the relevant fields/values are cut off, hidden below the fold, too small, or not readable, retake the screenshot with a different browser zoom, viewport size, scroll position, or crop before publishing.
- Place each screenshot next to the exact report scenario/retest point it proves. Do not collect screenshots at the end of the whole report unless the screenshot covers the entire report as a whole.
- Write URLs as clickable links or plain URLs, not as inline code. For long URLs, prefer a Markdown link with a short label.
- When testing a Tracker task, always read its checklist if one exists, use it as the primary test coverage map, and close checklist items sequentially after each item is actually verified. Do not leave verified checklist items unchecked unless the user explicitly asks not to update the checklist or Tracker does not provide a checklist update tool.
- For writes, verify by reading the issue/comment/worklog back after creation or update.
- Before changing an existing issue, read it first and use the current issue key/version/context.
- For status transitions, first read available transitions; never invent transition ids.
- For queue-specific fields, read queue metadata/fields when available before setting custom fields.
- When creating INS issues, automatically set Никита Русанов (`rusanov`, id `8000000000000082`) as QA engineer and watcher/follower unless the user explicitly requests another QA owner.
- When creating issues, set the current/latest sprint, meaningful tags, project, and related task/parent whenever they can be inferred from the prompt, current investigation, or a referenced parent issue.

## Issue Title Environment

When creating or updating Tracker issue summaries, use only real environment suffixes:

- `— ДЭВ` for development/dev-stand work.
- `— ПРОД` for production work.

Do not use `— ТЕСТ` as the environment suffix in Tracker issue summaries.

## Task Acceptance Checklists

When creating or updating Tracker development tasks, put verifiable checks and acceptance criteria into Tracker checklist items, not into the issue description. The description should say what needs to be implemented; checks belong in the checklist.

## Bug Title Format

For Tracker issue summaries, use:

```text
ПРОДУКТ | Краткое описание бага (БЭК|ФРОНТ) — СРЕДА
```

Examples:

```text
КАСКО | Не передается MaritalStatusId у водителя (БЭК) — ДЭВ
ОСАГО | Бейдж "Ваша СК" не отображается на оффере (ФРОНТ) — ПРОД
АРМ | Не сохраняется настройка СК/Вендоры (БЭК) — ДЭВ
```

Use `БЭК` for API, DB, request/response, calculation, integration, or backend state. Use `ФРОНТ` for visible UI, layout, navigation, validation display, or client-side behavior.

## Two Bug Output Modes

Keep bug text for comments separate from full Tracker bug tasks.

- If the user asks "скинь текст бага", "напиши баг сюда текстом", "дай текст бага", or otherwise asks only for bug text, do not create or update Tracker. Return a compact comment-style bug report like the bugs in `INS-3095`.
- If the user explicitly asks to "завести баг", "создать баг", "создай задачу", "запушить в Tracker", or mentions using the `$tracker` skill for creation, use the MCP workflow to create/update/comment in Tracker and verify the write.
- For comment-style bug text inside an existing parent issue, continue `БАГ N` from the highest existing bug number in that issue.
- For standalone text not tied to an existing issue, use `**БАГ: ...**` without a number.
- For full Tracker issues, always use the `Bug Title Format` above for the issue summary.
- If adding the first and only bug comment in an issue, it may stay expanded without a cut.
- Once a second bug or later is added to the same issue, all bug reports in that issue must be wrapped in YFM cut blocks, even when bugs are posted as separate comments. Before publishing the new bug, update the earlier first bug comment and wrap it in a cut too. Follow the multi-bug style used in `INS-3155` comment `6a03322f6f4a50528e700030`.

## Bug Report Standard

Use this compact style for bug comments and bug descriptions. For plain bug text requested by the user, this must match the comment-style bugs from `INS-3095`.

```markdown
**БАГ N: Краткий заголовок (ФРОНТ|БЭК|БЭК+ФРОНТ) — СРЕДА**

**Среда:** СРЕДА (host or stand)
**Продукт:** ОСАГО | КАСКО | АРМ | ...
**Экран:** Раздел → Подраздел

**Суть:** Коротко описать проблему и почему это некорректно.

**Шаги воспроизведения:**
1. ...
2. ...
3. ...

**Ожидаемое:** Как должно работать.
**Фактическое:** Что происходит сейчас.

**Что исправить:** Короткое действие, которое нужно сделать.
```

### User-Preferred Compact Frontend Bug Text

When the user asks for bug text "сюда", "md", "коротко", says there is too much extra detail, or provides a target shape, prefer this lean frontend bug format over the fuller standard:

```markdown
**БАГ N: Краткий заголовок**

**Среда:** ДЭВ (host)
**Продукт:** ОСАГО / Настройки КВ
**Компонент:** ФРОНТ
**Экран:** Раздел → экран

**Ссылка:**
[Короткая подпись](https://...)

**Шаги воспроизведения:**
1. ...
2. ...
3. ...

**Фактический результат:**
В интерфейсе:
- ...
- ...
- ...

**Ожидаемый результат:**
- ...
- ...
- ...
```

Rules for this compact frontend format:

- Do not add SQL, DB tables, API payloads, response JSON, GUID evidence, cleanup notes, or investigative commentary unless the user explicitly asks for proof/details.
- Keep the bug framed as a frontend issue: what the user sees, what UI controls are shown/hidden/enabled/disabled, and what state remains stale.
- For links, use a short Markdown label such as `[Настройки КВ](https://...)`.
- Keep metadata concise. It is acceptable to omit `Суть` and the final `Что исправить` line in this compact mode.
- Put `Ожидаемый результат` after `Фактический результат` if the user-provided format uses that order; otherwise follow the fuller standard.

### Numbering

- If adding several bug comments to one issue, number them as `БАГ 1`, `БАГ 2`, etc.
- If existing comments already contain `БАГ N`, continue from the highest existing number.
- If adding a single standalone bug report and no numbering exists, use `**БАГ: ...**` without `N`.
- If adding multiple bugs in one comment, put each numbered bug into a separate cut: `{% cut "**БАГ N: ...**" %}` ... `{% endcut %}`. Do not leave several full bug reports expanded in one comment.
- If adding `БАГ 2` or higher as a new separate comment and `БАГ 1` is already present without a cut, update `БАГ 1` first and wrap it in a cut. Then publish the new bug comment in its own cut.

### Required Content

- Always include `Среда`, `Продукт`, `Экран`, `Суть`, `Ожидаемое`, and `Фактическое`.
- Include `Шаги воспроизведения` when the bug is reproducible through UI/API actions.
- Put concrete values in the text: field names, endpoint names, DB columns, enum values, status names, and full GUIDs when relevant.
- For frontend/UI bugs, do not add `ApplicationId` just because it appears in the URL. Keep it only if the defect requires backend/API/log investigation.
- Keep `Ожидаемое` before `Фактическое`.
- For open bug reports, do not use green YFM markup or a checkmark for the requested fix. Green/checkmark formatting reads as "already fixed" and is reserved for testing/retest reports where a check actually passed.
- When a short fix request helps, end with a neutral line: `**Что исправить:** ...`.

### Optional Technical Details

Use extra sections only when they materially help reproduce or fix the bug:

```markdown
**Проверка:** ...
**Пример запроса:** ...
**БД:** ...
**Воспроизводится при:** ...
```

In Tracker reports, every SQL script must be wrapped in a YFM cut block. Do not leave SQL scripts expanded in the report body.

For backend task testing/retest reports, always include the SQL scripts used to verify application state and logs. Put each script in its own YFM cut block with a fenced `sql` code block, for example `{% cut "SQL — проверка заявок" %}` and `{% cut "SQL — проверка логов" %}`.

In Tracker reports for API checks, every request/response code block used as evidence must also be wrapped in a YFM cut block. Do not leave API payloads expanded in the report body.

For large JSON, logs, or long tables, also wrap details in Tracker cut blocks:

````markdown
{% cut "SQL — проверка" %}
```sql
SELECT ...
```
{% endcut %}
````

````markdown
{% cut "API — запрос /app/SendOsagoApplication" %}

```json
{
  "applicationId": "08deb4e2-844e-8489-25c3-3e33d80b41ff",
  "apiKey": "API_KEY_PLACEHOLDER"
}
```

{% endcut %}

{% cut "API — ответ /app/SendOsagoApplication" %}

```json
{
  "value": null,
  "result": false,
  "error": {
    "type": "ApplicationAPI.RequestValidation",
    "fields": [
      {
        "name": "CarData.LicensePlate",
        "message": "Номер должен быть заполнен, если тип документа ТС - Свидетельство о регистрации ТС"
      }
    ]
  }
}
```

{% endcut %}
````

### Style Rules

- Prefer `Суть` over long `Описание`.
- Do not add `Связанная задача` when posting inside that same issue.
- Do not add a separate date line unless the date is important to the evidence.
- Write links as links, not as code: use `https://...` as plain text or `[label](https://...)`; do not wrap URLs in backticks.
- Do not write vague confirmations like "все корректно"; use observed values.
- Keep the report compact. If a table is needed, keep it focused and do not hide the main defect in prose.
- Never shorten GUIDs in comments, descriptions, SQL notes, or final answers.

## Common MCP Tools

Read-only:

- `users_search(login_or_email_or_name)`
- `user_get(user_id)`
- `user_get_current()`
- `issues_find(query, include_description=false, fields=null, page=1, per_page=100)`
- `issues_count(query)`
- `issue_get(issue_id, include_description=true)`
- `issue_get_comments(issue_id)`
- `issue_get_attachments(issue_id)`
- `issue_get_worklogs(issue_ids)`

Writes:

- `issue_create(queue, summary, type, description, assignee, priority, fields)`
- `issue_update(issue_id, summary, description, parent, tags, version, fields)`
- `issue_add_comment(issue_id, text, summonees=null, markup_type="md")`
- `issue_add_worklog(issue_id, duration="PT1H30M", comment, start)`
- `issue_update_worklog(issue_id, worklog_id, duration, comment, start)`
- `issue_execute_transition(issue_id, transition_id, comment, fields)`

Attachment tools from local `tracker-attachments` MCP server after Codex restart:

- `issue_add_attachment(issue_id, file_path, filename=null)` uploads a local file to an issue and returns inline markdown.
- `issue_add_comment_with_inline_attachment(issue_id, file_path, text="", filename=null, cut_title="Скриншот", width=null, height=null)` uploads a local file and creates a comment with the image displayed inline.
- `issue_update_comment_append_inline_attachment(issue_id, comment_id, current_text, file_path, filename=null, cut_title="Скриншот", width=null, height=null)` uploads a local file and appends an inline image to an existing comment. First read the comment and pass its full current text.

For Tracker inline images, use YFM syntax like `![image.png](/ajax/v2/attachments/<attachment_id>?inline=true =1365x934)`. Inside cut blocks, put a blank line before and after the image.

## Workflows

### Publish Frontend Testing Report

Use this workflow whenever publishing a Tracker testing report for a frontend/UI task.

1. Read the issue and comments first.
2. Capture or collect current screenshots/photos that prove the checked frontend state:
   - for PASS reports, include at least one representative screenshot of the working UI;
   - for FAIL/bug reports, include screenshots of each distinct visible defect when practical;
   - for multi-landing or multi-screen checks, include enough screenshots to make the coverage clear, grouping them in cut blocks if there are several.
3. Save screenshots in the task journal directory with descriptive names.
4. Include the task journal path in the report text, for example `**Журнал сессии:** \`journals/2026-05-26-ins-3495-check/log.md\``.
5. Add the report comment with screenshots inline:
   - prefer `tracker-attachments` MCP tools when available;
   - otherwise upload the file through Tracker API and insert YFM inline image syntax manually;
   - use a cut block such as `{% cut "Скриншоты" %}` for large or multiple images.
6. Verify the write by reading the comment back and checking that both the journal path and inline attachment markdown or attachment id are present.
7. If screenshots cannot be captured or uploaded, do not present the Tracker report as complete. State the blocker and what evidence is missing.

### Prepare Bug Text Only

1. Do not create or update Tracker.
2. If the target parent issue is known and numbering matters, read the issue comments and continue from the highest existing `БАГ N`.
3. Prepare only the markdown bug text using the bug report standard.
4. Keep frontend bugs free of `ApplicationId` unless the defect specifically requires backend/API/log investigation.
5. Return the markdown text directly to the user.

### Create Bug

1. Confirm queue; default to `INS` only when local task context clearly uses INS.
2. Build the issue summary using the required title format.
3. Build the description using the bug report standard.
4. If Tracker MCP is available:
   - read queue fields/metadata when setting custom fields, project, sprint, or QA fields;
   - if a parent or related issue is mentioned (for example `INS-3327`), read it first and copy relevant context: sprint, project, assignee/product area, tags, and whether the new issue should be a child/related issue;
   - create the issue;
   - immediately update the created issue when needed to set: `qaEngineer = rusanov`, `followers = ["rusanov"]`, current/latest sprint, meaningful tags, project, and parent/related issue;
   - add a bug-specific checklist to the created issue before returning it to the user. The checklist must cover the concrete retest points for this bug, not a generic QA template. Include at least:
     - the original reproduction path now returns the expected result;
     - the previously broken API/UI state is no longer reproduced;
     - the negative/boundary condition from the bug evidence is handled correctly when relevant;
     - adjacent happy path/regression checks that could be affected by the fix.
   - prefer local `tracker-attachments` MCP checklist tools when available: `issue_get_checklist`, `issue_add_checklist_item`, `issue_update_checklist_item`, `issue_delete_checklist_item`;
   - if the available Tracker MCP tools cannot update checklist items, use the Tracker REST API with the configured Tracker token/org as fallback, then verify the checklist by reading the issue/checklist back;
   - verify the final state with `issue_get`, not just the initial create response.
5. Return the issue key/link and mention verification.

### Automatic Issue Metadata

Apply this for newly created bugs/tasks unless the user explicitly asks otherwise:

- **QA engineer:** set Никита Русанов (`rusanov`, id `8000000000000082`) in `qaEngineer`.
- **Watcher/follower:** add Никита Русанов (`rusanov`) to followers.
- **Sprint:** use the current/latest sprint. Prefer copying the sprint from the referenced parent/related task; otherwise discover the latest active sprint from relevant INS issues or queue context. For the INS-3327 rollout context, use sprint `87` / `Спринт 26.6` while it remains current.
- **Project:** set a project when it is clear from the parent issue or product/context. Prefer copying the parent issue project. For KASKO/OSAGO+KASKO work where no more specific project is available, use project `34` / `еОСАГО+КАСКО (с КЦ) - core`, verified from similar INS issues. Do not invent a project when no reliable source is available.
- **Tags:** add concise, meaningful tags from product, platform, partner, component, and defect type, for example `КАСКО`, `лендинги`, `ФРОНТ`, partner name, endpoint name, or feature area. Do not add noisy one-off tags.
- **Related tasks:** when a parent or related Tracker issue is present in the prompt/context, attach it. Use `parent` for child bugs under a rollout/task when appropriate; if only a loose relation is intended and the available MCP tools cannot create that link type, reference the related issue in the description/comment and state that the direct relation could not be attached by the available tool.

### Add Bug Comment

1. Read the issue first.
2. Read existing comments when numbering may matter.
3. Prepare a concise markdown comment using the bug report standard.
4. Do not pass `summonees` unless explicitly requested.
5. Add the comment.
6. Verify by reading the comment list or the comment by id.

### Add Regular Comment

1. Read the issue first.
2. Prepare a concise markdown comment.
3. Do not pass `summonees` unless explicitly requested.
4. Add the comment.
5. Verify by reading the comment back.

### Add Worklog

1. Read the issue first.
2. Convert duration to ISO-8601, for example `PT45M`, `PT1H`, `PT1H30M`.
3. Use an explicit `start` datetime when the user gives a date; otherwise ask only if the date matters.
4. Add the worklog.
5. Verify with worklog readback.

### Search Issues

Use Tracker query syntax. Prefer narrow queries:

```text
Queue: INS AND Updated: >= "2026-05-01" AND Assignee: "login"
```

For broad searches, page results and keep only needed fields to avoid noisy output.
