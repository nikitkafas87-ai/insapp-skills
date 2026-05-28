---
name: autotest-review
description: Review, design, write, and improve automated tests in the autotests project, especially C#/NUnit/Selenium UI tests, API-mocking tests, frontend regression tests, and OSAGO landing tests. Use when asked to create a new autotest, review an autotest, refactor a test, assess coverage, stabilize flaky tests, validate mocks/assertions/selectors/waits/screenshots, or extract reusable lessons into the autotest review skill.
---

# Autotest Review

## Project Context

- Default workspace: `C:\Users\nikit\projects\autotests`.
- Main OSAGO UI test project: `OsagoSeleniumTests`.
- Active OSAGO autotest branch: `codex/osago-autotests`; GitHub default branch: `main`.
- Expected OSAGO Selenium test classes after consolidation: `LandingOsagoTest`, `BadgesOnOffersTest`, `KbmReportOnOffersTest`, `GetOsagoReportProlongationTest`, `SpecialLandingAgreementsTest`, `TBankCommunicationLinkAgreementsTest`.
- Stack: C# / .NET 10 / NUnit 4 / Selenium WebDriver / ChromeDriver.
- Common packages: `Microsoft.NET.Test.Sdk`, `NUnit3TestAdapter`, `Selenium.Support`, `DotNetSeleniumExtras.WaitHelpers`, `Newtonsoft.Json`.
- Existing durable project context lives in `memory/MEMORY.md`; for OSAGO Selenium details, read `memory/project_osago_autotest.md`.
- For the current OSAGO autotest standard, read `memory/project_osago_autotest_standard.md` before writing or refactoring tests.
- For non-trivial work, create or update `journals/YYYY-MM-DD-short-task-name/log.md` before coding.

## Core Workflow

1. Read project context first: `AGENTS.md`, relevant `memory/`, current journal, changed test files, and nearby existing tests.
2. Identify the test intent in one sentence: user-facing behavior, API contract, or regression being protected.
3. Review against the checklist below before editing. If the user asked only for review, do not edit files.
4. If writing or refactoring a test, keep the test focused and deterministic, then run the narrowest meaningful command.
5. Record durable lessons in this skill only when they are reusable for future autotest work. Put temporary details in the task journal.

## Git Workflow For Autotests

- Keep one active integration branch for OSAGO autotests: `codex/osago-autotests`. Use short task branches only for isolated experiments, then consolidate the finished test into the integration branch.
- When the user asks to "push AT/autotests to git", treat it as a request to use the standard OSAGO autotest git workflow: work from `codex/osago-autotests`, inspect status first, bring only the required autotest source changes into that branch, verify, commit, and push `origin codex/osago-autotests`.
- Start every git cleanup by checking `git status --short --branch`, recent branches, and untracked `*Test.cs` files. Do not switch branches while useful uncommitted test files are at risk.
- For branch cleanup, keep only `main` and `codex/osago-autotests` on GitHub unless the user explicitly wants another active branch. Old branches such as `codex/kbm-report-autotest`, `codex/third-calculation-dev-only`, `codex/redesign-badges-autotest`, `codex/merge-badges-to-main`, and `master` are obsolete after consolidation if they reappear.
- Before deleting branches, verify with `git branch -r`, `git ls-remote --heads origin`, and `git branch --merged origin/codex/osago-autotests` when applicable. Delete remote branches only after confirming the useful test code exists in `codex/osago-autotests` and the user asked for deletion.
- Local branches can be blocked by git worktrees. Check `git worktree list`; for obsolete worktree-held branches, first run `git status --short --branch` inside the worktree, then `git switch --detach HEAD` there, then delete the branch from the main workspace. Do not delete whole worktree folders as cleanup.
- After branch/worktree cleanup, recheck the active workspace with `git status --short --branch`. If old branch contents appear as local modifications, inspect the diff and restore only the unintended files with `git restore --worktree -- <file>`.
- Commit only source files needed for the autotest: `*.cs`, project config, reusable helpers, focused fixtures, and intentional `.gitignore` updates. Do not commit local screenshots, reports, downloaded files, `bin/`, `obj/`, `.playwright-mcp/`, `.mcp.json`, task journals, or local memory files.
- After adding or consolidating autotests, run `dotnet build OsagoSeleniumTests\OsagoSeleniumTests.csproj` and `dotnet test OsagoSeleniumTests\OsagoSeleniumTests.csproj --list-tests` sequentially, not in parallel, because both commands can write the same `obj\Debug\net10.0\OsagoSeleniumTests.dll` and create a false file-lock failure. Run live E2E tests only when that evidence is explicitly needed.
- Keep commits readable for a tester: one behavior per commit when possible, or one consolidation commit when collecting already-reviewed tests from several branches.
- Never store GitHub tokens in remote URLs. Use a normal repository URL and let Git Credential Manager handle authentication.

