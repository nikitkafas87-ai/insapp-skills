---
name: osago-crosses-check
description: Use when checking OSAGO cross/upsale settings for active partner ApiKeys, generating an OSAGO crosses HTML report, validating connected/disabled crosses, or preparing SQL to enable/disable crosses. Uses active partners and active OSAGO ApiKeys discovered from production DB, not a user-provided key list.
metadata:
  short-description: Check OSAGO partner crosses
---

# OSAGO Crosses Check

Use this skill for audits of OSAGO crosses (upsales) by partner `ApiKey`: collect current DB settings, generate a readable HTML report, validate report sections, and prepare write SQL only when requested.

## Core Rules

- Source of truth for cross settings: `PartnerInsurerUpsaleSettings`.
- Include only active partners and active keys: `Partners.IsActive = 1` and `PartnerApiKeys.IsActive = 1`.
- Do not ask the user for an ApiKey list for normal checks. Discover keys from DB.
- Reports must orient by `PartnerApiKeys.ApiKey`. Use `ApiKeyId` only as a secondary technical field for SQL updates.
- Never use legacy fields `PartnerApiKeys.DisabledUpsaleTypes` or `PartnerApiKeys.PreselectedUpsaleTypes`.
- For production DB writes, prepare SQL for the user by default. Do not execute write SQL unless explicitly asked and write access is available.

## OSAGO Key Detection

Treat an active key as an OSAGO key only when:

- `LTRIM(RTRIM(PartnerApiKeys.SupportedProductTypesJson)) = N'[1]'`.

Do not include keys with `NULL`, empty string, `[]`, no digits, or mixed product arrays such as `[1,4]`. Use the exact predicate from `references/sql.md`; do not use ad hoc `LIKE '%1%'`.

## Workflow

1. Read project `AGENTS.md`, `memory/MEMORY.md`, and create/update a journal for non-trivial work.
2. Read `references/sql.md`.
3. Get data from `InsappCoreProd`:
   - Run the keys query for all active OSAGO keys of active partners.
   - Run the crosses query for those keys.
   - Always call `glossary` before SQL and `query_plan` before `query`.
4. Save query results as JSON files:
   - `crosses.json`: the full query result object or `{ "rows": [...] }` with `PartnerName`, `ApiKey`, `ApiKeyId`, `SupportedProductTypesJson`, legal form, insurer/cross fields, and effective status.
5. Generate the report:

```powershell
node C:\Users\nikit\.codex\skills\osago-crosses-check\scripts\build_crosses_report.js `
  --input C:\tmp\osago-crosses.json `
  --out C:\Users\nikit\Desktop\osago_crosses_report.html
```

6. Validate the HTML:
   - All active OSAGO keys appear exactly once.
   - The report has sections for keys with enabled crosses, keys with only disabled crosses, and keys with no cross rows.
   - Tables have filters and counters.
   - `ApiKey` is visible and is the primary identifier.
   - Disabled-by-parent cases are visible separately from direct `PartnerInsurerUpsaleSettings.IsDisabled = 1`.
   - Matrix view column headers show full partner name, full `ApiKey`, and ApiKey description; matrix search data includes the description.
   - The report has two tabs:
     - detailed tab: shows granular reasons by level (`PartnerInsurerSettings` missing/disabled, `PartnerInsurerUpsaleSettings` missing/disabled, connected);
     - simple matrix tab: rows are partner/`ApiKey`/description, columns are cross names, cells are only `Да`/`Нет`.
   - The detailed expandable rows show `UpsaleMode` as a colored numeric badge only: `1`, `2`, `3`, `4`, or `нет` when the mode is missing.
   - Do not show technical mode names like `RequiredReinsurance_NoneCommon` in visible report text. Use the numeric mode with a Russian explanation in parentheses for filters, matrix tabs, and guide text:
     - `1 (Кросс продается как вмененный для пула, а для обычного предложения не продается)`;
     - `2 (Кросс продается как вмененный для пула, а для обычного предложения опционально)`;
     - `3 (Кросс продается как опциональный для пула и для обычного предложения)`;
     - `4 (Кросс не продается в пул, и продается как опциональный для обычного предложения)`.
   - Add a visible top guide/legend that explains what each `UpsaleMode` number means.
   - The toolbar has an `UpsaleMode` filter.
   - The report has a separate `Обычная матрица — <number and Russian explanation>` tab for each of the four modes above.
   - Hero metrics use clear domain labels and explain what is counted. Do not use vague labels like `Проверяемых сущностей`. If a metric counts cross columns/types, name it `Проверяемых кроссов` or `Типов кроссов` and include a visible legend/list of the cross names used in the matrix. If a metric counts `UpsaleMode` variants, name it `Режимов UpsaleMode` and show the four numeric mode explanations in the top guide.
