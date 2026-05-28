# Pool Reinsurance Rules

## Known Insurer IDs

Use exact `InsurerId` values for offer verification. Never filter insurers by alias text.

| TC | Insurer | InsurerId |
|---|---|---|
| 1 | SOGAZ | `7A8251FF-2F25-4E7B-8CF6-9C377D5A10E9` |
| 2 | Ingosstrakh | `AEB63341-4C3B-4C05-BE2D-F0BC5A4B5E71` |
| 3 | Alfa | `CDA9423C-A34D-4752-87D3-47DEFEC5CB56` |
| 4 | VSK | `36583F16-235C-42D6-8FCE-B04AA6459730` |
| 5 | Gelios | `ADBD4CE5-8177-4FB0-AA9A-A22E6A9E884F` |
| 6 | Renessans | `DD4408A7-4898-44D9-95B3-EA7EC3BAEFA7` |
| 7 | Soglasie | `FBCFD2D2-6722-4348-A1B3-B94D51491CBF` |
| 8 | Sber | `7AB8ABDC-C8B1-49BB-9272-4247B3A16FD9` |
| 9 | Absolut | `1F836F31-CF6A-4324-B513-462D4DBEA401` |
| 10 | AstroVolga | `F889BE53-9D60-40B1-97D7-261F4CE66D9C` |
| 11 | Sovcom | `896D23D9-D567-43B6-B752-80857077A05F` |
| 12 | Energogarant | `0AD811E1-724B-4502-BFDD-CCE6D0D1ECA5` |

Verify IDs from DB when using a new environment or a non-listed insurer.

## Log Tables

First call `schema(log_db)` and use only tables that exist in the selected DB. As of the recovered workflow and Dev/Test checks, useful insurer log tables include:

`SogazLogs`, `IngosLogs`, `AlfaLogs`, `VskLogs`, `GeliosLogs`, `RenessansLogs`, `SoglasieLogs`, `SberLogs`, `AbsolutLogs`, `AstroVolgaLogs`, `SovcomLogs`, `EnergogarantLogs`, `TinkoffLogs`, `ResoLogs`, `ZettaLogs`, `MaksLogs`, `InTouchLogs`, `RosgosstrahLogs`, `GaideLogs`, `PariLogs`, `SpasskieVorotaLogs`, `UgoriaLogs`.

`OskLogs` exists in older memory but may be absent in `InsappLogTest`; do not query it unless schema confirms it.

## Date Periods

- Use the exact user period when provided.
- For Prod release checks, the release date and time is required. Passive broad search and exact true-signal search must analyze logs strictly from that release timestamp through today; do not include pre-release logs in the verdict.
- If no positive exact true pool signal exists in the Prod post-release passive log window, run active reproduction. A parameter that exists with a negative value (`false`, `0`, empty, or `null`) is no positive signal and must not block active reproduction. If a Prod release check has no release date/time, ask for it or mark the Prod check blocked; do not silently substitute the last 14 days or the last 2 days.
- For Dev/Test with no period, default passive log review to the last 14 days ending today.
- For active reproduction source discovery, search the same insurer for exact true signals across all available history without a date filter.
- If all-time source discovery times out, `query_plan` shows a heavy scan on a large table, or the DB tool cannot safely execute it, retry with a one-month date filter and state this fallback in the report.
- Use timezone in DateTimeOffset literals, usually `+03:00`.
- Always report exact absolute period boundaries.

## Broad Search

Run broad search across all existing insurer log tables before exact matching:

- `ResponseBody LIKE N'%reinsurance%'`
- `RequestBody LIKE N'%reinsurance%'`
- `ResponseBody LIKE N'%reinsur%'`
- `RequestBody LIKE N'%reinsur%'`
- Russian "perestrah" substring in `ResponseBody` and `RequestBody` using the actual Cyrillic text from local logs.
- `ResponseBody LIKE N'%pool%'`
- `RequestBody LIKE N'%pool%'`

Broad matches are not verdicts. They must be inspected or classified by exact true/false patterns.

## Exact True Signals

Use these exact true patterns first:

- Absolut: `ResponseBody LIKE N'%"reinsurance":"true"%'` or `N'%"reinsurance":true%'`.
- Alfa: `ResponseBody LIKE N'%"reinsurance":true%'`.
- Gelios: `ResponseBody LIKE N'%"isReinsured": true%'` or `N'%"isReinsured":true%'`.
- Ingosstrakh: OSAGO agreement create can return pool/reinsurance through warning level 10, without a literal `pool`/`reinsurance` flag. Treat as positive only on the OSAGO agreement response:
  `Url LIKE N'%/partner/osago/agreement/create%' AND ResponseBody LIKE N'%"warnings"%' AND ResponseBody LIKE N'%уровень 10%'`.
  Verify new/changed Ingos patterns against Core offers: expected handling is `OfferTypeId=4` and reject/fail status. `Базовый уровень` in the same warning field is not a positive pool signal.
