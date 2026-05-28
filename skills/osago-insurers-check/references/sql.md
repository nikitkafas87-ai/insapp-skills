# SQL Reference

Use `InsappCoreProd`.

## Active OSAGO Keys

`LegalFormId` and `LegalFormName` are required output fields. The report must use them for legal-form grouping and filtering.

`PartnerInsurerSettingsProductTypeId` is required in the matrix output. The report maps `1` to `ОСАГО`, `2` to `КАСКО`, and `3` to `Ипотека` in the detailed PIS product column.

```sql
SELECT
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

## OSAGO Insurer Matrix

This returns the full expected key × insurer matrix for all active OSAGO keys of active partners.

Rules embedded in the query:

- missing `PartnerInsurerSettings` row means insurer connectivity is enabled;
- missing `PartnerInsurerSettings` row means both pool flags are disabled;
- `PartnerInsurerSettings.IsDisabled = 1` means the insurer is disabled;
- `PartnerInsurerSettings.IsDisabled = 0` means the insurer is enabled;
- `PartnerInsurerSettings` is matched by `ApiKeyId + InsurerId`; do not filter it by `ProductTypeId`.

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
ExpectedInsurers AS (
    SELECT
        v.SortOrder,
        v.InsurerAlias,
        i.InsurerId,
        i.Name AS InsurerName,
        i.FullName AS InsurerFullName
    FROM (VALUES
        (1,  N'Absolut'),
        (2,  N'Alfa'),
        (3,  N'AlfaDec'),
        (4,  N'astrovolga'),
        (5,  N'Energogarant'),
        (6,  N'Gelios'),
        (7,  N'Ingos'),
        (8,  N'Intouch'),
        (9,  N'Maks'),
        (10, N'Renis'),
        (11, N'Reso'),
        (12, N'Rgs'),
        (13, N'Sber'),
        (14, N'Sogaz'),
        (15, N'Soglasie'),
        (16, N'Sovkom'),
        (17, N'Tinkoff'),
        (18, N'Ugoria'),
        (19, N'Vsk'),
        (20, N'Zetta'),
        (21, N'BSO'),
        (22, N'Pari')
    ) v(SortOrder, InsurerAlias)
    LEFT JOIN dbo.Insurers i
        ON i.Alias = v.InsurerAlias
)
SELECT
    ok.PartnerId,
    ok.PartnerName,
    ok.PartnerFullName,
    ok.LegalFormId,
    ok.LegalFormName,
    ok.ApiKeyId,
    ok.ApiKey,
    ok.ApiKeyDescription,
    ok.SupportedProductTypesJson,
    ei.SortOrder AS InsurerSortOrder,
    ei.InsurerAlias,
    ei.InsurerId,
    ei.InsurerName,
    ei.InsurerFullName,
    pis.SettingsId AS PartnerInsurerSettingsId,
    pis.ProductTypeId AS PartnerInsurerSettingsProductTypeId,
    CASE WHEN pis.SettingsId IS NULL THEN 0 ELSE 1 END AS HasPartnerInsurerSettings,
    pis.IsDisabled AS PartnerInsurerIsDisabled,
    CASE
        WHEN pis.SettingsId IS NULL THEN 1
        WHEN pis.IsDisabled = 0 THEN 1
        ELSE 0
    END AS InsurerConnected,
    CASE
        WHEN pis.SettingsId IS NULL THEN N'СК включена: настройки не заведены'
        WHEN pis.IsDisabled = 0 THEN N'СК включена'
        ELSE N'СК отключена'
    END AS InsurerConnectionStatus,
    CASE WHEN ISNULL(pis.ReinsuranceEnabled, 0) = 1 THEN 1 ELSE 0 END AS ReinsuranceEnabled,
    CASE
        WHEN ISNULL(pis.ReinsuranceEnabled, 0) = 1 THEN N'Пул включен'
        ELSE N'Пул выключен'
    END AS ReinsuranceStatus,
    CASE WHEN ISNULL(pis.ReinsuranceWithoutUpsalesEnabled, 0) = 1 THEN 1 ELSE 0 END AS ReinsuranceWithoutUpsalesEnabled,
    CASE
        WHEN ISNULL(pis.ReinsuranceWithoutUpsalesEnabled, 0) = 1 THEN N'Продажа в пул включена'
        ELSE N'Продажа в пул выключена'
    END AS ReinsuranceWithoutUpsalesStatus
FROM OsagoKeys ok
CROSS JOIN ExpectedInsurers ei
LEFT JOIN dbo.PartnerInsurerSettings pis
    ON pis.ApiKeyId = ok.ApiKeyId
   AND pis.InsurerId = ei.InsurerId
ORDER BY ok.PartnerName, ok.ApiKey, ei.SortOrder;
```

## Validation Queries

Check expected row count:

```sql
WITH OsagoKeys AS (
    SELECT ak.ApiKeyId
    FROM dbo.PartnerApiKeys ak
    JOIN dbo.Partners p ON p.PartnerId = ak.PartnerId
    WHERE p.IsActive = 1
      AND ak.IsActive = 1
      AND LTRIM(RTRIM(ak.SupportedProductTypesJson)) = N'[1]'
)
SELECT
    COUNT(*) AS ActiveOsagoKeys,
    COUNT(*) * 22 AS ExpectedMatrixRows
FROM OsagoKeys;
```

Check that all fixed aliases exist in `Insurers`:

```sql
SELECT v.InsurerAlias, i.InsurerId, i.Name
FROM (VALUES
    (N'Absolut'),(N'Alfa'),(N'AlfaDec'),(N'astrovolga'),(N'Energogarant'),(N'Gelios'),
    (N'Ingos'),(N'Intouch'),(N'Maks'),(N'Renis'),(N'Reso'),(N'Rgs'),(N'Sber'),
    (N'Sogaz'),(N'Soglasie'),(N'Sovkom'),(N'Tinkoff'),(N'Ugoria'),(N'Vsk'),
    (N'Zetta'),(N'BSO'),(N'Pari')
) v(InsurerAlias)
LEFT JOIN dbo.Insurers i ON i.Alias = v.InsurerAlias
ORDER BY v.InsurerAlias;
```
