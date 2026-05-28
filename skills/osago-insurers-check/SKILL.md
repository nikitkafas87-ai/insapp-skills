---
name: osago-insurers-check
description: Use when checking which insurers are connected for active OSAGO partner ApiKeys, generating insurer connection and reinsurance matrices, validating PartnerInsurerSettings flags, or reporting ReinsuranceEnabled/ReinsuranceWithoutUpsalesEnabled settings for OSAGO insurers.
metadata:
  short-description: Check OSAGO insurer connections
---

# OSAGO Insurers Check

Use this skill for OSAGO insurer connectivity audits by partner `ApiKey`: discover active OSAGO keys from production DB, build the expected key × insurer matrix, classify insurer connectivity and reinsurance pool flags, generate an HTML report, and optionally publish it.

## Core Rules

- Source of truth: `PartnerInsurerSettings`.
- Include only active partners and active keys from `InsappCoreProd`:
  - `Partners.IsActive = 1`;
  - `PartnerApiKeys.IsActive = 1`;
  - `LTRIM(RTRIM(PartnerApiKeys.SupportedProductTypesJson)) = N'[1]'`.
- Do not ask the user for an ApiKey list for normal checks. Discover keys from DB.
- Reports must orient by full `PartnerApiKeys.ApiKey`, not by shortened keys.
- Reports must include `Partners.LegalFormId` and `LegalFormName`, then provide the same legal-form grouping and filter pattern used in `osago-crosses-report`: `Юридическое лицо`, `ИП`, `Физическое лицо`, and `Не указано` for unknown values.
- Treat the audit as OSAGO-specific by the active `PartnerApiKeys.SupportedProductTypesJson = N'[1]'` key filter.
- Do not filter `PartnerInsurerSettings` by `ProductTypeId` in this report. Match insurer settings by `ApiKeyId + InsurerId`; historical/current settings for active OSAGO keys can have another `ProductTypeId`, and filtering it out makes disabled insurers look enabled by default.
- Do not execute production DB writes from this skill. It is read-only by default.

## Insurer List

Always check exactly these insurer aliases unless the user explicitly asks for a custom list:

`Absolut`, `Alfa`, `AlfaDec`, `astrovolga`, `Energogarant`, `Gelios`, `Ingos`, `Intouch`, `Maks`, `Renis`, `Reso`, `Rgs`, `Sber`, `Sogaz`, `Soglasie`, `Sovkom`, `Tinkoff`, `Ugoria`, `Vsk`, `Zetta`, `BSO`, `Pari`.

`Alfa` and `AlfaDec` are separate columns.

## Status Rules

Connectivity matrix:

| Case | Connected? | Report label |
|---|---:|---|
| `PartnerInsurerSettings` row missing | yes | `СК включена: настройки не заведены` |
| `PartnerInsurerSettings.IsDisabled = 0` | yes | `СК включена` |
| `PartnerInsurerSettings.IsDisabled = 1` | no | `СК отключена` |

Pool matrices:

| Matrix | Enabled only when | Disabled when |
|---|---|---|
| `ReinsuranceEnabled` | `PartnerInsurerSettings.ReinsuranceEnabled = 1` | value is `0`, `NULL`, or `PartnerInsurerSettings` row is missing |
| `ReinsuranceWithoutUpsalesEnabled` | `PartnerInsurerSettings.ReinsuranceWithoutUpsalesEnabled = 1` | value is `0`, `NULL`, or `PartnerInsurerSettings` row is missing |

Do not include credential fields in public reports. `Login`, `Password`, `Login2`, and `Password2` are not rendered in the GitHub Pages report. If credentials are needed for a private check, prepare a separate local-only artifact and do not publish it to `reports-index`.

## Workflow

1. Read project `AGENTS.md`, `memory/MEMORY.md`, and create/update a journal for non-trivial checks.
2. Read `references/sql.md`.
3. Before executing SQL, call the DB glossary. Because the report query has multiple joins and a cross join, call `query_plan` before `query`.
4. Run the matrix query from `references/sql.md` against `InsappCoreProd`.
5. Save results as JSON, usually:

```powershell
C:\tmp\osago-insurers.json
```

The JSON can be either a raw DB MCP response with `rows` or a plain array of rows.

6. Generate the report:

```powershell
node C:\Users\nikit\.codex\skills\osago-insurers-check\scripts\build_insurers_report.js `
  --input C:\tmp\osago-insurers.json `
  --out C:\Users\nikit\Desktop\osago_insurers_report.html
```