## Writing Workflow

1. Clarify or infer the protected behavior from the user prompt, URL, Tracker issue, screenshots, or existing manual test notes.
2. Prefer extending nearby tests and helpers over creating a new framework shape.
3. Reuse existing config fields from `appsettings.json`; add new config only when the scenario cannot be expressed by existing data.
4. Use Selenium waits for meaningful UI state: URL changes, visible component boundaries, enabled controls, cards rendered, buttons clickable, or expected text present/absent.
5. Use JS click only for known Angular controls that are unreliable with native click; keep normal WebDriver interactions where they work.
6. Keep assertions close to the component under test and include diagnostic messages naming the field/card/source being checked.
7. Save screenshots only when they help diagnose the scenario or serve as UI evidence; name them predictably.
8. Run the narrowest useful command after edits, normally the target test or project-level test run if filtering is unavailable.
9. After every successfully written or updated autotest, ask the user for the Tracker issue number if it was not already provided. Record the implementation result in that issue, and update the issue description when the implemented scope or acceptance details need to be actualized.
10. When a UI test validates live API submission, assert both the outgoing request contract and a successful backend response (`2xx`, domain `result=true` when applicable). Log only concise request summaries for payloads that contain personal data.

## Russian Test Results And Diagnostics

- User-facing autotest output must be readable in Russian: class names shown in Test Explorer, NUnit test method names, `TestCaseData.SetName(...)`, scenario `Name`, `[STEP N]` logs, setup logs, screenshot step captions when printed, and assertion/failure diagnostics.
- Keep technical contract names unchanged inside Russian text: API methods (`GetOffers`, `CreateKbmReport`, `GetKbmReport`, `GetOsagoReport`, `SendOsagoApplication`), JSON fields (`requestId`, `previousPolicy`, `insurerType`), CSS selectors, enum values, URLs, and environment variables such as `SELENIUM_HEADLESS`.
- Prefer names like `ОСАГО_КБМ_0_99_показывает_скидку_один_процент` or `ОСАГО_Пролонгация_без_endDate_не_показывает_UI_пролонгации`; avoid mixed English verbs such as `shows`, `hides`, `does_not_call`, `should`, `must`, `did not`.
- For parameterized cases, make the visible NUnit result Russian via `new TestCaseData(scenario).SetName($"ОСАГО_..._{scenario.Name}")`; keep `scenario.ToString()` returning `Name` so logs and screenshots use the same scenario identity.
- After renaming tests or classes, run `dotnet test OsagoSeleniumTests\OsagoSeleniumTests.csproj --list-tests` and inspect the printed names. Fix awkward duplicates like `ОСАГО_КБМ_КБМ_...` before running the full suite.
- Failure messages should explain the broken behavior in Russian and still name the checked source (`DOM`, `API mock`, `GetOffers`, `SendOsagoApplication`) so a tester can understand the result without reading code.

## Standard OSAGO Autotest Template

Use this structure for new OSAGO autotests and when touching existing ones:

1. **Intent:** one test protects one behavior. Put the behavior in the method name, not only in comments.
2. **Environment guard:** DEV-only tests must use `DevEnvironmentGuard.AssertDevUrl(...)` before browser navigation. Full e2e payment/application flows must never be able to run on PROD by changing `appsettings.json`; if they read config, explicitly load `TestConfig.Load("Test")` or an equivalent DEV-only config before navigation, then assert the URL with `DevEnvironmentGuard`.
3. **Categories:** mark tests with reusable constants from `TestCategories`:
   - `Dev` for DEV-only tests;
   - `E2E` for live end-to-end flows;
   - `Frontend` for UI rendering checks;
   - `MockedApi` for frontend tests with mocked backend responses.
4. **Setup:** create Chrome driver, waits, JS executor, and `ScreenshotHelper.EnsureDirectory()` in `SetUp`; quit and dispose driver in `TearDown`.
   New Selenium autotests should run Chrome headless by default and allow visible browser mode only by explicit configuration, matching `KbmReportOnOffersTest`: use a helper like `ChromeOptionsFactory.Create()`, default to `--headless=new` with a fixed `--window-size=1920,1080`, and let `SELENIUM_HEADLESS=false` switch to `--start-maximized` for local debugging.
5. **Screenshots:** use `ScreenshotHelper.SaveViewport(...)` for normal step evidence and `ScreenshotHelper.SaveFullPage(...)` when the page can extend below the viewport. Screenshot prefix must identify the test area, for example `landing_...` or `badges_...`.
6. **Data placement:**
   - `appsettings.json`: environment URLs and reusable form input data;
   - fixtures/JSON near the test: large mocked API responses;
   - constants/records inside the test: expected values that define the assertion contract;
   - environment variables/CI secrets: credentials, tokens, and private data.
7. **Steps:** write visible `[STEP N]` logs for long UI flows; keep helper methods private and named by UI intent.
8. **Waits:** wait for URL, visible element, enabled control, rendered cards, or expected text. Avoid arbitrary sleeps except for known UI autocomplete focus issues; keep those local and commented.
9. **Assertions:** assert the exact observable contract and include failure messages with the field/card/source (`GetOffers`, DOM, config, URL). Live full e2e flows must end with explicit assertions for every promised artifact, for example both payment link and draft policy link; do not rely on logging or `NullReferenceException` as the final check.
10. **Verification:** after edits run `dotnet build`; run `dotnet test --list-tests` or a narrow test filter. Run live e2e only when explicitly useful because it can create DEV applications and wait on insurer responses.
    For a full post-git-cleanup regression, run:
    `$env:SELENIUM_HEADLESS='true'; dotnet test OsagoSeleniumTests\OsagoSeleniumTests.csproj --logger "console;verbosity=normal" --logger "trx;LogFileName=osago-autotests-full-run.trx"`
    Expected consolidated suite size is about 27 NUnit cases across the 6 OSAGO Selenium test classes; recheck with `--list-tests` after adding `TestCaseSource` cases. TRX goes under `OsagoSeleniumTests\TestResults\` and is ignored by git.

## OSAGO Selenium Defaults

- Test environment base URL: `https://test-landing-osago.insapp.ru/`.
- Production base URL: `https://landing-osago.insapp.ru/`.
- Every Selenium test class should create Chrome through `ChromeOptionsFactory.Create()`. Default mode is headless because `SELENIUM_HEADLESS` unset/true adds `--headless=new` and `--window-size=1920,1080`; use `SELENIUM_HEADLESS=false` only for local visual debugging.
- Treat the landing as an Angular SPA with floating-label/custom controls.
- Common fragile controls:
  - brand options are `button[role='option']`;
  - year and power options often need `Actions.MoveToElement().Click()`;
  - checkboxes and switches often need JS click;
  - download links implemented as `href="javascript:void(0)"` can require native Selenium `Click()` because JS click may not trigger the browser download user gesture;
  - address input may require Tab from the previous passport-date field and `SwitchTo().ActiveElement()`.
