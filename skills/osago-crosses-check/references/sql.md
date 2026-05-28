# SQL Reference

Use `InsappCoreProd`.

## Active OSAGO Keys Query

This returns active keys of active partners that should be treated as OSAGO keys.

```sql
SELECT TOP 1000
    p.PartnerId,
    p.Name AS PartnerName,
    p.FullName AS PartnerFullName,
    p.LegalFormId,
    ak.ApiKeyId,
    ak.ApiKey,
    ak.Description AS ApiKeyDescription,
    ak.SupportedProductTypesJson
FROM dbo.PartnerApiKeys ak
JOIN dbo.Partners p
    ON p.PartnerId = ak.PartnerId
WHERE p.IsActive = 1
  AND ak.IsActive = 1
  AND LTRIM(RTRIM(ak.SupportedProductTypesJson)) = N'[1]'
ORDER BY p.Name, ak.ApiKey;
```

## Crosses Query

This returns the full expected cross matrix for all active OSAGO keys of active partners. Missing `PartnerInsurerSettings` rows and missing `PartnerInsurerUpsaleSettings` rows are returned and must be counted as disabled.

```sql
WITH OsagoKeys AS (
    SELECT
        p.PartnerId,
        p.Name AS PartnerName,
        p.FullName AS PartnerFullName,
        p.LegalFormId,
        CASE p.LegalFormId
            WHEN 1 THEN N'Юридическое лицо'
            WHEN 2 THEN N'ИП'
            WHEN 3 THEN N'Физическое лицо'
            ELSE N'Не указано'
        END AS LegalFormName,
        ak.ApiKeyId,
        ak.ApiKey,
        ak.Description AS ApiKeyDescription,
        ak.SupportedProductTypesJson
    FROM dbo.PartnerApiKeys ak
    JOIN dbo.Partners p
        ON p.PartnerId = ak.PartnerId
    WHERE p.IsActive = 1
      AND ak.IsActive = 1
      AND LTRIM(RTRIM(ak.SupportedProductTypesJson)) = N'[1]'
),
ExpectedCrosses AS (
    SELECT *
    FROM (VALUES
        ('dd4408a7-4898-44d9-95b3-ea7ec3baefa7', N'Renis', 1, N'Ренессанс: Кросс (НС)'),
        ('adbd4ce5-8177-4fb0-aa9a-a22e6a9e884f', N'Gelios', 3, N'Гелиос: Практичное Каско'),
        ('cda9423c-a34d-4752-87d3-47defec5cb56', N'Alfa', 4, N'Альфа: КАСКОGO'),
        ('a024da77-63e1-4b3d-8ef8-423c71ea61d6', N'Rgs', 5, N'Росгосстрах: Подушка безопасности'),
        ('dd4408a7-4898-44d9-95b3-ea7ec3baefa7', N'Renis', 6, N'Ренессанс: КАСКО от бесполисных'),
        ('cda9423c-a34d-4752-87d3-47defec5cb56', N'Alfa', 7, N'Альфа: КАСКО от бесполисных'),
        ('cda9423c-a34d-4752-87d3-47defec5cb56', N'Alfa', 8, N'Альфа: КАСКО от чужих ошибок'),
        ('cda9423c-a34d-4752-87d3-47defec5cb56', N'Alfa', 9, N'Альфа: КАСКО за 3'),
        ('aeb63341-4c3b-4c05-be2d-f0bc5a4b5e71', N'Ingos', 10, N'Ингосстрах: АвтоНС+'),
        ('7ab8abdc-c8b1-49bb-9272-4247b3a16fd9', N'Sber', 11, N'Сбер: Автозащита'),
        ('aeb63341-4c3b-4c05-be2d-f0bc5a4b5e71', N'Ingos', 12, N'Ингосстрах: КАСКО Автозащита'),
        ('36583f16-235c-42d6-8fce-b04aa6459730', N'Vsk', 13, N'ВСК: КАСКО Компакт Минимум'),
        ('a024da77-63e1-4b3d-8ef8-423c71ea61d6', N'Rgs', 14, N'Росгосстрах: КАСКО от бесполисных'),
        ('25ea32f4-0337-45b7-8c9a-50d3d4a84471', N'Reso', 16, N'РЕСО: КАСКО Профи Ультралайт'),
        ('79c59d23-23dd-474f-911b-3e45ecef7faa', N'Pari', 17, N'ПАРИ: КАСКО smart'),
        ('fbcfd2d2-6722-4348-a1b3-b94d51491cbf', N'Soglasie', 18, N'Согласие: КАСКОЗащита+'),
        ('4bada4f8-3eb6-4372-be71-59591d37455c', N'Maks', 20, N'МАКС: Быстрокаско-1')
    ) v(InsurerId, InsurerAlias, UpsaleTypeId, UpsaleName)
),
PiusAgg AS (
    SELECT
        PartnerInsurerSettingId,
        UpsaleTypeId,
        MIN(CONVERT(nvarchar(36), InsurerUpsaleSettingsId)) AS InsurerUpsaleSettingsId,
        MIN(CAST(IsDisabled AS int)) AS CrossIsDisabled,
        MAX(CAST(IsPreSelected AS int)) AS IsPreSelected,
        MIN(UpsaleModeId) AS UpsaleModeId,
        COUNT(*) AS UpsaleSettingsRows
    FROM dbo.PartnerInsurerUpsaleSettings
    GROUP BY PartnerInsurerSettingId, UpsaleTypeId
)
SELECT TOP 5000
    ok.PartnerId,
    ok.PartnerName,
    ok.PartnerFullName,
    ok.LegalFormId,
    ok.LegalFormName,
    ok.ApiKeyId,
    ok.ApiKey,
    ok.ApiKeyDescription,
    ok.SupportedProductTypesJson,
    ec.InsurerId,
    ec.InsurerAlias,
    ec.UpsaleTypeId,
    ec.UpsaleName,
    pis.SettingsId AS PartnerInsurerSettingsId,
    ISNULL(pis.IsDisabled, 1) AS PartnerInsurerIsDisabled,
    pa.InsurerUpsaleSettingsId,
    ISNULL(pa.CrossIsDisabled, 1) AS CrossIsDisabled,
    CASE
        WHEN pis.SettingsId IS NOT NULL
         AND pa.InsurerUpsaleSettingsId IS NOT NULL
         AND pis.IsDisabled = 0
         AND pa.CrossIsDisabled = 0 THEN 1
        ELSE 0
    END AS EffectivelyEnabled,
    CASE
        WHEN pa.InsurerUpsaleSettingsId IS NOT NULL
         AND pa.CrossIsDisabled = 0
         AND pis.IsDisabled = 1 THEN 1
        ELSE 0
    END AS DisabledByParent,
    CASE WHEN pis.SettingsId IS NULL THEN 1 ELSE 0 END AS MissingInsurerSettings,
    CASE WHEN pis.SettingsId IS NOT NULL AND pa.InsurerUpsaleSettingsId IS NULL THEN 1 ELSE 0 END AS MissingCrossSettings,
    CASE
        WHEN pis.SettingsId IS NULL THEN N'СК не подключена: нет строки PartnerInsurerSettings'
        WHEN pis.IsDisabled = 1 THEN N'СК отключена: PartnerInsurerSettings.IsDisabled = 1'
        WHEN pa.InsurerUpsaleSettingsId IS NULL THEN N'Кросс отключен: нет строки PartnerInsurerUpsaleSettings'
        WHEN pa.CrossIsDisabled = 1 THEN N'Кросс отключен: PartnerInsurerUpsaleSettings.IsDisabled = 1'
        ELSE N'Кросс включен'
    END AS CrossStatusReason,
    ISNULL(pa.IsPreSelected, 0) AS IsPreSelected,
    pa.UpsaleModeId,
    ISNULL(pa.UpsaleSettingsRows, 0) AS UpsaleSettingsRows
FROM OsagoKeys ok
 CROSS JOIN ExpectedCrosses ec
LEFT JOIN dbo.PartnerInsurerSettings pis
    ON pis.ApiKeyId = ok.ApiKeyId
   AND pis.InsurerId = ec.InsurerId
LEFT JOIN PiusAgg pa
    ON pa.PartnerInsurerSettingId = pis.SettingsId
   AND pa.UpsaleTypeId = ec.UpsaleTypeId
ORDER BY ok.PartnerName, ok.ApiKey, ec.InsurerAlias, ec.UpsaleTypeId;
```

## Enable Existing Cross Rows

Use this pattern when the row already exists. Prefer filtering by `InsurerUpsaleSettingsId` after a read-back check.

```sql
BEGIN TRAN;

UPDATE dbo.PartnerInsurerUpsaleSettings
SET IsDisabled = 0
WHERE InsurerUpsaleSettingsId IN (
    -- full GUIDs here
);

SELECT TOP 100
    ak.ApiKey,
    ak.Description AS ApiKeyDescription,
    pis.SettingsId AS PartnerInsurerSettingsId,
    pius.InsurerUpsaleSettingsId,
    pius.UpsaleTypeId,
    pius.IsDisabled AS CrossIsDisabled,
    pius.IsPreSelected,
    pius.UpsaleModeId
FROM dbo.PartnerInsurerUpsaleSettings pius
JOIN dbo.PartnerInsurerSettings pis
    ON pis.SettingsId = pius.PartnerInsurerSettingId
JOIN dbo.PartnerApiKeys ak
    ON ak.ApiKeyId = pis.ApiKeyId
WHERE pius.InsurerUpsaleSettingsId IN (
    -- same full GUIDs here
);

-- COMMIT;
-- ROLLBACK;
```
