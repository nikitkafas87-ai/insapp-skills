---
name: tracker-report-active
description: Use when preparing active-work reports, timesheet summaries, today's work-time statistics, or Tracker worklog plans from local session journals and Yandex Tracker. Applies to requests like "отчет активных задач", "таймшит", "что я делал", "чем был занят сегодня", "сколько времени сегодня", "заполни время", "отчет по Трекеру", and "залогированное время за период".
---

# Tracker Report Active

Use this skill to build a work report or timesheet from local project journals and Yandex Tracker. For today's activity and work-time questions, local `journals/` are the primary source.

## Modes

### Journal-Day Mode

Use this mode when the request is without parameters or includes `сегодня`, `таймшит`, `что я делал`, `чем был занят`, `сколько времени`, `рабочее время`, or `заполни время`.

Goal:
- analyze today's local session journals;
- explain what the user worked on;
- estimate or calculate time by activity;
- optionally prepare Tracker worklogs, but never add them without explicit confirmation.

### Tracker Report Mode

Use this mode when the request names a person and period, or asks for active Tracker tasks, comments, or worklogs for a period.

Goal:
- resolve the person in Tracker;
- search updated issues for the period;
- collect comments and worklogs;
- summarize activity and logged time.

## Inputs

Required for Journal-Day Mode:
- Period. If omitted or said as `today`, use the user's local calendar date.

Optional for Journal-Day Mode:
- Project root. Default to the current workspace.
- Whether to include Tracker cross-checks.
- Whether to prepare worklog entries.

Required for Tracker Report Mode:
- Person: name, login, or email.
- Period: exact dates. If the user says today/yesterday/this week, convert to concrete dates in the user's timezone. If a person is provided but period is omitted, use the last 7 local calendar days.

Optional for Tracker Report Mode:
- Queue filter, usually `INS`.
- Output target: chat summary, Tracker comment, or worklog entries.
- Whether to include comments, worklogs, issue updates, follower/reviewer activity.

## Journal-Day Workflow

1. Convert the requested period to concrete local date boundaries and state them in the report.
2. Read `memory/MEMORY.md` when present, then read all matching journal files:
   - `journals/YYYY-MM-DD-*/log.md`;
   - include related files only when the journal references them as final reports, tracker comments, test cases, or exported summaries.
3. For each journal, extract:
   - folder name and `Goal` / task title;
   - `Initial context`;
   - `Actions`, `Progress`, `Results`, `Final state`, and blockers;
   - issue keys like `INS-1234`;
   - concrete IDs, URLs, DB names, report paths, commits, PRs, and verification results.
4. Prefer timestamped progress entries for time:
   - parse headings like `### HH:MM Шаг N: ...`;
   - time for a step is from its timestamp to the next timestamp in the same journal;
   - for the last timestamp in a journal, use the next same-day journal timestamp when it clearly continues the workday, otherwise mark duration as estimated/unknown;
   - do not invent exact time from untimestamped logs.
5. If journals do not have timestamps, estimate cautiously from evidence:
   - number of tool/API/DB checks;
   - complexity of SQL/UI/API testing;
   - amount of generated report text or artifacts;
   - explicit user interruptions, blockers, or final states.
6. Group activity by real work categories, not by raw journal order:
   - DB/API investigation;
   - UI testing;
   - report generation/publication;
   - Tracker/report writing;
   - skill or automation setup;
   - communication/coordination.
7. For each category or task, include source journal paths so the user can audit the summary.
8. Verify totals:
   - count journals read;
   - count journals with timestamps;
   - total calculated time;
   - total estimated/unknown time;
   - list gaps where exact duration cannot be recovered.

## Tracker Cross-Check Workflow

Use Tracker as a secondary source for Journal-Day Mode, or as the primary source in Tracker Report Mode.

1. Resolve the user:
   - call `users_search` for the provided name/login/email;
   - if there are old and new logins for the same person, include both.
2. Search issues updated during the period:
   - assignee = current login;
   - assignee = old login when known;
   - followers contains the user, when reviewer/QA activity matters;
   - optionally author/createdBy when the report should include created tasks.
3. For each candidate issue, collect only relevant fields:
   - key, summary, status, assignee, updatedAt, createdAt;
   - tags/components if present;
   - description only when needed.
4. Get comments and keep comments authored by the user during the period.
5. Get worklogs and keep worklogs authored by the user during the period.
6. Deduplicate issues by key.
7. Compare Tracker activity with journal activity:
   - journal evidence wins for "what I did today";
   - Tracker worklogs win for "already logged time";
   - if they conflict, show both and mark the discrepancy.
