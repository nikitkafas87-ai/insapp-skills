# Pool Reinsurance Rules

## Approved Insurer Scope

This skill has a closed insurer scope. Query only the aliases and log tables below. Do not add any other insurer, integration, or system logs unless the user explicitly updates this scope first.

| # | Alias | Log table |
|---|---|---|
| 1 | Absolut | `AbsolutLogs` |
| 2 | Alfa | `AlfaLogs` |
| 3 | AlfaDec | `AlfaDecLogs` |
| 4 | astrovolga | `AstroVolgaLogs` |
| 5 | Energogarant | `EnergogarantLogs` |
| 6 | Gelios | `GeliosLogs` |
| 7 | Ingos | `IngosLogs` |
| 8 | Intouch | `InTouchLogs` |
| 9 | Maks | `MaksLogs` |
| 10 | Renis | `RenessansLogs` |
| 11 | Reso | `ResoLogs` |
| 12 | Rgs | `RosgosstrahLogs` |
| 13 | Sber | `SberLogs` |
| 14 | Sogaz | `SogazLogs` |
| 15 | Soglasie | `SoglasieLogs` |
| 16 | Sovkom | `SovcomLogs` |
| 17 | Tinkoff | `TinkoffLogs` |
| 18 | Ugoria | `UgoriaLogs` |
| 19 | Vsk | `VskLogs` |
| 20 | Zetta | `ZettaLogs` |
| 21 | BSO | `BSOLogs` |
| 22 | Pari | `PariLogs` |

## Known Insurer IDs

Use exact `InsurerId` values for offer verification. Never filter insurers by alias text.

| # | Alias | InsurerId |
|---|---|---|
| 1 | Absolut | `1F836F31-CF6A-4324-B513-462D4DBEA401` |
| 2 | Alfa | `CDA9423C-A34D-4752-87D3-47DEFEC5CB56` |
| 3 | AlfaDec | `A7AF68D6-6E5C-4231-B334-5C488CFE71E4` |
| 4 | astrovolga | `F889BE53-9D60-40B1-97D7-261F4CE66D9C` |
| 5 | Energogarant | `0AD811E1-724B-4502-BFDD-CCE6D0D1ECA5` |
| 6 | Gelios | `ADBD4CE5-8177-4FB0-AA9A-A22E6A9E884F` |
| 7 | Ingos | `AEB63341-4C3B-4C05-BE2D-F0BC5A4B5E71` |
| 8 | Intouch | `667425DF-7CA5-4895-8F11-70FF1175E159` |
| 9 | Maks | `4BADA4F8-3EB6-4372-BE71-59591D37455C` |
| 10 | Renis | `DD4408A7-4898-44D9-95B3-EA7EC3BAEFA7` |
| 11 | Reso | `25EA32F4-0337-45B7-8C9A-50D3D4A84471` |
| 12 | Rgs | `A024DA77-63E1-4B3D-8EF8-423C71EA61D6` |
| 13 | Sber | `7AB8ABDC-C8B1-49BB-9272-4247B3A16FD9` |
| 14 | Sogaz | `7A8251FF-2F25-4E7B-8CF6-9C377D5A10E9` |
| 15 | Soglasie | `FBCFD2D2-6722-4348-A1B3-B94D51491CBF` |
| 16 | Sovkom | `896D23D9-D567-43B6-B752-80857077A05F` |
| 17 | Tinkoff | `EE1BCABB-61A0-4137-91B3-6EA23A1A77F4` |
| 18 | Ugoria | `3ECF7469-079E-42A7-9C55-FBA2291DACBC` |
| 19 | Vsk | `36583F16-235C-42D6-8FCE-B04AA6459730` |
| 20 | Zetta | `65E38FD8-5944-49B7-9423-5F289874E405` |
| 21 | BSO | `40455CF6-1C70-4932-8040-61F3CE42AD79` |
| 22 | Pari | `79C59D23-23DD-474F-911B-3E45ECEF7FAA` |

Verify IDs from DB when using a new environment.

## Log Tables

First call `schema(log_db)` and use only approved-scope tables that exist in the selected DB. If an approved table is absent, list it under skipped/manual checks. The presence of additional log tables in schema is not a reason to include them.

## Date Periods

- Use the exact user period when provided.
- Default mode is active-only. Do not run passive broad/exact log review unless the user explicitly asks for passive analysis, a release report, or a recent-log check.
- When passive freshness analysis is explicitly requested, use the last 2 days ending now unless the user gives a stricter period. This 2-day passive check is only for freshness/regression visibility; it should not replace active reproduction.
- A parameter that exists with a negative value (`false`, `0`, empty, or `null`) is no positive signal.
- For Prod release reports, the release date and time is required. Analyze release-report logs strictly from that release timestamp through today; do not include pre-release logs in the release verdict. If the user did not ask for a passive/release report, do not run this passive analysis.
- For active reproduction source discovery, use the selected environment cache first. Test and Dev-with-Test-DB checks use `references/active-source-cache.test.json`; Prod checks use `references/active-source-cache.prod.json`. If no replay-ready cache exists, start exact true-signal DB discovery with the last 14 days, then expand dynamically until a source is found or query timeouts/unsafe plans block safe expansion.
- Suggested expansion order: 14 days, 30 days, 60 days, 90 days, 180 days, 365 days, then all available history only when the query plan is safe. For month+ windows or large tables, check `query_plan` first. Stop expanding when the DB tool times out, the plan is unsafe, or the query cannot be executed safely; report the exact stopping point.
- Run exact source discovery per insurer/log table. Do not combine many insurer log tables into one large `UNION ALL` source-discovery query by default: a Dev/Test 14-day combined query across known exact-pattern tables timed out on 2026-05-29, while per-table queries completed and also exposed slow tables (`InTouchLogs`, `RenessansLogs`). Record per-table execution time and slow-query notes in the report.
- Use timezone in DateTimeOffset literals, usually `+03:00`.
- Always report exact absolute period boundaries.