- After the initial calculate action, allow long waits because captcha or backend processing can delay `/form`.
- Insurer responses in test can be unstable; prefer mocked API responses when the goal is frontend rendering rather than live insurer integration.
- Angular pages can re-render inputs after waits. For live UI assertions that combine several element states, re-query elements inside the wait condition and fetch final element references after the condition passes to avoid stale-element and pre-render snapshots.

## Review Checklist

- **Scope:** The test protects one clear behavior. It does not mix unrelated backend configuration, frontend rendering, and data setup unless that is the actual integration risk.
- **Determinism:** External dependencies are controlled. Use mocks for unstable insurer/partner responses when the goal is frontend rendering.
- **Assertions:** Assert the exact observable contract: counts, text, order, styles, state, request calls, and absence where relevant. Avoid "contains somewhere on page" when the component boundary is known.
- **Selectors:** Prefer stable component/test selectors or narrow CSS within the target card/component. Avoid broad XPath over the whole page when a local DOM scope exists.
- **Waits:** Wait for meaningful state, not arbitrary sleeps. Timeouts must be scoped and justified.
- **Mock Fidelity:** Mock only fields needed by the frontend plus required shape fields. Keep IDs full-length and JSON structurally close to real responses.
- **Ordering:** If backend order matters, assert array equality in order. If order should not matter, assert as an unordered set explicitly.
- **Negative Cases:** Include empty/absent data scenarios when the UI must suppress elements, not only happy paths. For absence checks in Angular UI, use a short bounded wait for the forbidden element/text to appear, then fail if it appears; avoid a single immediate DOM snapshot when rendering can lag.
- **Boundary Cases:** Include minimal boundary values that reveal UI behavior, for example `0/1/2/3` items or rating `4/4.4/4.5/4.6`.
- **Style/UI Checks:** When validating visual API-driven style, compare computed CSS (`getComputedStyle`) rather than raw inline strings. Assert element count before style checks so a count mismatch is reported explicitly instead of silently skipping computed-style assertions behind a length guard.
- **Screenshots:** For UI evidence, use full-page screenshots when content can extend below viewport.
- **Diagnostics:** Failure messages should name the insurer/card/field and expected source (`GetOffers`, DOM, DB, etc.).
- **Isolation:** Tests must not depend on live success from many insurers/partners unless the task is specifically live integration coverage.
- **Artifacts:** Keep generated screenshots and reports named predictably. Do not delete broad folders as cleanup.

## Project-Specific Guidance

- For OSAGO offers-page frontend tests driven by mocked APIs, mirror the `GetOsagoReportProlongationTest` architecture instead of using flat parameter lists:
  - keep the main happy path as one explicit `[Test]` with a named `PositiveScenario`;
  - put negative and boundary variants into `[TestCaseSource]` and return `TestCaseData` via a `ScenarioCase(...)` helper with stable scenario names;
  - model inputs and expected outcomes with a sealed scenario record, for example `KbmScenario` or `ProlongationScenario`, and override `ToString()` to return `Name`;
  - keep flow helpers private and scenario-oriented: `InstallApiMocks(scenario)`, `OpenOffersPage()`, `WaitForOffers(...)`, `Assert...State(...)`, `AssertApiCalls(scenario)`, `TakeScreenshot(...)`;
  - use a unified JS mock registry: `window.__insappMockCounts`, `window.__insappMockLastRequests`, `window.__insappMockBodies`; mock names should be stable lower-camel-case keys such as `getKbmReport`, `getOffers`, `sendOsagoApplication`;
  - when `GetOffers` is polled, return a pending response first and a complete response on later calls if that matches frontend behavior;
  - screenshots should use the feature prefix style, for example `getosagoreport_*` or `getkbmreport_*`.