8. For Tracker Report Mode, also compute stale active tasks:
   - stale = issue in active/testing statuses and not updated for more than 7 days;
   - include stale count in the final summary when it is greater than 0.
9. If backlog or non-updated tasks are too many, do not print a long raw list; collapse them as `Backlog: N задач`.

If Tracker MCP is unavailable, continue with journal analysis and say that live Tracker cross-check is blocked.

## Tracker Task Matching Workflow

Use this workflow in Journal-Day Mode before preparing a worklog table. Its purpose is to map journal activity to real Tracker issues.

1. Build a journal activity list:
   - extract every explicit `INS-1234` from journal folder names, goals, actions, results, report paths, and comments;
   - keep activities without an issue key as `unmapped`;
   - keep a short evidence note for each row, such as tested area, DB/API checked, report published, or bug comment created.
2. Build a Tracker candidate list:
   - search issues updated during the period where the user is assignee;
   - search issues updated during the period where the user is follower/reviewer/QA participant;
   - search issues authored/created by the user when journals mention task creation;
   - include both old and new user logins when `users_search` returns multiple accounts.
3. Match journal rows to Tracker candidates:
   - exact `INS-1234` mention wins;
   - if no key is present, match by issue summary keywords, component, product, and journal evidence;
   - if multiple candidate issues fit, keep the row ambiguous and ask the user instead of guessing;
   - if no specific task exists, use `INS-2810` as the default dump/communication task with an explicit worklog comment that names the actual work.
4. Prefer specific task mapping over dump mapping:
   - if the user redirects time from a dump task to a specific task, update the queue exactly as requested;
   - never keep both the old dump row and the redirected row.
5. Check already logged time:
   - call `issue_get_worklogs` or the available worklog listing tool for each matched issue;
   - filter by author and period;
   - show existing worklogs separately so the new queue does not duplicate them.
6. Produce a proposed worklog queue before writing:

```markdown
## Предложение для логирования

| Задача | Время | Комментарий worklog | Источник |
|--------|-------|---------------------|----------|
| `INS-3092` | 3ч | Бэкенд-тестирование СК/Вендоры, сверка DB/API/UI | `journals/YYYY-MM-DD-name/log.md` |
| `INS-3318` | 1ч | КАСКО аудит и дебаг | пользователь заменил `INS-2810` -> `INS-3318` |

Уже залогировано за период:
- `INS-...` - Xч Yм

Нужно подтверждение перед записью.
```

If Tracker MCP is unavailable, still prepare the queue from journals, but mark it as `not written` and state that live matching/worklog verification is blocked.

## Query Patterns

Use Tracker query language, adapting dates and login:

```text
Queue: INS AND Updated: >= "YYYY-MM-DD" AND Updated: <= "YYYY-MM-DD" AND Assignee: "login"
Queue: INS AND Updated: >= "YYYY-MM-DD" AND Updated: <= "YYYY-MM-DD" AND Followers: "login"
Queue: INS AND Updated: >= "YYYY-MM-DD" AND Updated: <= "YYYY-MM-DD" AND Author: "login"
```

For user lookup:

```text
users_search("Фамилия Имя")
users_search("login")
```

## Tracker Report Shape

Use this shape when the user asks for a person/period Tracker report rather than today's journal timesheet:

```markdown
## Отчет по Tracker за YYYY-MM-DD - YYYY-MM-DD

### Залогированное время
- Всего: Xч Yм
- `INS-1234` - Xч Yм, комментарий.
```

If no matching worklogs are found, write:

```markdown
### Залогированное время
- Время не залогировано за период.
```

Then show active issues grouped by status:

```markdown
### Задачи: N

**В работе (N):**
- `INS-1234` - summary [updated YYYY-MM-DD]

**На тестировании (N):**
- `INS-2345` - summary [updated YYYY-MM-DD]

**Закрыто (N):**
- `INS-3456` - summary [updated YYYY-MM-DD]

**Прочие (N):**
- `INS-4567` - summary [updated YYYY-MM-DD]

---
Сотрудник: Name | Период: YYYY-MM-DD - YYYY-MM-DD | Задач: X | Закрыто: Y | Stale: Z | Часов: W
```

## Journal-Day Report Shape

Use this compact structure unless the user asks for another format:

```markdown
## Чем я был занят за YYYY-MM-DD

- Всего по журналам: Xч Yм calculated + ~Aч Bм estimated
- Журналов прочитано: N
- С точными timestamps: M

### По задачам
| Задача | Время | Что делалось | Источник |
|--------|-------|--------------|----------|
| `INS-1234` | 1ч 20м | Проверка API/DB, отчет | `journals/YYYY-MM-DD-name/log.md` |
| Без INS | ~40м | Настройка навыка | `journals/YYYY-MM-DD-name/log.md` |

### Итого по категориям
| Категория | Время | Состав |
|-----------|-------|--------|
| DB/API проверки | Xч Yм | `INS-...`, ... |

### Уже залогировано в Tracker
- Всего: Xч Yм
- `INS-1234` - Xч Yм, комментарий.
- Несопоставленная работа залогирована в `INS-2810` - Xч Yм, комментарий.

### Предложение для логирования
| Задача | Время | Комментарий worklog | Источник |
|--------|-------|---------------------|----------|
| `INS-1234` | 1ч 20м | Кратко что делалось | `journals/YYYY-MM-DD-name/log.md` |

### Гапы и допущения
- ...
```

When the user asks only "сколько и чем был занят", keep the answer focused on journals and do not require Tracker unless needed for logged-time verification.

## Worklog Planning Rules

- Do not add or edit worklogs without explicit user confirmation after the final proposed queue is shown.
- Before writing worklogs, show a proposed table and ask for confirmation.
- When the user explicitly asks to log unmapped work, log journal activity without a specific Tracker task to `INS-2810` with a concrete comment, and mention this mapping in the summary.
- Always ask how much time the user spent on communication, including dailies, syncs, calls, and coordination, when preparing a day report or worklog queue.
- When the user provides communication time, add it as a separate worklog to `INS-1844` with a concise comment such as `Коммуникации: дейлики, синки, координация`.
- Ask whether there were missing tasks not present in journals.
- If work has no separate Tracker issue, map it to `INS-2810` with a concrete comment and show that mapping in the summary.
- `issue_add_worklog` duration format must be ISO-8601: `PT30M`, `PT1H`, `PT1H30M`.
- `start` must be an exact datetime. If the user gives only a date, use a reasonable working-hour time and say what was used.
- Worklog comments must be concise and specific enough to identify what was done, for example `Бэкенд-тестирование СК/Вендоры, сверка DB/API/UI`.
- After any worklog write, verify with `issue_get_worklogs` and compare issue key, duration, author, start date, and comment.
- If one worklog write fails, stop, report which rows succeeded and which failed, and do not continue silently.
- A normal full workday total is usually around 7-8 hours; if the proposed total is far outside that range, warn and ask the user to confirm or correct it.
- Always ask the final confirmation after communication/missing-task corrections: `Подтверди итоговую таблицу, и я залогирую всё в трекер.`

## Worklog Push Workflow

Use this only after the user explicitly confirms the final table or gives direct instructions like `логируй`, `залогируй`, or `запушь время`.

1. Normalize each row:
   - issue key: full `INS-1234`;
   - duration: ISO-8601, such as `PT20M`, `PT30M`, `PT1H`, `PT1H30M`;
   - start: exact datetime for the work date;
   - comment: concise work summary.
2. Read or verify each target issue exists before writing when the tool is available.
3. Call `issue_add_worklog` for each confirmed row:

```text
issue_add_worklog(issue_id="INS-1234", duration="PT1H30M", comment="...", start="YYYY-MM-DDT10:00:00Z")
```

4. Verify every created worklog with `issue_get_worklogs`.
5. Return a compact result:

```markdown
Залогировано:
- `INS-3092` - 3ч
- `INS-3095` - 2ч
- `INS-3014` - 30м

Итого: 5ч 30м
```

If the user changes mapping during confirmation, such as `INS-2810 -> INS-3318`, update the queue first and then write only the updated rows.

## Publishing

When publishing to Tracker:

- Read the target issue first.
- Add one concise markdown comment.
- Do not pass `summonees` unless explicitly requested.
- Verify the comment appears with `issue_get_comments`.

## Critical Rules

- For today's time/activity reports, read `journals/YYYY-MM-DD-*/log.md` before Tracker.
- Do not use Tracker employee/team stats for period work analysis if those stats filter by created date instead of actual work/update date.
- Always preserve full GUIDs in reports and comments.
- If a report uses old journals instead of live Tracker/API data, say that explicitly.