- Energogarant: `ResponseBody LIKE N'%"is_reinsurance":true%'`.
- InTouch/Renessans style: `ResponseBody LIKE N'%"isReinsurance": true%'` or `N'%"isReinsurance":true%'`; also check `isExtraPool` the same way.
- Maks: OSAGO response can contain escaped XML field `re=Y`. Treat as positive when the response contains:
  `ResponseBody LIKE N'%&lt;re>Y&lt;/re>%'`.
  Verify against Core offers: expected handling is `OfferTypeId=4` and reject/fail status.
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

Treat `false`, `0`, empty strings, `null`, missing values, and Soglasie `<result>0</result>` as no positive pool signal. The parameter may be present, but only the insurer-specific true value from the exact rules above counts as a positive signal.

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

Use active reproduction when the user asks to create fresh applications, or when Prod release passive log analysis from the specified release date/time through today has no positive exact true pool signal. If the response only contains a pool/reinsurance parameter with `false`, `0`, empty, or `null`, active reproduction is still required. Active reproduction source discovery is always all-time first; only limit it to one month when all-time search times out, has an unsafe plan, or cannot be safely executed.

### Source selection

1. Run source discovery for the same insurer across all available history. Prefer the newest distinct `ApplicationId` values with exact true signals.
2. If all-history search is unsafe or times out, repeat source discovery for the last month and write `all-time search was limited to one month` in the report.
3. If no exact true source application is found even with the allowed fallback, report active reproduction as blocked for that insurer.
4. Select up to 3 source applications. Skip a source only when there is no usable `PublicApiLogs` `SendOsagoApplication` request body or no API key can be recovered.
5. Never use broad-search-only matches as source applications. A source must match the insurer's exact true-signal pattern.
6. If exact source discovery times out but Core has recent reinsurance offers for the exact `InsurerId`, use Core-offer assisted triage only to find candidates for log inspection:
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
   ORDER BY Created DESC;
   ```
   Then inspect the insurer log by exact `ApplicationId` and document the real insurer-side positive signal. Do not treat a Core offer alone as an exact source signal until the matching log signal is identified or already documented in this reference.

### Public API data extraction

Find the questionnaire and method sequence from `PublicApiLogs` by source `ApplicationId`:

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

When extracting full `RequestBody` through MCP/PowerShell or another JSON-over-JSON transport, use base64 over plain text to preserve Cyrillic and document fields. `PublicApiLogs.RequestBody` is `nvarchar`; encode it as `CONVERT(varbinary(max), RequestBody)` and decode as UTF-16LE locally:

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

Do not rely on `export_excel` for active replay payloads unless the exported file is locally accessible and inspected. MCP can write Excel files to the MCP server temp directory, which may not be reachable from the local shell. If the body is round-tripped as plain text and then reserialized, `SendOsagoApplication` can fail with false validation errors on Cyrillic names, birth dates, passport fields, or driver license fields.

Use the selected environment API base. Known Test base from logs is `http://test-api.insapp.pro`; for other environments derive the matching base from existing `PublicApiLogs` or the environment configuration. Prod logs can contain `http://api.insapp.ru`, while local direct POST may require `https://api.insapp.ru`; if HTTP returns method/routing errors such as 405 on `/app/new`, retry HTTPS and verify the resulting `PublicApiLogs` rows. Do not mix API base, log DB, and core DB from different environments.

### API sequence

For each source application, call the methods in the source-specific order recovered from `PublicApiLogs`. Do not hard-code `SetStatusWidgetDisplayed` for every source.

1. `POST <api-base>/app/new`
   - Body: reuse the source `New` body when available; otherwise send the minimum compatible OSAGO new-application body with the source `apiKey`.
   - Required top-level keys observed in logs: `apiKey`, `productType`, `applicationType`, `channelType`, `clientId`, `localTime`, `sessionId`, `successPaymentUrl`, `utm`.
   - Read the new full `ApplicationId` from `ResponseBody.value.applicationId`.
2. Optional `POST <api-base>/app/SetStatusWidgetDisplayed`
   - Body: send the same `apiKey` and the new `ApplicationId`.
   - Call this when the source `PublicApiLogs` flow has it, or when `SendOsagoApplication` from `New` fails with `No valid leaving transitions are permitted from state 'New' for trigger 'Filled'`.
   - Some Prod flows, including observed Ingos/BIP flow, reject this call from `New` with `No valid leaving transitions are permitted from state 'New' for trigger 'WidgetDisplayed'`. In that case, do not count the transition failure as a valid active attempt; continue with the direct source flow when it is known to be `New -> SendOsagoApplication -> SendToInsurers`.