## Broad Search

Run broad search across existing approved-scope log tables only for explicit passive analysis, release reports, or recent-log checks. Do not run broad search during ordinary active-only checks.

- `ResponseBody LIKE N'%reinsurance%'`
- `RequestBody LIKE N'%reinsurance%'`
- `ResponseBody LIKE N'%reinsur%'`
- `RequestBody LIKE N'%reinsur%'`
- Russian "perestrah" substring in `ResponseBody` and `RequestBody` using the actual Cyrillic text from local logs.
- `ResponseBody LIKE N'%pool%'`
- `RequestBody LIKE N'%pool%'`

Broad matches are not verdicts. They must be inspected or classified by exact true/false patterns. Never use broad-search-only matches as active reproduction sources.

## Final Check Statuses

Every check must end with one of these strict statuses:

- `passed`: a fresh active run reproduced a positive pool signal and offer handling matches the business rules.
- `failed_pool_not_reproduced`: 3 valid non-reproducing attempts were completed and no positive pool signal came.
- `failed_offer_handling`: a positive pool signal came, but Core offer handling is wrong or suspicious.
- `blocked_no_source`: no usable source questionnaire was found before safe source search stopped.
- `blocked_api_validation`: source questionnaire replay cannot pass API validation and no replacement source can complete the active run.
- `blocked_insurer_no_response`: the application reached `SendToInsurers`, but the target insurer produced no response after the required polling window.
- `manual_check_required`: DB access, query plan, timeout, permissions, or environment mismatch prevents a reliable automated verdict.

Do not use vague final statuses such as `ok`, `partial`, or `not passed` without mapping them to one of the statuses above.

## Exact True Signals

Use these exact true patterns first:

- Absolut: `ResponseBody LIKE N'%"reinsurance":"true"%'` or `N'%"reinsurance":true%'`.
- Alfa: `ResponseBody LIKE N'%"reinsurance":true%'`.
- Gelios: `ResponseBody LIKE N'%"isReinsured": true%'` or `N'%"isReinsured":true%'`.
- Ingosstrakh: OSAGO agreement create can return pool/reinsurance through warning level 10, without a literal `pool`/`reinsurance` flag. Treat as positive only on the OSAGO agreement response:
  `Url LIKE N'%/partner/osago/agreement/create%' AND ResponseBody LIKE N'%"warnings"%' AND ResponseBody LIKE N'%уровень 10%'`.
  Verify new/changed Ingos patterns against Core offers: expected handling is `OfferTypeId=4` and reject/fail status. `Базовый уровень` in the same warning field is not a positive pool signal.
- Energogarant: `ResponseBody LIKE N'%"is_reinsurance":true%'`.
- Intouch/Renis style: `ResponseBody LIKE N'%"isReinsurance": true%'` or `N'%"isReinsurance":true%'`; also check `isExtraPool` the same way.
- Maks: OSAGO response can contain escaped XML field `re=Y`. Treat as positive when the response contains:
  `ResponseBody LIKE N'%&lt;re>Y&lt;/re>%'`.
  Verify against Core offers: expected handling is `OfferTypeId=4` and reject/fail status.
- Reso: `Calculate2Response` returns the pool signal in XML field `<ns2:Commission>`. Treat Reso as positive pool only when the response from `Calculate2` contains:
  `ResponseBody LIKE N'%Calculate2Response%' AND ResponseBody LIKE N'%<ns2:Commission>0.0</ns2:Commission>%'`.
  This is an insurer-specific exception to the general "0 means no signal" rule: for Reso, `Commission=0.0` means the offer is pool. Verify against Core offers: the existing voluntary cross must be converted to a required/mandatory scenario, observed as Reso required cross `UpsaleType=16` with `IsOptional=0`. If the Reso pool offer is approved without that required cross, treat it as suspicious/bug; if the required cross is absent, expected handling is decline.
- Sovcom optional parameters: ensure `"value": "true"` belongs to `"key": "reinsurancePool"`, not another parameter.
- Soglasie XML: require the OSAGO reinsurance parameter `id=6463` (`brief/name`: `ПерестрахованиеОСАГО` / `Перестрахование ОСАГО`) and `<result>1</result>` for that same `param` node.
  - Do not use independent `LIKE` checks such as `ResponseBody LIKE '%<id>6463</id>%' AND ResponseBody LIKE '%<result>1</result>%'`; this can match an unrelated `<result>1</result>` elsewhere in the XML.
  - Use a bounded same-`param` check in SQL:
    ```sql
    ResponseBody LIKE N'%<param><id>6463</id>%<result>1</result></param>%'
    ```
  - When inspecting manually, parse the response and verify the concrete node `param/id=6463/result`. In some logs `TRY_CAST(ResponseBody AS XML)` may not be reliable because of response formatting; bounded SQL or local XML parsing from base64 is safer.
- Ugoria: exact pool signal is returned by `/policy/{policyId}/info` in JSON field `data.return.category`. Treat `R`, `R1`, and `M` as pool:
  `Url LIKE N'%/policy/%/info%' AND ISJSON(ResponseBody)=1 AND JSON_VALUE(ResponseBody, '$.data.return.category') IN ('R','R1','M')`.
  - If JSON functions are unavailable, use a text fallback only as triage: look for `"return"` and `"category"` with value `"R"`, `"R1"`, or `"M"` in the same info response, then manually inspect the parsed JSON path.
  - This rule comes from Tracker bug `INS-2750`; do not replace it with `lineOfBusiness`, policy status, or response `result`.
  - Ugoria has a lifecycle exception: this pool signal can arrive after the user has already selected the offer. In that case, do not classify the already approved/selected offer as a bug only because the later `/policy/{policyId}/info` response returned `R`, `R1`, or `M`.
