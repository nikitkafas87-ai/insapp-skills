---
name: pool-reinsurance-check
description: Check OSAGO/KASKO reinsurance pool handling across the approved insurer log scope, generated offers, and active Public API reproduction. Use when validating pool test cases, searching for new pool-like insurer signals, creating fresh applications to trigger insurer requests, comparing generated offers, checking Dev/Test/Prod pool regressions, or preparing pool QA reports from Insapp log/core databases.
---

# Pool Reinsurance Check

Use this skill for reinsurance pool verification across insurer logs, generated offers, and active Public API reproduction.

## Inputs

- Environment: Dev, Test, or Prod. If the user asks for Dev and no separate Dev DB is available, use Test DBs and say that assumption.
- Check mode. Default mode is active reproduction only: do not spend time/tokens on passive broad log review unless the user explicitly asks for passive analysis, a release report, or a recent-log check. When passive analysis is explicitly requested, limit the freshness window to the last 2 days ending now unless the user gives a stricter period. A present pool/reinsurance parameter with `false`, `0`, empty, or `null` value is not a positive signal unless an insurer-specific exact rule says otherwise, for example Reso `Calculate2` response `<ns2:Commission>0.0</ns2:Commission>`.
- Insurer/test-case scope: the fixed approved insurer scope only: `Absolut`, `Alfa`, `AlfaDec`, `astrovolga`, `Energogarant`, `Gelios`, `Ingos`, `Intouch`, `Maks`, `Renis`, `Reso`, `Rgs`, `Sber`, `Sogaz`, `Soglasie`, `Sovkom`, `Tinkoff`, `Ugoria`, `Vsk`, `Zetta`, `BSO`, `Pari`. Do not query or report other insurer log tables unless the user explicitly changes this skill/reference scope first.
- Active reproduction source cache: before searching DB for source applications to clone, read the environment-specific cache file: `references/active-source-cache.test.json` for Test and Dev-with-Test-DB checks, or `references/active-source-cache.prod.json` for Prod. Cache entries have statuses: `working`, `needsRefresh`, `stale`, `invalid`. Try up to 3 usable cached questionnaires for the insurer alias, newest successful first. If cached replay stops producing a positive pool signal, updating that cache entry as `stale`/non-reproducing is mandatory before continuing with dynamic source discovery. If only legacy source metadata exists, try to upgrade it once by exact `ApplicationId`; if that is impossible, continue with dynamic source discovery.
- Report site: after every skill run/check for a target environment, generate exactly one sanitized HTML report and exactly one cache snapshot in `C:\Users\nikit\projects\pool-reinsurance-reports`, update the site manifests, and commit the site changes to git. Use Dev/Test tabs for Dev-with-Test-DB/Test checks and Prod tabs for Prod checks. Do not publish intermediate reports for partial progress, rule corrections, helper fixes, or follow-up checks inside the same run/thread; update the same run report and cache snapshot so the index shows one consolidated picture. Do not finalize, commit, or push the report until all active reproduction targets for the run are completed, exhausted by the 3-valid-attempt cap, or mapped to a strict blocker.
- DB access: log DB plus core/offers DB.

## Workflow

1. Determine DB names:
   - Test: `InsappLogTest`, `InsappCoreTest`.
   - Dev without a separate DB: `InsappLogTest`, `InsappCoreTest`.
   - Prod: `InsappLogProd`, `InsappCoreProd`.
