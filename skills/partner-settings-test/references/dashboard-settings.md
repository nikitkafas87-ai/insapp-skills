# Dashboard Partner Settings Reference

## Source Journals

- `journals/2026-04-30-partner-settings-test/log.md`
- `journals/2026-05-04-partner-settings-test/log.md`
- `journals/2026-05-05-sk-vendors-test/log.md`
- `journals/2026-05-05-sk-inside-settings/log.md`
- `journals/2026-05-06-kv-settings/log.md`
- `journals/2026-05-04-bug-reports-settings-ui/log.md`

## Verified Areas

- Main settings: status, text fields, toggles, dropdowns, products.
- Priority insurer settings: priority insurer, behavior type, timeout.
- Limits: `limitsJson` plus individual fields.
- Prolongation: prolongation, email notifications, SMS notifications.
- Email and branding.
- Badges and gifts.
- AlfaId settings, paid services, policy start reminders, enrichment disabling, request costs, AlfaId JSON.
- SK/Vendors table.
- Internal SK settings: toggles, credentials, upsale/cross-product settings.
- KV settings by TZ.

## SK/Vendors Mapping

External table endpoint:

`POST /api/PartnerApiKey/{apiKeyId}/PartnerInsurerSettings`

| UI | API | DB | Logic |
|---|---|---|---|
| ВКЛ/ВЫКЛ | `isEnabled` | `IsDisabled` | inverse |
| Рассрочка | `installmentsEnabled` | `InstallmentsDisabled` | inverse |
| Новое API | `usesNewApi` | `UsesNewApi` | direct |
| Продажа в пул | `reinsuranceEnabled` | `ReinsuranceEnabled` | direct |
| Продажа в пул без кроссов | `reinsuranceWithoutUpsalesEnabled` | `ReinsuranceWithoutUpsalesEnabled` | direct |
| 901 канал для РГС | `channel1Enabled` | `Channel1Enabled` | direct |
| 905 канал для РГС | `channel2Enabled` | `Channel2Enabled` | direct |

Hidden fields sent automatically:

- `pkaskoEnabled` -> `PkaskoDisabled`, inverse.
- `pampaduEnabled` -> `PampaduDisabled`, inverse/null default.

## Internal SK Settings

Internal endpoint:

`PUT /api/PartnerApiKey/{apiKeyId}/PartnerInsurerSettings`

The body is the full state for one insurer. `upsaleSettings: []` means no changed cross-products; it does not delete existing rows.

Credentials fields:

- `login`, `login2`
- `password`, `password2`
- `insurerPartnerId`, `insurerPartnerId2`, `insurerPartnerId3`

Upsale DB table: `PartnerInsurerUpsaleSettings`.

UpsaleMode:

| ID | Name | UI |
|---|---|---|
| 1 | `RequiredReinsurance_NoneCommon` | Вменённый для пула |
| 2 | `RequiredReinsurance_OptionalCommon` | Вменённый для пула, опциональный для обычного предложения |
| 3 | `OptionalReinsurance_OptionalCommon` | Опциональный для пула и для обычного предложения |
| 4 | `NoneReinsurance_OptionalCommon` | Опциональный для обычного предложения |

## SQL Patterns

```sql
SELECT pis.SettingsId, pis.InsurerId, pis.IsDisabled, pis.InstallmentsDisabled,
  pis.UsesNewApi, pis.PkaskoDisabled, pis.PampaduDisabled,
  pis.ReinsuranceEnabled, pis.ReinsuranceWithoutUpsalesEnabled,
  pis.Channel1Enabled, pis.Channel2Enabled, pis.ProductTypeId,
  i.Name as InsurerName
FROM PartnerInsurerSettings pis
JOIN Insurers i ON i.InsurerId = pis.InsurerId
WHERE pis.ApiKeyId = 'API-KEY-GUID'
ORDER BY i.Name;
```

## Bug Reporting

For every bug report include:

- environment;
- URL/page;
- exact UI element;
- request method, endpoint, payload field;
- DB table/column;
- expected vs actual;
- whether original values were restored.