- Zetta: `ResponseBody LIKE N'%"DoReinsure": true%'` or `N'%"DoReinsure":true%'`.

Treat `false`, `0`, empty strings, `null`, missing values, and Soglasie `<result>0</result>` as no positive pool signal unless a specific exact rule above defines that value as positive. Current exception: Reso `Calculate2Response` `<ns2:Commission>0.0</ns2:Commission>` is a positive pool signal.

### Candidate / negative signals found in Dev/Test

These patterns were found during Dev-with-Test-DB discovery on 2026-05-29. They are useful for triage, but do not promote them to exact positive rules until a true-value sample is found and verified against Core offers:

- astrovolga: `AstroVolgaLogs` responses contain `transferToPool:false`. Treat `false` as no positive pool signal. If `transferToPool:true` is found later, inspect that application and verify Core handling before adding it to exact true signals.
- Pari: `PariLogs` `/contracts/info/{id}` responses contain `"reinsurance":false`. Treat `false` as no positive pool signal. A future `"reinsurance":true` sample is a candidate positive signal, but still requires verification against Core handling before promotion.
- BSO: `BSOLogs` ADS/BSO responses can contain `is_reinsurance:"false"` and `reinsurance resolving error` text. Treat `false` and error-only matches as no positive pool signal. A future `is_reinsurance:"true"` sample is only a candidate until verified.
- Reso: promoted from candidate/manual to exact rule on 2026-05-29. `Calculate2Response` with `<ns2:Commission>0.0</ns2:Commission>` is a positive pool signal. Core `OfferTypeId=7` + required cross alone is still not enough without the Reso log signal.

## Ugoria Deep Check

Ugoria must be checked explicitly, even when broad `pool`/`reinsur` searches return zero rows.

Known Dev/Test observations:

- Main request: `/ugsk-marketplace-api/create`.
- Polling request: `/ugsk-marketplace-api/policy/{policyId}/status`.
- Final policy data request can return `ResponseBody.data.return.lineOfBusiness`.
- Exact pool URL is `/ugsk-marketplace-api/policy/{policyId}/info`; check `ResponseBody.data.return.category`.
- Pool category values: `R`, `R1`, `M`.
- Non-pool category values observed in Dev/Test: `A`, `A1`.
- `lineOfBusiness = "Переход"` is not a reinsurance pool signal by itself; it maps to `OfferTypeId = 3` (`ChangeInsurer`), not to reinsurance offer types.
- Do not classify Ugoria pool by `ResponseBody.result = true`, `message = "ok"`, policy status polling, or KБM-service error messages. These are transport/business-status fields, not pool flags.
- Lifecycle exception: Ugoria can return the pool category only after the user selected the offer. For Ugoria, always compare the `/policy/{policyId}/info` timestamp with application/offer lifecycle events before filing a bug. If the category appears only after offer selection, an approved offer is expected and must be reported as the Ugoria exception, not as suspicious handling.

When a Ugoria pool sample is found, verify it against core offers with `OfferTypeId IN (4,7,14,15,16,17,18,19,20,21)` and verify when the signal appeared relative to offer selection. Only classify it as suspicious if the pool category was known before the relevant offer decision and the handling contradicts expected behavior.

## Active Reproduction

Use active reproduction by default. Passive analysis is optional and runs only when the user explicitly asks for it. If an insurer response only contains a pool/reinsurance parameter with `false`, `0`, empty, or `null`, that is still no positive pool signal.

### Active source cache

Before DB source discovery, read the environment-specific cache file:

- Test: `references/active-source-cache.test.json`.
- Dev without a separate DB, using Test DBs: `references/active-source-cache.test.json`.
- Prod: `references/active-source-cache.prod.json`.
- `references/active-source-cache.json` is legacy only. Do not write new cache entries to it.

- Cache key inside each environment file: `alias`. Keep the `environment` field in each source entry as a safety check, but never mix Test/Dev sources into the Prod cache or Prod sources into the Test cache.
- Each source entry must have `status`: `working`, `needsRefresh`, `stale`, or `invalid`.
- Status meaning:
  - `working`: replay-ready questionnaire recently reproduced a positive pool signal and may be tried first.
  - `needsRefresh`: replay-ready questionnaire is usable but older or lower priority; try it only after `working` entries fail or are absent.
  - `stale`: questionnaire no longer reproduces a positive pool signal; keep it as history and do not try it before dynamic source discovery.
  - `invalid`: questionnaire/API flow is broken, incomplete, or fails validation; keep it as history and do not use it for normal active checks.