7. Publish only when the user explicitly asks. If publishing, follow the project's existing report publishing/index flow.

## Report Naming

Use the report title and index link name `ОСАГО — Кроссы`.

Use tab and section names consistently across OSAGO reports:

- detailed expandable/card view: `Детальная проверка`;
- a single binary matrix: `Обычная матрица`;
- multiple binary matrices in one report: `Обычная матрица — <matrix subject>`.

Hero/summary metric labels must be self-explanatory. Avoid abstract nouns such as `сущности`, `объекты`, or `проверки` when the number actually means cross types, insurer count, matrix rows, or mode count. Every count of checked items must either name the item type directly or have an adjacent guide that lists the included items.

## Cross Status

Build the report from the full expected OSAGO cross matrix, not only from existing `PartnerInsurerUpsaleSettings` rows. If either the insurer setting row or the specific cross row is missing, the cross is disabled.

Use both row-level and effective status:

| Status | Meaning |
|---|---|
| Missing insurer settings | No `PartnerInsurerSettings` row for this key and the insurer that owns the cross; count as disabled |
| Missing cross settings | `PartnerInsurerSettings` exists, but no `PartnerInsurerUpsaleSettings` row for this cross; count as disabled |
| Row enabled | `PartnerInsurerUpsaleSettings.IsDisabled = 0` |
| Row disabled | `PartnerInsurerUpsaleSettings.IsDisabled = 1` |
| Effectively enabled | row enabled and `PartnerInsurerSettings.IsDisabled = 0` |
| Disabled by parent | row enabled, but `PartnerInsurerSettings.IsDisabled = 1` |

HTML reports must distinguish why the effective status is disabled:

- `PartnerInsurerSettings` missing or `PartnerInsurerSettings.IsDisabled = 1` means the insurer is not connected/disabled for this key. Say that explicitly; do not present it as "cross disabled".
- `PartnerInsurerUpsaleSettings.IsDisabled = 1` means this specific cross is disabled.
- Missing `PartnerInsurerUpsaleSettings` with existing active insurer settings means this specific cross row is missing and the cross is disabled.
- Do not filter `PartnerInsurerSettings` by `ProductTypeId`; use insurer settings for the key/insurer as configured.
- Ignore `PartnerInsurerSettings.UpsalesDisabled`: this field is no longer used by the application code and must not affect report status, badges, counters, or SQL classification.

For the simple matrix tab only, use a binary connected flag:

- `Да`: `PartnerInsurerSettings` exists, `PartnerInsurerSettings.IsDisabled = 0`, `PartnerInsurerUpsaleSettings` exists, and `PartnerInsurerUpsaleSettings.IsDisabled = 0`.
- `Нет`: insurer settings missing, insurer disabled, cross row missing, or cross row disabled.
- This binary rule is only for the simple matrix tab. The detailed tab must keep the granular status reasons above.

Use these Russian labels consistently in reports and badges. Keep a one-to-one mapping between visible text and color class; do not reuse one generic label such as `Кросс не подключен` for different disable reasons.

| Case | Label |
|---|---|
| Effectively enabled cross | `Кросс подключен` |
| Missing `PartnerInsurerSettings` row | `Настройка на СК не заведена` |
| `PartnerInsurerSettings.IsDisabled = 1` | `СК выключена` |
| Missing `PartnerInsurerUpsaleSettings` row | `Настройка на Кроссы не заведена` |
| `PartnerInsurerUpsaleSettings.IsDisabled = 1` | `Кросс выключен` |
In final answers, show compact Markdown tables. Avoid dense continuous text.

## Default Output

Default local HTML output:

`C:\Users\nikit\Desktop\osago_crosses_report.html`