- For live OSAGO offers/enrichment tests, use the same scenario shell instead of one-off flow code:
  - keep live URLs and expected contracts in a `Live...Scenario` or `Live...TestData` record near the test; do not scatter URLs through helpers;
  - install API capture before navigation and join chained enrichment calls by `requestId` when the UI depends on `Create*`/`Get*` pairs;
  - put `DevEnvironmentGuard.AssertDevUrl(actualOffersUrl, context)` inside the navigation helper, usually `OpenOffersPage`, so every path guards the real URL being opened;
  - find parent offer cards by stable insurer identity first, then assert badges/buttons/text inside that card; do not include the expected child state in the parent-card lookup;
  - for live badge checks, assert the full visible contract per card: badge title, computed `color` and `background-color` from `BadgeTypeSettings.Style`, rating presence, and normalized priority/order when relevant;
  - use shared `ScreenshotHelper` methods for evidence instead of ad hoc CDP screenshot code.
- For OSAGO badge frontend tests on the base DEV landing, mock `GetOffers`; do not derive expected badges from `GetApiKeySettings` when that endpoint returns a stub.
- Badge rendering uses `offer.badges[]`: DOM `.badge` text comes from `title`, styling comes from `style`, and current frontend rendering does not use `type` for display.
- For badges, check per offer card:
  - card is found by stable insurer marker or insurer title/logo alt;
  - `.badge` count equals the mocked `badges[]` length;
  - texts match in the same order as `badges[]`;
  - computed `color` and `background-color` match the mocked `style`;
  - empty `badges: []` creates no `.badge` in that card.
- Rating is separate from badges. Check `.rating-value` against `insurerRating`, 5 `.bs-rating-star` elements, active-star count, visible star glyphs, and computed color difference between active and inactive stars when both states are present.
- Current rating behavior rounds active stars to nearest integer with `.5` upward; keep boundary coverage if ratings are relevant.
- `GetOsagoReport` on the offers page drives prolongation behavior: mock `CreateOsagoReport` and `GetOsagoReport`, then assert the active-policy alert, recommended policy start date (`endDate + 1`) in the UI and `SendOsagoApplication.policyParameters.policyStartDate`, every `SendOsagoApplication.previousPolicy` field built from `osagoData` (`series`, `number`, `issueDate`, `endDate`, `insurerType`, `insurerName`), and the single `Продлить` button on the offer whose `insurerType` matches `osagoData.insurerType`.
- For `GetOsagoReport` coverage, keep the full valid-prolongation path as one explicit positive test and put negative/boundary variants into `TestCaseSource` so each scenario is a separate NUnit result. Cover at minimum: `CreateOsagoReport.result=false`, successful create without `requestId`, `GetOsagoReport.result=false`, `osagoData=null`, `forProlongation=false`, missing `endDate`, `endDate > 59 days`, mismatched `insurerType`, and expired `endDate`. For each case assert API calls, alert presence/absence, `policyStartDate` behavior, `previousPolicy` presence/fields, and `Продлить` button presence/absence.
- For `GetKbmReport` coverage, include the same create/report chain breakpoints: `CreateKbmReport.result=false` and successful `CreateKbmReport` without `requestId` must not call `GetKbmReport` and must keep the KBM block hidden.
- For live special landing agreement tests, model every landing as a scenario record and assert the scenario contract before browser work: expected visible checkboxes, agreement links, and the full `SendOsagoApplication` agreement field set (`InsappUserAgreement`, `InsappMarketingAgreement`, `PartnerUserAgreement`, `PartnerMarketingAgreement`). Include fixed `clientId`/cache diagnostics in failures because these tests depend on live DEV cached data.

## Improving This Skill

When a new autotest exposes a reusable lesson, update this skill in the same task:

- Add concise, durable guidance only.
- Prefer one bullet in the relevant section over a long narrative.
- Do not add one-off bug details, temporary URLs, run logs, or investigation notes.
- Validate the skill after substantial changes with `quick_validate.py`.