- Store replay-ready data, not only IDs: `environment`, `alias`, `status`, `sourceApplicationId`, `sourceSignalDate`, `logTable`, `signalPattern`, `insurerId`, `apiBase`, `flow`, `lastUsedAt`, `lastResult`, `lastPositiveAt`, `lastPositiveNewApplicationId`, `lastPositiveSignal`, `lastOfferResult`, and short notes.
- `flow` must contain the source-specific Public API sequence and request bodies needed to clone without rereading `PublicApiLogs`. Store request bodies as base64 of UTF-16LE text, for example `requestBodyBase64Utf16Le`, with method/order/url metadata.
- Full questionnaire/request bodies can contain personal/test data and API keys. Treat the environment-specific cache files as local sensitive test artifacts: do not paste raw cached bodies into final reports, Tracker comments, or generated public artifacts.
- Keep up to 3 `working` entries per insurer alias in each environment cache. Try `working` entries first, newest `lastPositiveAt` first; then try `needsRefresh` entries if needed. If adding a new `working` entry would exceed 3, mark the oldest excess `working` entry as `needsRefresh` instead of deleting it.
- If one or more replay-ready `working`/`needsRefresh` cache entries exist for the same environment and insurer alias, try those cached payloads before DB source discovery and do not query `PublicApiLogs` for those cached sources. Stop source attempts immediately if any cached payload reproduces a positive pool signal.
- Legacy metadata-only cache entries may be upgraded once by exact `sourceApplicationId` lookup in `PublicApiLogs`. If the logs were cleaned and the exact source cannot be recovered, mark that cache entry stale and continue to dynamic source discovery.
- Do not promote a DB-discovered source to `working` immediately after finding historical exact true signal. A newly discovered source becomes `working` only after all quality gates pass: historical exact true signal exists, Public API flow is fully recovered, a fresh cloned application is created, the fresh application reaches the target insurer, the target insurer returns a positive exact pool signal, the Core offer is found by exact `InsurerId`, and the business-handling result is recorded.
- If a DB-discovered source fails before it reproduces a positive pool signal, do not add it as `working`. You may record a compact non-working entry as `stale` or `invalid` with reason and without raw bodies when useful for history.
- If active replay from a cached source no longer produces a positive pool signal, updating the selected environment cache is mandatory before dynamic DB discovery. Keep the cache entry and update at least `status='stale'`, `lastUsedAt`, `lastResult`, `staleSince`, `staleReason`, `replacementSearchStartedAt`, and notes as stale/non-reproducing, then continue to dynamic DB source discovery in the same check. Do not mark the insurer check complete or failed solely because cached sources stopped reproducing.
- If active replay fails because the cached questionnaire/API flow is broken rather than insurer returned a normal non-pool response, update `status='invalid'`, `lastUsedAt`, `lastResult`, `invalidSince`, `invalidReason`, and notes before dynamic DB discovery.
- If active replay from a newly discovered source no longer produces a positive pool signal, keep/update a non-working cache/history entry with `lastUsedAt`, `lastResult`, and notes so the next report can explain the stale/non-reproducing source.

### Cache stale/invalid reasons

Use one of these reason values in cache notes/results when possible:

- `no_positive_signal`: insurer responded, but no exact positive pool signal was present.
- `negative_flag`: insurer returned `false`, `0`, empty, `null`, or another negative pool value.
- `insurer_error`: insurer returned an error.
- `no_insurer_response`: no target insurer log response appeared after the polling window.
- `not_sent_to_insurer`: Public API flow did not reach `SendToInsurers`.
- `api_validation_error`: `New` or `SendOsagoApplication` failed validation.
- `api_flow_changed`: cached API sequence no longer matches valid state transitions.
- `corrupted_payload`: cached/recovered questionnaire body is damaged or cannot be replayed safely.
- `core_offer_missing`: positive pool signal came but Core offer was not found.
- `offer_handling_failed`: positive pool signal came but Core handling contradicted business rules.

### Source selection

1. Check the active source cache first for the same environment and insurer alias.
2. If replay-ready cached sources exist, try cached source applications first. Stop immediately when the first cached source reproduces a positive pool signal; do not run extra attempts after success.
3. If cached sources are absent, unusable, or valid but no longer produce a positive pool signal, run DB source discovery for the same insurer. Start with the last 14 days and prefer the newest distinct `ApplicationId` values with exact true signals.
4. If no exact true source application is found in the 14-day source window, expand the period dynamically. Use bounded date windows and continue expanding while query plans are safe and queries complete.
5. If no exact true source application is found before expansion starts timing out or becomes unsafe, mark the check as not passed/blocked for that insurer with the last attempted period and the timeout/plan reason. Do not call the active check complete and do not invent a source from broad matches.
6. After cache fallback, try dynamically discovered source questionnaires one by one and stop immediately when any source reproduces a positive pool signal. The 3-attempt limit is only a cap for the case where positive pool signal does not come.
7. Select up to 3 source applications. Skip a source only when there is no usable replay flow: for cache entries, no cached `SendOsagoApplication` body/API key; for DB-discovered sources, no usable `PublicApiLogs` `SendOsagoApplication` request body or no API key can be recovered.
8. Never use broad-search-only matches as source applications. A source must match the insurer's exact true-signal pattern.
9. If exact source discovery times out but Core has recent reinsurance offers for the exact `InsurerId`, use Core-offer assisted triage only to find candidates for log inspection within the currently attempted source window:
   ```sql
   SELECT TOP 20
       ApplicationId,
       OfferId,
       InsurerId,
       OfferTypeId,
       OfferStatusTypeId,
       Created
   FROM Offers
   WHERE InsurerId = 'INSURER_ID'
     AND OfferTypeId IN (4,6,7,14,15,16,17,18,19,20,21)
     AND Created >= 'SOURCE_WINDOW_START_WITH_TIMEZONE'
   ORDER BY Created DESC;
   ```
   Then inspect the insurer log by exact `ApplicationId` and document the real insurer-side positive signal. Do not treat a Core offer alone as an exact source signal until the matching log signal is identified or already documented in this reference.

### Public API data extraction

If using a replay-ready cache entry, reconstruct the source-specific API sequence from cached `flow` and skip `PublicApiLogs` extraction.

If a source was discovered from DB, or a legacy metadata-only cache entry must be upgraded, find the questionnaire and method sequence from `PublicApiLogs` by source `ApplicationId`:

```sql
SELECT
    [Date],
    ApplicationId,
    ApiKeyId,
    Url,
    RequestBody,
    ResponseBody
FROM PublicApiLogs
WHERE ApplicationId = 'SOURCE_APPLICATION_ID'
  AND (
      Url LIKE '%/app/new%'
      OR Url LIKE '%/app/SetStatusWidgetDisplayed%'
      OR Url LIKE '%/app/SendOsagoApplication%'
      OR Url LIKE '%/app/SendToInsurers%'
  )
ORDER BY [Date];
```

Use `JSON_VALUE(RequestBody, '$.apiKey')` first. If it is absent, resolve the key through core DB:

```sql
SELECT
    a.ApplicationId,
    a.ApiKeyId,
    pak.ApiKey,
    pak.IsActive
FROM Applications a
JOIN PartnerApiKeys pak ON pak.ApiKeyId = a.ApiKeyId
WHERE a.ApplicationId = 'SOURCE_APPLICATION_ID';
```

Preferred extraction path: use the local helper script from this skill, not manual copy/paste:

```powershell
$py = "C:\Users\nikit\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
& $py C:\Users\nikit\.codex\skills\pool-reinsurance-check\scripts\extract_public_api_flow.py `
  --database InsappLogTest `
  --application-id SOURCE_APPLICATION_ID `
  --from-date 2026-05-15T00:00:00+03:00 `
  --query-plan `
  --output C:\Users\nikit\AppData\Local\Temp\pool_public_api_flow_SOURCE_APPLICATION_ID.json
```

The script calls `https://db-mcp.insapp.pro/mcp` directly with `INSAPP_DB_MCP_API_KEY`, requests a query plan, extracts `PublicApiLogs.RequestBody` as chunked UTF-16LE base64, reassembles the chunks locally, validates decoded JSON, and writes a replay-ready local JSON file. It prints only method names, body lengths, and SHA-256 hashes; do not print raw request bodies or API keys.

For active replay from the extracted flow:

```powershell
& $py C:\Users\nikit\.codex\skills\pool-reinsurance-check\scripts\replay_public_api_flow.py `
  --flow C:\Users\nikit\AppData\Local\Temp\pool_public_api_flow_SOURCE_APPLICATION_ID.json `
  --api-base https://test-api.insapp.pro `
  --allow-optional-transition-failure `
  --output C:\Users\nikit\AppData\Local\Temp\pool_public_api_replay_SOURCE_APPLICATION_ID.json
```

Fallback/manual SQL pattern when the helper script cannot be used: when extracting full `RequestBody` through MCP/PowerShell or another JSON-over-JSON transport, use base64 over plain text to preserve Cyrillic and document fields. `PublicApiLogs.RequestBody` is `nvarchar`; encode it as `CONVERT(varbinary(max), RequestBody)` and decode as UTF-16LE locally:

```sql
SELECT
    ApplicationId,
    [Date],
    ApiKeyId,
    Url,
    CAST(N'' AS XML).value(
        'xs:base64Binary(sql:column("BodyBytes"))',
        'varchar(max)'
    ) AS RequestBodyBase64,
    ResponseBody
FROM (
    SELECT
        ApplicationId,
        [Date],
        ApiKeyId,
        Url,
        CONVERT(varbinary(max), RequestBody) AS BodyBytes,
        ResponseBody
    FROM PublicApiLogs
    WHERE ApplicationId = 'SOURCE_APPLICATION_ID'
      AND (
          Url LIKE '%/app/new%'
          OR Url LIKE '%/app/SetStatusWidgetDisplayed%'
          OR Url LIKE '%/app/SendOsagoApplication%'
          OR Url LIKE '%/app/SendToInsurers%'
      )
) x
ORDER BY [Date];
```

Decode locally as UTF-16LE, for example in Node.js:

```javascript
const body = Buffer.from(row.RequestBodyBase64, 'base64').toString('utf16le');
```

After successful extraction, store the source API sequence and each request body in the selected environment cache file as replay-ready cached `flow`. Do not rely on `export_excel` for active replay payloads unless the exported file is locally accessible and inspected. On 2026-05-29 `export_excel` wrote `C:\Windows\TEMP\insapp_export_*.xlsx` on the MCP side, but the local shell could not read it. If the body is round-tripped as plain text and then reserialized, `SendOsagoApplication` can fail with false validation errors on Cyrillic names, birth dates, passport fields, or driver license fields.

Validated Dev/Test example for the helper scripts:

- Source: `08debd5c-1138-0e89-bee7-4316cc091392`.
- Extracted flow: `New`, `SetStatusWidgetDisplayed`, `SendOsagoApplication`, `SendToInsurers`.
- Replay result: new `ApplicationId=08debd83-c1b8-c2bb-bee7-430ff000f316`, all four Public API methods returned `200 - OK` / `result=true`.
- Positive signals reproduced: `AlfaLogs` `"reinsurance":true`; `ResoLogs` `Calculate2Response/ns2:Commission=0.0`.

Use the selected environment API base. Known Test base from logs is `http://test-api.insapp.pro`, but local direct POST can require `https://test-api.insapp.pro`; on 2026-05-29, local `http://test-api.insapp.pro/app/new` returned HTTP 405 while `https://test-api.insapp.pro/app/new` succeeded. Prod logs can contain `http://api.insapp.ru`, while local direct POST may require `https://api.insapp.ru`; if HTTP returns method/routing errors such as 405 on `/app/new`, retry HTTPS and verify the resulting `PublicApiLogs` rows. Do not mix API base, log DB, and core DB from different environments.

### API sequence

For each source application, call the methods in the source-specific order recovered from replay-ready cache or `PublicApiLogs`. Do not hard-code `SetStatusWidgetDisplayed` for every source.

