---
name: badges-osago-check
description: Use when checking OSAGO badge settings for partner ApiKeys, generating the badges OSAGO HTML report, validating badge UI/API/DB data, or updating the badges OSAGO report in reports-index GitHub Pages. Handles APay, BestService, LoyalInsurer, UserChoice, and UsersInsurer badge mappings.
metadata:
  short-description: Check OSAGO partner badges
---

# Badges OSAGO Check

Use this skill for OSAGO badge audits: discover eligible active OSAGO partner ApiKeys from production DB, collect badge data, generate the HTML report, validate the three report sections, and publish the actualized report to `reports-index`.

This is the Codex-native version of the old Claude skill from:

`C:\Users\nikit\projects\autotests\.claude\skills\badges-osago-check`

## Inputs

Ask for missing inputs only when they are required and cannot be discovered from local context:

- ApiKey list: do not ask for this by default. For a fresh audit, discover the key list from `InsappCoreProd`: only `PartnerApiKeys.IsActive = 1`, `Partners.IsActive = 1`, and `PartnerApiKeys.SupportedProductTypesJson = N'[1]'`.
- Manual ApiKey list: use only if the user explicitly asks to audit a custom list instead of the production-discovered active OSAGO list.
- Report password: required only when the user explicitly asks for an encrypted HTML report.
- Publish target: every actualization must update `nikitkafas87-ai/reports-index`; default report path is `badges-osago-report/` inside that repo unless the user requests another target.

## Workflow

1. Read the current request, project `CLAUDE.md`, and relevant journals if continuing previous work.
2. Get badge data from `InsappCoreProd`. Use an available DB connector if present. If no DB connector is available, prepare SQL from `references/sql.md` and tell the user DB execution is blocked.
   - The default key set must be discovered in SQL, not supplied by the user.
   - Include only active API keys of active partners where `PartnerApiKeys.SupportedProductTypesJson = N'[1]'`.
3. Save query results as JSON files:
   - `badges.json`: rows with `ApiKey`, `PartnerName`, `LegalFormId`, `LegalFormName`, `BadgeName`, `InsurerName`.
   - `names.json`: all discovered eligible keys with `ApiKey`, `PartnerName`, `LegalFormId`, `LegalFormName`.
   - `active.json`: rows with `ApiKey`, `LegalFormId`, `LegalFormName`, `KeyActive`, `PartnerActive`; for the default discovered set these should all be active, but keep the file because the report generator uses it.
4. Generate the report:

```powershell
node C:\Users\nikit\.codex\skills\badges-osago-check\scripts\build_badges_report.js `
  --badges C:\tmp\badges.json `
  --names C:\tmp\names.json `
  --active C:\tmp\active.json `
  --out C:\Users\nikit\Desktop\badges_osago_report.html
```

5. Validate the HTML before publishing:
   - All three sections exist: full, partial, none.
   - Counters are present and make sense.
   - Every discovered eligible ApiKey appears exactly once.
   - The report has a mandatory legal-form filter and legal-form grouping exactly like the OSAGO crosses report: `Юридическое лицо`, `ИП`, `Физическое лицо`, and `Не указано` when `Partners.LegalFormId` is outside known values.
   - Inactive keys or partners are visually dimmed for custom audits that include inactive records.
   - Partial section has the `Не подключены` column.
6. Publish on every actualization:
   - Copy the validated report to the `reports-index` repo as `badges-osago-report/index.html`.
   - Add or update the index row in `reports-index/index.html` after the report file is updated.
   - Commit and push the `reports-index` changes.
   - Verify the public report URL and the index page after Pages updates.
7. If the user explicitly asks for a password-gated standalone report instead of the default `reports-index` flow, use the `html-push` skill and verify the encrypted wrapper has exactly one password input.
8. In the final answer, include the public report URL, validation performed, and anything not verified.

## Badge Mapping

Required report columns:

| Column | Data |
|---|---|
| Партнёр | Partner name from `Partners.Name` |
| Тип юрлица | `Partners.LegalFormId` mapped to `LegalFormName` |
| ApiKey | Full ApiKey |
| Ключ акт. | `PartnerApiKeys.IsActive` |
| Партнёр акт. | `Partners.IsActive` |
| APay | `BadgeTypes.Name = 'APay'` and `BadgeSettings.IsAlfaPayInsurer = 1` |
| Лучший сервис | `BestService` and `IsBestService = 1` |
| Надёжная СК | `LoyalInsurer` and `IsLoyalInsurer = 1` |
| Выбор поль-лей | `UserChoice` and `IsRecomendedInsurer = 1` |
| Ваша СК | `UsersInsurer`, enabled in `BadgeTypeSettings` |
| Не подключены | Only for partial section |

The "full" section means these four badges are connected:

- `BestService`
- `LoyalInsurer`
- `UserChoice`
- `UsersInsurer`

`APay` is displayed but is not part of the "all 4 badges" requirement.

## Report Structure

Use the report title and index link name `ОСАГО — Бейджи`.

Always render all three sections, even when one is empty:

1. `Все 4 бейджа подключены`
2. `Не все бейджи подключены`
3. `Без бейджей - нет настроек`

Each table must have dropdown filters and a visible counter.

Legal-form grouping is mandatory. The detailed report must group partner keys by `LegalFormName` in the same style as `osago-crosses-report`, and the toolbar must include a legal-form dropdown filter. Search/filter logic must work across every legal-form section without hiding the section header incorrectly.

Hero metrics must use clear domain labels and explain what is counted. Do not use vague labels like `Проверяемых сущностей`. For this report, the metric must be named `Проверяемых типов бейджей` or `Типов бейджей` and must be visibly explained in the report/legend as exactly these five types: `APay`, `BestService`, `LoyalInsurer`, `UserChoice`, `UsersInsurer`. Also state near the metric or legend that `APay` is shown separately and is not included in the mandatory `4/4` requirement; `4/4` means only `BestService`, `LoyalInsurer`, `UserChoice`, and `UsersInsurer`.

Use tab names consistently across OSAGO reports:

- detailed expandable/card view: `Детальная проверка`;
- a single binary matrix: `Обычная матрица`;
- multiple binary matrices in one report: `Обычная матрица — <matrix subject>`.

## Critical Checks

- Always discover the key list from production DB for fresh audits. Do not rely on a stale copied ApiKey list unless the user explicitly asks for a custom audit.
- Always run the separate partner-name query. The main badge query does not return ApiKeys with no badge settings, so `names.json` is the authoritative full eligible-key list.
- Always run the separate active-status query. The report uses it for active columns and dimmed rows.
- The default production-discovered key filter is exactly: `pak.IsActive = 1`, `p.IsActive = 1`, and `pak.SupportedProductTypesJson = N'[1]'`.
- Every default query must return `Partners.LegalFormId` and a `LegalFormName` mapping so the report can group and filter by legal form. Do not generate a flat report without legal-form grouping.
- Join `BadgeSettings` through `PartnerBadgeSettingId`, not through `BadgeTypeSettings`.
- Filter `BadgeTypeSettings.Enabled = 1`; disabled badge type settings do not count.
- Preserve `AlfaDec` as a distinct insurer with `CASE WHEN i.Alias = 'AlfaDec' THEN i.Name + N' (ДЭК)'`.
- Escape partner and insurer names in HTML.
- Validate that every top metric has an unambiguous label. In particular, the report must not contain `Проверяемых сущностей`; use `Проверяемых типов бейджей` / `Типов бейджей` with the five-type explanation instead.
- Every actualization must publish the ready report to `https://nikitkafas87-ai.github.io/reports-index/badges-osago-report/` and verify that `https://nikitkafas87-ai.github.io/reports-index/` links to it.
- Do not publish through SSH on Windows if it fails on host key verification; HTTPS with an already available token is more reliable.
- Do not store GitHub tokens in generated files or final messages.

## Output Files

Default local HTML output before publishing:

`C:\Users\nikit\Desktop\badges_osago_report.html`

Default public report URL after actualization:

`https://nikitkafas87-ai.github.io/reports-index/badges-osago-report/`

Default public index URL:

`https://nikitkafas87-ai.github.io/reports-index/`