7. Validate the HTML:
   - number of key rows equals discovered active OSAGO ApiKeys;
   - the `Детальная проверка` tab is an expandable list of ApiKey cards grouped by legal form, like `osago-crosses-report`;
   - the `Обычная матрица — Подключенность СК`, `Обычная матрица — Продажа в пул`, and `Обычная матрица — Продажа в пул без кросса` tabs are each a single matrix across all legal forms; the legal-form filter hides rows in those matrices instead of splitting them into separate matrices;
   - each matrix has all expected insurer columns;
   - total matrix cells = `ApiKey count × 22`;
   - tabs exist for `Детальная проверка`, `Обычная матрица — Подключенность СК`, `Обычная матрица — Продажа в пул`, and `Обычная матрица — Продажа в пул без кросса`;
   - connected, disabled, missing-row/default-enabled, pool enabled, and pool disabled states use distinct colors;
   - ordinary matrix tabs use only two cell labels and colors: `Да` and `Нет`; granular colors are only for `Детальная проверка`;
   - full `ApiKey` values are visible.
   - credential values and masked credential placeholders are absent from the public report.
   - hero metrics use clear domain labels and explain what is counted. Do not use vague labels like `Проверяемых сущностей`. If a metric counts insurer columns, name it `Проверяемых СК` or `Страховых компаний` and show the insurer aliases/list used for the matrix; if it counts cells, label it as matrix cells and keep the formula visible as `ApiKey count × 22`.
8. Publishing:
   - If the user asks to publish, follow the same `reports-index` style and index flow as `badges-osago-check` and `osago-crosses-check`.
   - Default public path: `osago-insurers-report/index.html`.
   - Public URL: `https://nikitkafas87-ai.github.io/reports-index/osago-insurers-report/`.
   - Mask passwords by default for public publishing. Use a password-gated/private flow if unmasked credentials must be shared.
9. In the final answer, include the report URL or local path, row/cell counts, validation performed, and whether passwords were masked.

## Report Structure

Use the same visual structure as the badges/crosses reports:

- hero block with generation time, source filter, and metrics;
- sticky toolbar with search and filters;
- mandatory legal-form dropdown filter;
- color legend;
- hero/summary metrics with unambiguous labels. Do not use abstract labels such as `Проверяемых сущностей`; name the counted thing directly, for example `Проверяемых СК`, `ApiKey ОСАГО`, or `Строк матрицы`, and add a visible legend/list when the metric is a fixed checklist;
- tabs:
  1. `Детальная проверка`;
  2. `Обычная матрица — Подключенность СК`;
  3. `Обычная матрица — Продажа в пул`;
  4. `Обычная матрица — Продажа в пул без кросса`.

The `Детальная проверка` tab uses expandable partner `ApiKey` cards grouped by `LegalFormName`. The ordinary matrix tabs use one flat matrix each: rows are partner `ApiKey`s, columns are insurer aliases, and legal-form filtering hides nonmatching rows. Ordinary matrix cells must show only `Да` or `Нет` with exactly two colors, so users are not confused by detailed status colors. The `Обычная матрица — Подключенность СК` tab uses the same connection rule as the detailed list: `Да` when `PartnerInsurerSettings.IsDisabled = 0` or the PIS row is missing, and `Нет` when `PartnerInsurerSettings.IsDisabled = 1`.

In the detailed insurer table, show which product the matched `PartnerInsurerSettings` row belongs to:

- `ОСАГО` for `PartnerInsurerSettings.ProductTypeId = 1`;
- `КАСКО` for `PartnerInsurerSettings.ProductTypeId = 2`;
- `Ипотека` for `PartnerInsurerSettings.ProductTypeId = 3`;
- `ProductTypeId <id>` for any other non-null value;
- `PIS нет` when the settings row is missing.

Also include `PartnerInsurerSettings.ProductTypeId` in matrix cell tooltips so a binary `Да`/`Нет` can be traced back to the product-level PIS row without adding extra visual noise to the matrix.

In the expandable insurer list, show pool flags as user-facing Russian fields:

- `Продажа в пул` with the technical field name `ReinsuranceEnabled` only as muted gray helper text;
- `Продажа в пул без кросса` with the technical field name `ReinsuranceWithoutUpsalesEnabled` only as muted gray helper text.

The toolbar must include filters by both pool fields. Matrix cells must not display `PIS есть`, `PIS нет`, or similar technical PIS presence suffixes.

Use the report title and index link name `ОСАГО — Подключенность СК`.

Use tab names consistently across OSAGO reports:

- detailed expandable/card view: `Детальная проверка`;
- a single binary matrix: `Обычная матрица`;
- multiple binary matrices in one report: `Обычная матрица — <matrix subject>`.

## Output Files

Default local HTML output:

`C:\Users\nikit\Desktop\osago_insurers_report.html`

Default public report URL when published:

`https://nikitkafas87-ai.github.io/reports-index/osago-insurers-report/`