2. Read `references/pool-rules.md` before writing SQL. Read the selected environment cache file before active source discovery: `references/active-source-cache.test.json` for Test/Dev-with-Test-DB, `references/active-source-cache.prod.json` for Prod.
3. Call DB glossary/schema first. Verify actual log tables for the approved insurer scope in the selected log DB; use only the approved table map from `references/pool-rules.md`. If an approved table is absent, mark it absent/manual. Do not query non-approved insurer log tables just because they exist in schema or older memory.
4. Set explicit date filters for any DB work. Passive freshness checks, when explicitly requested, use the last 2 days ending now. Source discovery starts with the last 14 days and expands dynamically until sources are found or query timeouts/unsafe plans prevent more expansion. Use timezone in DateTimeOffset filters, usually `+03:00`. In reports, write every absolute period used.
5. Skip passive broad keyword search by default. Run broad keyword search across approved-scope log tables only when the user explicitly asks for passive analysis/release report/recent-log check. Source discovery should use exact true-signal patterns, not broad-only matches.
6. Run exact true-signal search from the reference for passive checks and source discovery. Separate positive true signals from parameter-present-but-negative matches: `false`, `0`, empty, and `null` mean no positive pool signal unless the exact insurer rule explicitly defines that value as positive, for example Reso `Commission=0.0`.
7. For every found source/application pair, verify the target offer in core DB by exact `InsurerId`. Cross-database read-only SELECT is acceptable when available.
8. Run the active workflow by default unless the user explicitly asks for passive-only analysis:
   - first check the selected environment cache file for replay-ready questionnaire data for the insurer alias; try `working` entries first, then `needsRefresh`, newest successful first, up to 3 usable cached questionnaires; skip `stale` and `invalid` entries except as history;
   - if cached replay is valid but no longer produces a positive pool signal, update the cache entry as stale/non-reproducing, including `lastUsedAt`, `lastResult`, `staleSince`, `staleReason`, and `replacementSearchStartedAt`, then run dynamic DB source discovery in the same check;
   - if there is no replay-ready cache entry, find up to 3 historical source applications with exact true pool signals for the same insurer; start with the last 14 days, then expand the period dynamically until sources are found or query timeouts/unsafe plans block safe expansion;
   - stop source attempts immediately after the first positive pool signal is reproduced; do not run 3 attempts when cache or any new source already produced a positive pool signal;
   - after stale/non-reproducing cache, run dynamic source discovery and try newly found source questionnaires one by one; the 3-attempt limit applies only when positive pool signal does not come, as a cap on non-reproducing valid attempts;
   - if no cached or dynamically discovered positive exact source application exists before timeouts/unsafe plans block expansion, mark the check as not passed for that insurer instead of calling it complete;
   - save a newly found source as `working` in the selected environment cache only after it successfully reproduces a positive pool signal in a fresh active run and passes the mandatory self-check; never write Test sources into the Prod cache or Prod sources into the Test cache;
   - keep at most 3 `working` entries per insurer alias in each environment cache; when a new working source is added, mark older excess working entries as `needsRefresh` instead of deleting them;
   - when extracting the source `PublicApiLogs` method sequence and full request bodies, use `scripts/extract_public_api_flow.py` first; it calls the DB MCP directly, transfers `RequestBody` as chunked base64 of `CONVERT(varbinary(max), RequestBody)`, decodes locally as UTF-16LE, and validates JSON without manual copying;
   - after extraction, use `scripts/replay_public_api_flow.py` for controlled replay from the recovered flow when active reproduction is needed; store replay payloads in the cache in a format that can be reused even if log DB rows are later cleaned;
   - clone each source through the source-specific Public API sequence: `New`, optional `SetStatusWidgetDisplayed` only when the source flow uses it or `SendOsagoApplication` requires it, `SendOsagoApplication`, and `SendToInsurers`;
   - count only valid controlled attempts: successful `New`, successful `SendOsagoApplication`, successful `SendToInsurers`, and either target insurer logs after polling or a documented no-response; `New`-only, validation failures, status-transition failures, corrupted payloads, and unrelated live traffic do not count;
   - poll the target insurer log every 30 seconds for up to 5 minutes per valid cloned application;
   - after a positive pool signal is reproduced, run the mandatory self-check: API sequence succeeded, target insurer log exists by exact new `ApplicationId`, positive signal is insurer-specific and exact, Core offer exists by exact `InsurerId`, and business handling matches rules;
   - if no positive pool signal comes, stop after 3 valid non-reproducing attempts per insurer; if fewer attempts are possible, or if no positive pool signal can be reproduced, return a strict result status instead of calling the active check complete.
9. Apply business rules:
   - pool signal normally means Insapp should decline the offer;
   - Alfa, Gelios, Soglasie, and Reso are exceptions where pool plus required cross can be approved;
   - for Soglasie, a pool questionnaire may be approved only when there is an imputed/required cross; without that cross, the expected result is decline;
   - for Reso, `Calculate2` pool by `Commission=0.0` may be approved only when the existing voluntary cross is converted to required/mandatory; without that required cross, the expected result is decline;
   - pool without required handling is a bug.
10. Produce a report only after the active work for the requested environment is complete. The report must include the full approved insurer-table scope, strict final status, active reproduction attempts, mandatory self-check result, source cache usage/updates, invalid attempts that were not counted, offer verification, suspected bugs, and skipped/manual checks. Include passive broad/exact results only when passive analysis was explicitly requested. If one insurer fails to reproduce after 3 valid attempts, keep checking the remaining planned insurers before publishing the consolidated result.
11. Publish the check result to the pool report site:
   - create or update one sanitized HTML report under `reports/dev/` or `reports/prod/` for the current run/environment;
   - create or update one sanitized cache snapshot under `cache/dev/` or `cache/prod/` for the current run/environment;
   - update `data/reports.json` and `data/cache.json`;
   - keep only the consolidated report/snapshot entry for the run in the manifests; do not leave partial/intermediate entries in the index;
   - verify the site index renders the new row;
   - commit the changes in the site git repository and push when a remote is configured.

If live DB tools are unavailable, prepare exact SQL and mark the check blocked rather than inventing results. If `query_plan` fails on cross-database offer verification because of `SHOWPLAN permission denied`, note the limitation and continue with a read-only SELECT only if the SQL is bounded and safe.

## References

Read `references/pool-rules.md` for insurer IDs, log tables, exact true-signal patterns, known false positives, offer verification rules, timeout risks, and report shape.