1. `POST <api-base>/app/new`
   - Body: reuse the cached/source `New` body when available; otherwise send the minimum compatible OSAGO new-application body with the source `apiKey`.
   - Required top-level keys observed in logs: `apiKey`, `productType`, `applicationType`, `channelType`, `clientId`, `localTime`, `sessionId`, `successPaymentUrl`, `utm`.
   - Some older/test source flows use minimal PascalCase keys such as `ApiKey`, `ProductType`, and `ChannelType`, without `applicationType`. This is a valid replay source when the original `/app/new` row returned `result=true`; extraction helpers must validate keys case-insensitively and must not reject such a source only because `applicationType` is absent.
   - Read the new full `ApplicationId` from `ResponseBody.value.applicationId`.
2. Optional `POST <api-base>/app/SetStatusWidgetDisplayed`
   - Body: send the same `apiKey` and the new `ApplicationId`.
   - Call this when the source `PublicApiLogs` flow has it, or when `SendOsagoApplication` from `New` fails with `No valid leaving transitions are permitted from state 'New' for trigger 'Filled'`.
   - Some Prod flows, including observed Ingos/BIP flow, reject this call from `New` with `No valid leaving transitions are permitted from state 'New' for trigger 'WidgetDisplayed'`. In that case, do not count the transition failure as a valid active attempt; continue with the direct source flow when it is known to be `New -> SendOsagoApplication -> SendToInsurers`.
3. `POST <api-base>/app/SendOsagoApplication`
   - Body: start from the cached/source `SendOsagoApplication.RequestBody`.
   - Replace `applicationId` with the new `ApplicationId`.
   - Keep the source `apiKey`.
   - If `policyParameters.policyStartDate` is earlier than current date + 1 day in `+03:00`, replace it with current date + 1 day in the same JSON date format; `SendOsagoApplication` rejects same-day starts.
   - Preserve questionnaire blocks such as `carData`, `owner`, `drivers`, `previousPolicy`, `consents`, and `hasDriversRestriction`.
4. `POST <api-base>/app/SendToInsurers`
   - Body: send the same `apiKey` and the new `ApplicationId`.

After every API call, verify the corresponding `PublicApiLogs` row by exact new `ApplicationId`, URL, and response code. If `New` or `SendOsagoApplication` returns validation errors, report the error and move to the next source application. Validation failures caused by corrupted replay payloads are invalid attempts, not insurer-negative active results.

After writing or updating a replay-ready cache entry, decode every cached `requestBodyBase64Utf16Le` locally before relying on it again. For JSON public API bodies, parse the decoded text and verify at minimum that `SendOsagoApplication` contains `applicationId`, `carData`, `owner`, `drivers`, and `policyParameters.policyStartDate`. If decoding/parsing fails, mark the entry `invalid` with `corrupted_payload` instead of reporting it as `working`.

### Polling and retries

After `SendToInsurers`, poll the target insurer log table for the new `ApplicationId` every 30 seconds for up to 5 minutes. Record whether the insurer produced a positive exact signal, a parameter-present negative value, a normal non-pool response, an insurer error, or no response.

Retry rules:

- If any valid source attempt reproduces a positive true pool signal, stop trying additional source questionnaires and continue to offer verification/business handling.
- If a source questionnaire does not produce a positive true pool signal, repeat the full API sequence with the next source `ApplicationId`; parameter-present negative values (`false`, `0`, empty, or `null`) count as no signal.
- Maximum attempts per insurer when positive pool signal does not come: 3 valid controlled source questionnaires. This is a cap to avoid trying dozens of known-pool source questionnaires while searching for one that still makes the insurer return a positive pool signal.
- Count an attempt as valid only when `New`, `SendOsagoApplication`, and `SendToInsurers` succeeded and the target insurer was actually polled by the new `ApplicationId` (or no-response was documented after polling). `New`-only applications, failed status transitions, validation errors, corrupted payloads, and unrelated live traffic do not count toward the 3 non-reproducing attempts.
- If positive pool signal is reproduced before 3 attempts, do not run the remaining attempts. If positive pool signal is not reproduced and fewer than 3 valid attempts are possible because cache/source discovery or payload extraction is blocked, report the active check as not passed or partial with the exact blocker.
- If all valid cached attempts fail to reproduce a positive pool signal, collect the latest target insurer responses, analyze whether the response has no pool flag, a false/null flag, validation/insurer errors, or no insurer response, update the cache result, and continue to dynamic DB source discovery.
- After cached attempts fail, dynamically discovered sources get their own non-reproducing-attempt cap. Try newly found sources until the first positive pool signal or until 3 valid newly found attempts have not reproduced it; if fewer than 3 are possible, report the exact source-discovery or payload blocker.
- If all valid dynamically discovered attempts fail to reproduce a positive pool signal after cache fallback and source expansion, collect the latest target insurer responses for the new applications, analyze the reason, update the cache result, and mark the check as not passed for that insurer.
- Some insurers do not return the pool flag in Dev. Treat this as a reported limitation only after 3 valid non-reproducing attempts fail to produce a positive pool signal.

### Mandatory self-check after positive signal

After any fresh active run reproduces a positive pool signal, verify every item below before reporting `passed` or caching the source as `working`:

1. `New` succeeded and the new full `ApplicationId` was read from the API response.
2. `SendOsagoApplication` succeeded for that same full `ApplicationId`.
3. `SendToInsurers` succeeded for that same full `ApplicationId`.
4. The target approved-scope insurer log table has rows for the exact new `ApplicationId`, or a no-response result is documented after the polling window.
5. The positive pool signal is the insurer-specific exact true signal from this reference, not a broad keyword match or a negative/null value.
6. Core `Offers` has the target offer for the exact new `ApplicationId` and exact `InsurerId`.
7. Core handling matches the business rule for the insurer, including Alfa/Gelios/Soglasie required-cross exceptions and Ugoria lifecycle exception.
8. Cache update is complete: source status/result is updated, new working source is saved only after success, and replaced/stale sources are marked.

