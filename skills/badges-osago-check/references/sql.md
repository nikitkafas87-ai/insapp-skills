# SQL for Badges OSAGO Check

Database: `InsappCoreProd`

Default audits must discover the ApiKey list from production DB. Include only:

- active API keys: `PartnerApiKeys.IsActive = 1`
- active partners: `Partners.IsActive = 1`
- OSAGO-only product support: `PartnerApiKeys.SupportedProductTypesJson = N'[1]'`

Do not ask the user for an ApiKey list unless they explicitly request a custom audit.

## Eligible Keys

Run this query when you need to inspect the discovered default key set or save the complete partner-name input for the report generator as `names.json`.

```sql
SELECT
    pak.ApiKey,
    p.Name AS PartnerName,
    p.LegalFormId,
    CASE p.LegalFormId
        WHEN 1 THEN N'Юридическое лицо'
        WHEN 2 THEN N'ИП'
        WHEN 3 THEN N'Физическое лицо'
        ELSE N'Не указано'
    END AS LegalFormName
FROM PartnerApiKeys pak
JOIN Partners p ON p.PartnerId = pak.PartnerId
WHERE pak.IsActive = 1
  AND p.IsActive = 1
  AND pak.SupportedProductTypesJson = N'[1]'
ORDER BY p.Name, pak.ApiKey;
```

## Badge Rows

Save the result as `badges.json`.

```sql
WITH eligible_keys AS (
    SELECT
        pak.ApiKeyId,
        pak.ApiKey,
        p.Name AS PartnerName,
        p.LegalFormId,
        CASE p.LegalFormId
            WHEN 1 THEN N'Юридическое лицо'
            WHEN 2 THEN N'ИП'
            WHEN 3 THEN N'Физическое лицо'
            ELSE N'Не указано'
        END AS LegalFormName
    FROM PartnerApiKeys pak
    JOIN Partners p ON p.PartnerId = pak.PartnerId
    WHERE pak.IsActive = 1
      AND p.IsActive = 1
      AND pak.SupportedProductTypesJson = N'[1]'
),
badges AS (
    SELECT
        ek.ApiKey,
        ek.PartnerName,
        ek.LegalFormId,
        ek.LegalFormName,
        bt.Name AS BadgeName,
        CASE WHEN i.Alias = 'AlfaDec' THEN i.Name + N' (ДЭК)' ELSE i.Name END AS InsurerName
    FROM eligible_keys ek
    JOIN PartnerBadgeSetting pbs ON pbs.ApiKeyId = ek.ApiKeyId
    JOIN BadgeTypeSettings bts ON bts.PartnerBadgeSettingId = pbs.PartnerBadgeSettingId
    JOIN BadgeTypes bt ON bt.Id = bts.BadgeTypeId
    JOIN BadgeSettings bs ON bs.PartnerBadgeSettingId = pbs.PartnerBadgeSettingId
    JOIN Insurers i ON i.InsurerId = bs.InsurerId
    WHERE bts.Enabled = 1
      AND bt.Name IN ('APay', 'BestService', 'LoyalInsurer', 'UserChoice')
      AND (
          (bt.Name = 'APay'         AND bs.IsAlfaPayInsurer = 1)
       OR (bt.Name = 'BestService'  AND bs.IsBestService = 1)
       OR (bt.Name = 'LoyalInsurer' AND bs.IsLoyalInsurer = 1)
       OR (bt.Name = 'UserChoice'   AND bs.IsRecomendedInsurer = 1)
      )

    UNION ALL

    SELECT
        ek.ApiKey,
        ek.PartnerName,
        ek.LegalFormId,
        ek.LegalFormName,
        'UsersInsurer' AS BadgeName,
        NULL AS InsurerName
    FROM eligible_keys ek
    JOIN PartnerBadgeSetting pbs ON pbs.ApiKeyId = ek.ApiKeyId
    JOIN BadgeTypeSettings bts ON bts.PartnerBadgeSettingId = pbs.PartnerBadgeSettingId
    JOIN BadgeTypes bt ON bt.Id = bts.BadgeTypeId
    WHERE bts.Enabled = 1
      AND bt.Name = 'UsersInsurer'
)
SELECT * FROM badges
ORDER BY ApiKey, BadgeName, InsurerName;
```

## Partner Names

Run this for every discovered eligible ApiKey, including keys with no badge rows. Save the result as `names.json`.

```sql
SELECT
    pak.ApiKey,
    p.Name AS PartnerName,
    p.LegalFormId,
    CASE p.LegalFormId
        WHEN 1 THEN N'Юридическое лицо'
        WHEN 2 THEN N'ИП'
        WHEN 3 THEN N'Физическое лицо'
        ELSE N'Не указано'
    END AS LegalFormName
FROM PartnerApiKeys pak
JOIN Partners p ON p.PartnerId = pak.PartnerId
WHERE pak.IsActive = 1
  AND p.IsActive = 1
  AND pak.SupportedProductTypesJson = N'[1]'
ORDER BY p.Name, pak.ApiKey;
```

## Active Status

Run this for the same discovered eligible ApiKey set. Save the result as `active.json`. Include `p.LegalFormId` and the same `LegalFormName` mapping used in the key/name queries; the legal-form fields are required for report filtering and grouping.

```sql
SELECT
    pak.ApiKey,
    CASE WHEN pak.IsActive = 1 THEN N'Да' ELSE N'Нет' END AS KeyActive,
    CASE WHEN p.IsActive = 1 THEN N'Да' ELSE N'Нет' END AS PartnerActive
FROM PartnerApiKeys pak
JOIN Partners p ON p.PartnerId = pak.PartnerId
WHERE pak.IsActive = 1
  AND p.IsActive = 1
  AND pak.SupportedProductTypesJson = N'[1]'
ORDER BY p.Name, pak.ApiKey;
```

## Custom ApiKey Audit

Use this only when the user explicitly asks to audit a provided ApiKey list. Replace the `__API_KEYS__` placeholder with a comma-separated quoted ApiKey list:

```sql
'key1', 'key2', 'key3'
```

Then add this condition to the default queries:

```sql
AND pak.ApiKey IN (__API_KEYS__)
```
