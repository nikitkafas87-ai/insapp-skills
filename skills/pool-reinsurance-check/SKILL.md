---
name: pool-reinsurance-check
description: Check OSAGO/KASKO reinsurance pool handling across insurer logs, generated offers, and active Public API reproduction. Use when validating pool test cases, searching for new pool-like insurer signals, creating fresh applications to trigger insurer requests, comparing generated offers, checking Dev/Test/Prod pool regressions, or preparing pool QA reports from Insapp log/core databases.
---

# Pool Reinsurance Check

Use this skill for reinsurance pool verification across insurer logs, generated offers, and active Public API reproduction.

## Inputs

- Environment: Dev, Test, or Prod. If the user asks for Dev and no separate Dev DB is available, use Test DBs and say that assumption.
- Release/check date/time or period. For Prod release checks, the release date and time is required: passive log review must analyze logs strictly from that release timestamp through today, and active reproduction is needed when no positive exact true pool signal is found in that post-release log window. A present pool/reinsurance parameter with `false`, `0`, empty, or `null` value is not a positive signal and must not block active reproduction. For Dev/Test passive log review, default to the last 14 days ending today if the user does not specify a period. For active reproduction source discovery, search exact true signals across all available history first; if it times out or the plan is unsafe, retry with a one-month date filter.
- Insurer/test-case scope: all existing insurer log tables in the selected log DB unless the user narrows it. The 12 pool test-case insurers are the core business scope, but broad discovery must also cover additional insurer tables from the reference.
- DB access: log DB plus core/offers DB.

## Workflow

1. Determine DB names:
   - Test: `InsappLogTest`, `InsappCoreTest`.
   - Dev without a separate DB: `InsappLogTest`, `InsappCoreTest`.
   - Prod: `InsappLogProd`, `InsappCoreProd`.
2. Read `references/pool-rules.md` before writing SQL.
3. Call DB glossary/schema first. Verify actual insurer log tables in the selected log DB; do not query remembered tables that are absent.
4. Set an explicit date filter. For Prod release checks, use the specified release date/time as the lower bound for all passive broad and exact log searches. Use timezone in DateTimeOffset filters, usually `+03:00`. In reports, write the exact absolute period.
5. Run broad keyword search across all existing insurer log tables before exact matching. Never skip this; new pool signals can appear without notice.
6. Run exact true-signal search from the reference. Separate positive true signals from parameter-present-but-negative matches: `false`, `0`, empty, and `null` mean no positive pool signal.
7. For every found source/application pair, verify the target offer in core DB by exact `InsurerId`. Cross-database read-only SELECT is acceptable when available.
8. For active reproduction requests, or for insurers with no positive exact true signal in the active-check window from `references/pool-rules.md`, run the active workflow. Do this even when the response contains a pool/reinsurance parameter whose value is negative (`false`, `0`, empty, or `null`):
   - find up to 3 historical source applications with exact true pool signals for the same insurer; source discovery is all-time first, with one-month fallback only on timeout or unsafe plan;
   - extract the source `PublicApiLogs` method sequence and full request bodies; for MCP/PowerShell/JSON-over-JSON transport, transfer `RequestBody` as base64 of `CONVERT(varbinary(max), RequestBody)` and decode locally as UTF-16LE;
   - clone each source through the source-specific Public API sequence: `New`, optional `SetStatusWidgetDisplayed` only when the source flow uses it or `SendOsagoApplication` requires it, `SendOsagoApplication`, and `SendToInsurers`;
   - count only valid controlled attempts: successful `New`, successful `SendOsagoApplication`, successful `SendToInsurers`, and either target insurer logs after polling or a documented no-response; `New`-only, validation failures, status-transition failures, corrupted payloads, and unrelated live traffic do not count;
   - poll the target insurer log every 30 seconds for up to 5 minutes per valid cloned application;
   - default to 3 valid attempts per insurer when active is required; if fewer attempts are possible, report the exact blocker instead of calling the active check complete.
9. Apply business rules:
   - pool signal normally means Insapp should decline the offer;
   - Alfa and Helios are exceptions where pool plus required cross can be approved;
   - pool without required handling is a bug.
10. Produce a report with the full insurer-table scope, broad-search result, exact true-signal result, active reproduction attempts, invalid attempts that were not counted, offer verification, suspected bugs, and skipped/manual checks.

If live DB tools are unavailable, prepare exact SQL and mark the check blocked rather than inventing results. If `query_plan` fails on cross-database offer verification because of `SHOWPLAN permission denied`, note the limitation and continue with a read-only SELECT only if the SQL is bounded and safe.

## References

Read `references/pool-rules.md` for insurer IDs, log tables, exact true-signal patterns, known false positives, offer verification rules, timeout risks, and report shape.