If any item fails, do not report `passed`; map the result to `failed_offer_handling`, `blocked_insurer_no_response`, `blocked_api_validation`, or `manual_check_required` as appropriate.

### Prod safety rules

For Prod active checks:

- Use only `references/active-source-cache.prod.json`.
- Never read Test cache entries as Prod sources and never write Prod source data into the Test cache.
- Do not include raw request bodies, API keys, personal data, or cached questionnaire bodies in reports, Tracker comments, screenshots, or public artifacts.
- Always report the full new `ApplicationId`, full source `ApplicationId`, cache file used, and exact `InsurerId`; never shorten GUIDs.
- Stop source attempts after the first positive pool signal; do not send extra Prod applications once the needed positive signal is reproduced.
- If the selected API base and DB environment do not match, stop and report `manual_check_required`.

## Ingosstrakh Deep Check

Ingosstrakh can be missed by broad keyword search because the positive pool signal may not contain literal `pool` or `reinsurance`.

- Positive signal: `/partner/osago/agreement/create` response has `warnings` with `уровень 10`.
- Non-positive signal: the same warning field contains `Базовый уровень`.
- Expected Core handling for the positive signal: exact Ingos `InsurerId=AEB63341-4C3B-4C05-BE2D-F0BC5A4B5E71`, `OfferTypeId=4`, reject/fail status such as `OfferStatusTypeId=3`.
- A normal approved offer such as `OfferTypeId=1`, `OfferStatusTypeId=5` means the active replay did not reproduce the pool condition.
- Observed Prod active flow can be direct `New -> SendOsagoApplication -> SendToInsurers`; `SetStatusWidgetDisplayed` may be invalid for this flow. Follow the source `PublicApiLogs` sequence.
- If the first Ingos active attempt returns `Базовый уровень`, continue with the next exact-positive source until the first positive pool signal, or until 3 valid non-reproducing attempts are completed, or until source availability blocks further attempts.

## False Positive Traps

- Alfa often returns `reinsurance:false` and `reinsurance_message:null`; broad search will match it.
- Energogarant often returns `is_reinsurance:false`; broad search will match it.
- Intouch/Renis often return `isReinsurance:null` and `isExtraPool:null`.
- Pari can return `reinsurance:false`.
- Zetta can return `DoReinsure:false`.
- Soglasie XML often contains the OSAGO reinsurance parameter with `<result>0</result>`.
- Sber XML broad `LIKE '%reinsurance%true%'` can match unrelated booleans.
- Rosgosstrakh broad Russian `пул` can match unrelated product text such as `популярные` or upsale descriptions; this is not a pool signal.
- Ugoria `lineOfBusiness = "Переход"` is not pool; it is a change-insurer business line.
- Words like `reinsurance` or `pool` can appear in method names, descriptions, null fields, false flags, or optional parameters.

## Offer Verification

For every exact true signal, verify the target insurer offer in core DB by `ApplicationId` and exact `InsurerId`.

Expected results:

- Normal pool case: target offer must be declined, usually `OfferStatusTypeId = 3`, often with pool-related `OfferTypeId` such as `4`.
- Alfa exception: approved status `5` or `6` is valid only when required cross exists: `UpsaleType = 4` and `IsOptional = 0`.
- Gelios exception: approved status `5` or `6` is valid only when required cross exists: `UpsaleType = 3` and `IsOptional = 0`.
- Soglasie exception: a pool questionnaire may be approved only when there is an imputed/required cross. If Soglasie returns a positive pool signal and there is no required cross on the offer, the expected handling is decline. Treat approval without the required cross as suspicious/bug.
- Reso exception: `Calculate2Response` with `<ns2:Commission>0.0</ns2:Commission>` may be approved only when the voluntary cross is converted to required/mandatory. In Core this must be verified as Reso required cross `UpsaleType = 16` and `IsOptional = 0`. Treat approval without the required cross as suspicious/bug; if the required cross is absent, expected handling is decline.
- Ugoria exception: if `data.return.category IN ('R','R1','M')` appears only after the user selected the offer, an already approved/selected Ugoria offer is expected and must not be reported as a pool-handling bug.
- Missing target offer, non-decline without a valid exception, or optional-only cross for an exception is suspicious/bug.

In Test/Dev, cross-database read-only verification from log DB to `InsappCore.dbo.Offers`, `InsappCore.dbo.Insurers`, and `InsappCore.dbo.Upsales` can avoid manually copying large GUID lists. If `query_plan` fails with `SHOWPLAN permission denied`, note it and run the bounded read-only SELECT when safe.

## High-Risk Tables

`VskLogs`, `RenessansLogs`, and `SoglasieLogs` are large. Always filter by date on Prod.

`AstroVolgaLogs` on Prod may timeout because useful columns are not indexed. Treat this as a manual DB check when live tools cannot complete it.

## Report Shape