3. `POST <api-base>/app/SendOsagoApplication`
   - Body: start from the source `SendOsagoApplication.RequestBody`.
   - Replace `applicationId` with the new `ApplicationId`.
   - Keep the source `apiKey`.
   - If `policyParameters.policyStartDate` is earlier than current date + 1 day in `+03:00`, replace it with current date + 1 day in the same JSON date format; `SendOsagoApplication` rejects same-day starts.
   - Preserve questionnaire blocks such as `carData`, `owner`, `drivers`, `previousPolicy`, `consents`, and `hasDriversRestriction`.
4. `POST <api-base>/app/SendToInsurers`
   - Body: send the same `apiKey` and the new `ApplicationId`.

After every API call, verify the corresponding `PublicApiLogs` row by exact new `ApplicationId`, URL, and response code. If `New` or `SendOsagoApplication` returns validation errors, report the error and move to the next source application. Validation failures caused by corrupted replay payloads are invalid attempts, not insurer-negative active results.

### Polling and retries

After `SendToInsurers`, poll the target insurer log table for the new `ApplicationId` every 30 seconds for up to 5 minutes. Record whether the insurer produced a positive exact signal, a parameter-present negative value, a normal non-pool response, an insurer error, or no response.

Retry rules:

- If the first source questionnaire does not produce a positive true pool signal, repeat the full API sequence with the next source `ApplicationId`; parameter-present negative values (`false`, `0`, empty, or `null`) count as no signal.
- Maximum/default attempts per insurer: 3 valid controlled source questionnaires when active is required.
- Count an attempt as valid only when `New`, `SendOsagoApplication`, and `SendToInsurers` succeeded and the target insurer was actually polled by the new `ApplicationId` (or no-response was documented after polling). `New`-only applications, failed status transitions, validation errors, corrupted payloads, and unrelated live traffic do not count toward the 3 attempts.
- If fewer than 3 valid attempts are possible because source discovery or payload extraction is blocked, report the active check as partial/blocked with the exact blocker.
- If all 3 valid attempts fail, collect the latest target insurer responses for the new applications, analyze whether the response has no pool flag, a false/null flag, validation/insurer errors, or no insurer response, and include that analysis in the report.
- Some insurers do not return the pool flag in Dev. Treat this as a reported limitation only after the 3-attempt active reproduction fails.

## Ingosstrakh Deep Check

Ingosstrakh can be missed by broad keyword search because the positive pool signal may not contain literal `pool` or `reinsurance`.

- Positive signal: `/partner/osago/agreement/create` response has `warnings` with `уровень 10`.
- Non-positive signal: the same warning field contains `Базовый уровень`.
- Expected Core handling for the positive signal: exact Ingos `InsurerId=AEB63341-4C3B-4C05-BE2D-F0BC5A4B5E71`, `OfferTypeId=4`, reject/fail status such as `OfferStatusTypeId=3`.
- A normal approved offer such as `OfferTypeId=1`, `OfferStatusTypeId=5` means the active replay did not reproduce the pool condition.
- Observed Prod active flow can be direct `New -> SendOsagoApplication -> SendToInsurers`; `SetStatusWidgetDisplayed` may be invalid for this flow. Follow the source `PublicApiLogs` sequence.
- If the first Ingos active attempt returns `Базовый уровень`, continue with the next exact-positive source until 3 valid attempts are completed or source availability blocks further attempts.

## False Positive Traps

- Alfa often returns `reinsurance:false` and `reinsurance_message:null`; broad search will match it.
- Energogarant often returns `is_reinsurance:false`; broad search will match it.
- InTouch/Renessans often return `isReinsurance:null` and `isExtraPool:null`.
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
- Helios exception: approved status `5` or `6` is valid only when required cross exists: `UpsaleType = 3` and `IsOptional = 0`.
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
- insurer / valid attempt number / source ApplicationId / new ApplicationId / ApiKeyId / API sequence used / policyStartDate change / pool signal found / offer result / last insurer response summary
- invalid attempts not counted: source ApplicationId / new ApplicationId if any / failed API step / exact error / why it does not count

### Offer verification
- insurer / checked applications / expected handling / OK / suspicious / missing offers

### Bugs or risks
- full ApplicationId / insurer / signal / offer status / reason

### No data / manual checks
- tables with no exact true signals, active attempts exhausted, one-month fallback usage, or blocked checks
```
