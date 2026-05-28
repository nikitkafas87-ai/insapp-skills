---
name: partner-settings-test
description: Use when testing test-dashboard.insapp.ru partner API key settings, dashboard settings tabs, SK/Vendors, internal insurer settings, KV settings, UI/API/DB mappings, restore checks, or regression reports for partner settings.
metadata:
  short-description: Test dashboard partner settings
---

# Partner Settings Test

Use this skill for dashboard partner API-key settings work: UI testing, API/DB mapping, restore checks, bug reports, and regression reports.

Recovered source: latest `partner-settings-test` from Claude file-history plus project journals from 2026-04-30 through 2026-05-06.

## Start

1. Read project `AGENTS.md` and the relevant journal before live work.
2. Create or continue a journal for non-trivial testing.
3. Identify environment, partner, `partnerId`, `apiKeyId`, target tab/page, and whether live UI/API/DB access is available.
4. Capture initial state from DB/API before changing anything.
5. Test through UI, intercept request payloads when possible, verify API and DB, then restore original state.

## Core Workflow

- Settings page: `/main/partners/{partnerId}/api-key/{apiKeyId}`.
- SK/Vendors page: `/main/partners/{partnerId}/api-key/{apiKeyId}/insurers`.
- Internal SK page: `/main/partners/{partnerId}/api-key/{apiKeyId}/insurers/{settingsId}`.
- Main settings save uses PUT-like settings flow; SK/Vendors external table uses POST; internal SK settings use PUT.
- Always compare UI label, API field, DB column, logic direction, request payload, DB after save, and restored DB.

## Dashboard Pitfalls

- Angular tabs and some toggles may ignore programmatic click. Prefer native browser/Playwright click when regular evaluate/locator click does not trigger state.
- Spinbuttons are safer to reset with the UI clear button than Ctrl+A/Backspace.
- `null` in DB often displays as enabled/default in UI/API; verify mapping before filing a bug.
- Saving SK/Vendors redirects back to API-key cards; navigate again before the next SK/Vendors check.
- Do not leave API keys or insurer settings changed after a test.

## References

- Read `references/dashboard-settings.md` for tab coverage, SK/Vendors mapping, internal SK mapping, and journal source list.
- For latest task-specific context, prefer live journals over old Claude instructions.