```markdown
## Pool check - ENV, exact period

### Scope
- DBs, period, insurer scope, absent/manual tables

### Broad search
- table / broad matches / application count / false-positive notes

### Exact true signals
- insurer / true-signal count / first signal / last signal

### Active reproduction
- insurer / mode (`active-only`, `explicit passive+active`, or `release report+active`) / source origin (`replay-ready cache`, `legacy cache upgraded`, or `dynamic DB discovery`) / attempted source search windows / valid attempt number / source ApplicationId / new ApplicationId / ApiKeyId / API sequence used / policyStartDate change / pool signal found / offer result / last insurer response summary
- invalid attempts not counted: source ApplicationId / new ApplicationId if any / failed API step / exact error / why it does not count
- mandatory self-check: API calls / target insurer log / exact positive signal / Core offer by exact `InsurerId` / business handling / cache update
- source cache file used (`active-source-cache.test.json` or `active-source-cache.prod.json`) and updates: added/upgraded/used/status changes (`working`, `needsRefresh`, `stale`, `invalid`), `lastResult`, stale/invalid reason, replacement search status, `lastPositiveAt`, and `lastPositiveNewApplicationId`; do not include raw cached request bodies in the report

### Offer verification
- insurer / checked applications / expected handling / OK / suspicious / missing offers

### Bugs or risks
- full ApplicationId / insurer / signal / offer status / reason

### Final status
- one of `passed`, `failed_pool_not_reproduced`, `failed_offer_handling`, `blocked_no_source`, `blocked_api_validation`, `blocked_insurer_no_response`, `manual_check_required`

### No data / manual checks
- tables with no exact true signals during explicit passive checks, no cached/dynamically discovered source found before timeout/unsafe plan, active attempts exhausted, or blocked checks
```

## Report Site Publication

After every pool check/run, publish exactly one consolidated result into the dedicated local site repository. A run means one requested skill execution for one target environment. If the same run continues with rule corrections, helper fixes, cache updates, or active replay after an earlier blocker, update the same report/snapshot instead of creating another report row.

Do not publish, commit, push, or call the report final while planned active reproduction is still running or pending for any insurer in scope. Finish every planned active target first: either reproduce a positive exact pool signal and verify Core handling, exhaust the 3-valid-attempt non-reproducing cap, or record a strict blocker. Only then update the one consolidated report and cache snapshot for the run.

- Site repository path: `C:\Users\nikit\projects\pool-reinsurance-reports`.
- Expected GitHub Pages URL after push/pages setup: `https://nikitkafas87-ai.github.io/pool-reinsurance-reports/`.
- Site tabs:
  - `ДЭВ отчеты`: check reports for Dev and Test/Dev-with-Test-DB.
  - `ПРОД отчеты`: check reports for Prod.
  - `ДЭВ кеш`: sanitized cache snapshots for Dev/Test.
  - `ПРОД кеш`: sanitized cache snapshots for Prod.

### Required output files per check

For every completed, failed, or blocked check/run, create or update two sanitized HTML files:

1. Check report:
   - Dev/Test path: `reports/dev/YYYY-MM-DD-HHMM-<short-slug>/index.html`.
   - Prod path: `reports/prod/YYYY-MM-DD-HHMM-<short-slug>/index.html`.
2. Cache snapshot:
   - Dev/Test path: `cache/dev/YYYY-MM-DD-HHMM-<short-slug>/index.html`.
   - Prod path: `cache/prod/YYYY-MM-DD-HHMM-<short-slug>/index.html`.

The check report must include the whole picture for the run: environment, DB names, cache file used, full insurer scope checked, source origin, attempted source search windows, source `ApplicationId`, new full `ApplicationId`, API sequence, valid/invalid attempts, positive signal result, mandatory self-check result, offer verification, final status, bugs/risks, blockers, and cache updates. Do not split the same run into separate reports such as "partial", "rule correction", or "helper fixed"; merge those facts into the one run report.

The cache snapshot must be sanitized and include only safe cache metadata: alias, status, source `ApplicationId`, source signal date, log table, signal pattern name, `InsurerId`, `lastUsedAt`, `lastResult`, `lastPositiveAt`, `lastPositiveNewApplicationId`, stale/invalid reason, and short notes. Do not include raw request bodies, base64 questionnaire bodies, API keys, personal data, or full cached `flow`.

### Manifest updates

Update `data/reports.json` after writing the report. Add or replace one row in `dev` or `prod` for the current run:

```json
{
  "date": "YYYY-MM-DD HH:mm",
  "environment": "Dev|Test|Prod",
  "title": "Pool check - ENV - short summary",
  "slug": "YYYY-MM-DD-HHMM-short-slug",
  "href": "reports/dev/YYYY-MM-DD-HHMM-short-slug/",
  "insurers": "Soglasie, Alfa",
  "status": "passed",
  "summary": "short result without raw personal data"
}
```

Update `data/cache.json` after writing the cache snapshot. Add or replace one row in `dev` or `prod` for the current run:

```json
{
  "date": "YYYY-MM-DD HH:mm",
  "environment": "Dev|Test|Prod",
  "title": "Cache snapshot - ENV - short summary",
  "slug": "YYYY-MM-DD-HHMM-short-slug",
  "href": "cache/dev/YYYY-MM-DD-HHMM-short-slug/",
  "alias": "Soglasie",
  "status": "working",
  "lastResult": "safe short result"
}
```

Always update `updatedAt` in both manifests when their content changes. Before committing, verify the index does not contain multiple rows for the same run/environment. If intermediate rows were created during the run, remove those manifest entries and delete their specific obsolete `index.html` files from git; do not delete whole folders as cleanup.

### Git requirements

After creating report/snapshot files and updating manifests:

1. Verify `index.html` can read the manifests and show the new row. A local static check of file existence and JSON validity is required; browser verification is preferred when available.
2. Run `git status` in `C:\Users\nikit\projects\pool-reinsurance-reports`.
3. Stage the site changes.
4. Commit with a message like `Add pool check report YYYY-MM-DD HH:mm ENV`.
5. Push if a remote is configured and authentication works.

If remote, repository creation, push, or Pages setup is unavailable, still commit locally and report the exact blocker. Do not claim the public Pages URL is live until push and Pages verification succeed.

### Site safety

- Never publish raw cached request bodies, base64 questionnaire bodies, API keys, passwords, personal data, or full `flow`.
- Full `ApplicationId` and `InsurerId` are allowed and must not be shortened.
- Prod reports must not link to Test cache snapshots and Test reports must not link to Prod cache snapshots.
