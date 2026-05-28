#!/usr/bin/env node

const fs = require('fs');

const STATUSES = {
  Y: { label: 'Кросс подключен', cls: 'ok' },
  I: { label: 'Настройка на СК не заведена', cls: 'miss-sk' },
  S: { label: 'СК выключена', cls: 'sk-off' },
  M: { label: 'Настройка на Кроссы не заведена', cls: 'miss-cross' },
  C: { label: 'Кросс выключен', cls: 'cross-off' },
};

const LEGAL_FORMS = {
  1: 'Юридическое лицо',
  2: 'ИП',
  3: 'Физическое лицо',
};

const CROSSES = {
  1: { insurer: 'Ренессанс', name: 'Ренессанс: Кросс (НС)' },
  3: { insurer: 'Гелиос', name: 'Гелиос: Практичное Каско' },
  4: { insurer: 'Альфа', name: 'Альфа: КАСКОGO' },
  5: { insurer: 'Росгосстрах', name: 'Росгосстрах: Подушка безопасности' },
  6: { insurer: 'Ренессанс', name: 'Ренессанс: КАСКО от бесполисных' },
  7: { insurer: 'Альфа', name: 'Альфа: КАСКО от бесполисных' },
  8: { insurer: 'Альфа', name: 'Альфа: КАСКО от чужих ошибок' },
  9: { insurer: 'Альфа', name: 'Альфа: КАСКО за 3' },
  10: { insurer: 'Ингосстрах', name: 'Ингосстрах: АвтоНС+' },
  11: { insurer: 'Сбер', name: 'Сбер: Автозащита' },
  12: { insurer: 'Ингосстрах', name: 'Ингосстрах: КАСКО Автозащита' },
  13: { insurer: 'ВСК', name: 'ВСК: КАСКО Компакт Минимум' },
  14: { insurer: 'Росгосстрах', name: 'Росгосстрах: КАСКО от бесполисных' },
  16: { insurer: 'РЕСО', name: 'РЕСО: КАСКО Профи Ультралайт' },
  17: { insurer: 'ПАРИ', name: 'ПАРИ: КАСКО smart' },
  18: { insurer: 'Согласие', name: 'Согласие: КАСКОЗащита+' },
  20: { insurer: 'МАКС', name: 'МАКС: Быстрокаско-1' },
};

const UPSALE_MODES = {
  1: {
    code: 'RequiredReinsurance_NoneCommon',
    description: 'Кросс продается как вмененный для пула, а для обычного предложения не продается',
  },
  2: {
    code: 'RequiredReinsurance_OptionalCommon',
    description: 'Кросс продается как вмененный для пула, а для обычного предложения опционально',
  },
  3: {
    code: 'OptionalReinsurance_OptionalCommon',
    description: 'Кросс продается как опциональный для пула и для обычного предложения',
  },
  4: {
    code: 'NoneReinsurance_OptionalCommon',
    description: 'Кросс не продается в пул, и продается как опциональный для обычного предложения',
  },
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function bool(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

function statusCode(row) {
  if (bool(row.EffectivelyEnabled)) return 'Y';
  if (bool(row.MissingInsurerSettings)) return 'I';
  if (bool(row.PartnerInsurerIsDisabled)) return 'S';
  if (bool(row.MissingCrossSettings)) return 'M';
  return 'C';
}

function reason(row, code) {
  if (code === 'I') return 'Настройка на СК не заведена (PartnerInsurerSettings)';
  if (code === 'S') return 'СК выключена (PartnerInsurerSettings.IsDisabled = 1)';
  if (code === 'M') return 'Настройка на Кроссы не заведена (PartnerInsurerUpsaleSettings)';
  if (code === 'C') return 'Кросс выключен (PartnerInsurerUpsaleSettings.IsDisabled = 1)';
  return 'Кросс подключен';
}

function sortRu(a, b) {
  return String(a).localeCompare(String(b), 'ru', { sensitivity: 'base' });
}

function upsaleModeId(row) {
  if (row?.UpsaleModeId === null || row?.UpsaleModeId === undefined || row?.UpsaleModeId === '') return 'none';
  return String(row.UpsaleModeId);
}

function upsaleModeMeta(rowOrModeId) {
  const id = typeof rowOrModeId === 'object' ? upsaleModeId(rowOrModeId) : String(rowOrModeId);
  if (UPSALE_MODES[id]) return UPSALE_MODES[id];
  return { code: 'NoUpsaleMode', description: 'режим не задан' };
}

function upsaleModeShort(rowOrModeId) {
  const id = typeof rowOrModeId === 'object' ? upsaleModeId(rowOrModeId) : String(rowOrModeId);
  return id === 'none' ? 'нет' : id;
}

function upsaleModeDisplay(rowOrModeId) {
  const id = typeof rowOrModeId === 'object' ? upsaleModeId(rowOrModeId) : String(rowOrModeId);
  const meta = upsaleModeMeta(id);
  return `${upsaleModeShort(id)} (${meta.description})`;
}

function upsaleModeClass(rowOrModeId) {
  const id = typeof rowOrModeId === 'object' ? upsaleModeId(rowOrModeId) : String(rowOrModeId);
  return `mode-${id}`;
}

function buildModel(rows) {
  const keys = new Map();
  const crosses = new Map();
  const legalForms = new Map();
  const statusTotals = Object.fromEntries(Object.keys(STATUSES).map((x) => [x, 0]));

  for (const row of rows) {
    const apiKey = String(row.ApiKey || '');
    const crossId = String(row.UpsaleTypeId);
    const cross = CROSSES[crossId] || { insurer: row.InsurerAlias, name: row.UpsaleName };
    const legalFormName = LEGAL_FORMS[String(row.LegalFormId)] || 'Не указано';
    const code = statusCode(row);
    const modeId = upsaleModeId(row);
    const modeMeta = upsaleModeMeta(modeId);
    const normalized = {
      ...row,
      InsurerAlias: cross.insurer,
      UpsaleName: cross.name,
      LegalFormName: legalFormName,
      code,
      statusLabel: STATUSES[code].label,
      reason: reason(row, code),
      upsaleModeId: modeId,
      upsaleModeCode: modeMeta.code,
      upsaleModeLabel: upsaleModeShort(modeId),
      upsaleModeDescription: modeMeta.description,
      upsaleModeDisplay: upsaleModeDisplay(modeId),
      upsaleModeClass: upsaleModeClass(modeId),
    };

    statusTotals[code] += 1;
    if (!legalForms.has(String(row.LegalFormId ?? ''))) {
      legalForms.set(String(row.LegalFormId ?? ''), legalFormName);
    }
    if (!crosses.has(crossId)) {
      crosses.set(crossId, {
        id: crossId,
        name: cross.name,
        insurer: cross.insurer,
      });
    }
    if (!keys.has(apiKey)) {
      keys.set(apiKey, {
        apiKey,
        apiKeyId: row.ApiKeyId,
        description: row.ApiKeyDescription || '',
        partnerId: row.PartnerId,
        partnerName: row.PartnerName || '',
        partnerFullName: row.PartnerFullName || '',
        legalFormId: String(row.LegalFormId ?? ''),
        legalFormName,
        supported: row.SupportedProductTypesJson || '',
        rows: [],
        byCross: new Map(),
        statusCounts: Object.fromEntries(Object.keys(STATUSES).map((x) => [x, 0])),
      });
    }
    const key = keys.get(apiKey);
    key.rows.push(normalized);
    key.byCross.set(crossId, normalized);
    key.statusCounts[code] += 1;
  }

  const keyList = Array.from(keys.values()).sort((a, b) =>
    sortRu(a.legalFormName, b.legalFormName) ||
    sortRu(a.partnerName, b.partnerName) ||
    sortRu(a.apiKey, b.apiKey)
  );
  const crossList = Array.from(crosses.values()).sort((a, b) => Number(a.id) - Number(b.id));
  return { keyList, crossList, legalForms, statusTotals };
}

function keyHealth(key) {
  if (key.statusCounts.Y > 0) return 'with-enabled';
  return 'without-enabled';
}

function renderCheckboxes(items, type) {
  return items.map(([value, label]) =>
    `<label class="check-row"><input type="checkbox" data-filter="${type}" value="${esc(value)}"><span>${esc(label)}</span></label>`
  ).join('');
}

function metric(label, value) {
  return `<div class="metric"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function renderModeGuide() {
  const items = Object.keys(UPSALE_MODES).map((id) =>
    `<span class="mode-guide-item"><span class="chip mode-badge ${esc(upsaleModeClass(id))}">${esc(id)}</span><span>${esc(UPSALE_MODES[id].description)}</span></span>`
  ).join('');
  return `<div class="mode-guide"><strong>UpsaleMode:</strong>${items}</div>`;
}

function renderDetailRows(key) {
  return key.rows
    .slice()
    .sort((a, b) => Number(a.UpsaleTypeId) - Number(b.UpsaleTypeId))
    .map((row) => {
      const meta = STATUSES[row.code];
      const skLabel = row.code === 'I'
        ? 'Настройка на СК не заведена'
        : row.code === 'S'
          ? 'СК выключена'
          : 'Настройка на СК активна';
      return `<tr data-status="${row.code}" data-insurer="${esc(row.InsurerAlias)}" data-cross="${row.UpsaleTypeId}" data-mode="${esc(row.upsaleModeId)}">
        <td>${esc(row.UpsaleName)}<small>#${esc(row.UpsaleTypeId)} · ${esc(row.InsurerAlias)}</small></td>
        <td><span class="chip ${row.code === 'I' ? 'miss-sk' : row.code === 'S' ? 'sk-off' : 'neutral'}">${esc(skLabel)}</span></td>
        <td><span class="chip ${meta.cls}">${esc(meta.label)}</span></td>
        <td><span class="chip mode-badge ${esc(row.upsaleModeClass)}" title="${esc(row.upsaleModeDescription)}">${esc(row.upsaleModeLabel)}</span></td>
        <td>${esc(row.reason)}</td>
      </tr>`;
    }).join('');
}

function renderKey(key) {
  const search = `${key.partnerName} ${key.partnerFullName} ${key.apiKey} ${key.description}`.toLowerCase();
  const counts = Object.entries(STATUSES)
    .map(([code, meta]) => `<span>${esc(meta.label)} <b>${key.statusCounts[code]}</b></span>`)
    .join('');
  return `<details class="key-card" data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-search="${esc(search)}">
    <summary>
      <div class="summary-main">
        <strong>${esc(key.partnerName)}</strong>
        <code>${esc(key.apiKey)}</code>
        <small>${esc(key.description || 'Без описания')}</small>
      </div>
      <span class="score ${key.statusCounts.Y ? 'mid' : 'bad'}">${key.statusCounts.Y}/17</span>
    </summary>
    <div class="key-metrics">${counts}</div>
    <div class="table-wrap compact">
      <table class="detail-table">
        <thead><tr><th>Кросс</th><th>СК</th><th>Статус кросса</th><th>UpsaleMode</th><th>Причина</th></tr></thead>
        <tbody>${renderDetailRows(key)}</tbody>
      </table>
    </div>
  </details>`;
}

function renderGroups(model) {
  const byLegal = new Map();
  for (const key of model.keyList) {
    if (!byLegal.has(key.legalFormId)) byLegal.set(key.legalFormId, []);
    byLegal.get(key.legalFormId).push(key);
  }
  return Array.from(byLegal.entries()).map(([legalId, keys]) => {
    const partners = new Set(keys.map((x) => x.partnerId)).size;
    const enabledKeys = keys.filter((x) => x.statusCounts.Y > 0).length;
    return `<section class="legal-section" data-legal-section="${esc(legalId)}">
      <div class="section-head">
        <div>
          <h2>${esc(keys[0]?.legalFormName || 'Не указано')}</h2>
          <p>${partners} партнеров · ${keys.length} ApiKey · ${enabledKeys} ключей с подключенными кроссами</p>
        </div>
      </div>
      <div class="keys">${keys.map(renderKey).join('')}</div>
    </section>`;
  }).join('');
}

function renderMatrix(model) {
  const header = model.keyList.map((key) => {
    const search = `${key.partnerName} ${key.apiKey} ${key.description}`.toLowerCase();
    return `<th data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-search="${esc(search)}"><span>${esc(key.partnerName)}</span><code>${esc(key.apiKey)}</code><small>${esc(key.description || 'Без описания')}</small></th>`;
  }).join('');
  const rows = model.crossList.map((cross) => {
    const cells = model.keyList.map((key) => {
      const row = key.byCross.get(cross.id);
      const code = row?.code || 'I';
      const meta = STATUSES[code];
      const search = `${key.partnerName} ${key.apiKey} ${key.description}`.toLowerCase();
      return `<td data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-status="${code}" data-insurer="${esc(cross.insurer)}" data-cross="${cross.id}" data-mode="${esc(upsaleModeId(row))}" data-search="${esc(search)}" title="${esc(`${key.partnerName} · ${key.apiKey} · ${row?.reason || meta.label}`)}"><span class="dot ${meta.cls}">${esc(meta.label)}</span></td>`;
    }).join('');
    return `<tr><th>${esc(cross.name)}<small>${esc(cross.insurer)} · #${esc(cross.id)}</small></th>${cells}</tr>`;
  }).join('');
  return `<section class="matrix-section">
    <div class="section-head"><div><h2>Матричный вид</h2><p>Строки — кроссы, столбцы — активные ОСАГО ApiKey с SupportedProductTypesJson = [1]</p></div></div>
    <div class="matrix-wrap"><table class="matrix"><thead><tr><th>Кросс</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function simpleConnected(row) {
  return Boolean(row?.PartnerInsurerSettingsId) &&
    !bool(row?.PartnerInsurerIsDisabled) &&
    Boolean(row?.InsurerUpsaleSettingsId) &&
    !bool(row?.CrossIsDisabled);
}

function renderSimpleMatrix(model) {
  const header = model.crossList.map((cross) =>
    `<th data-insurer="${esc(cross.insurer)}" data-cross="${esc(cross.id)}"><span>${esc(cross.name)}</span><small>${esc(cross.insurer)} · #${esc(cross.id)}</small></th>`
  ).join('');
  const rows = model.keyList.map((key) => {
    const cells = model.crossList.map((cross) => {
      const row = key.byCross.get(cross.id);
      const connected = simpleConnected(row);
      return `<td data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-status="${connected ? 'Y' : 'N'}" data-insurer="${esc(cross.insurer)}" data-cross="${esc(cross.id)}" data-mode="${esc(upsaleModeId(row))}" title="${esc(`${key.partnerName} · ${key.apiKey} · ${cross.name} · ${connected ? 'Подключен' : 'Выключен'}`)}"><span class="binary ${connected ? 'yes' : 'no'}">${connected ? 'Да' : 'Нет'}</span></td>`;
    }).join('');
    const search = `${key.partnerName} ${key.partnerFullName} ${key.apiKey} ${key.description}`.toLowerCase();
    return `<tr data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-search="${esc(search)}">
      <th><strong>${esc(key.partnerName)}</strong><code>${esc(key.apiKey)}</code><small>${esc(key.description || 'Без описания')}</small></th>${cells}
    </tr>`;
  }).join('');
  return `<section class="simple-matrix-section">
    <div class="section-head"><div><h2>Обычная матрица</h2><p>Строки — ApiKey, столбцы — кроссы. Да только когда есть pis, СК включена, есть pius и pius.IsDisabled = 0.</p></div></div>
    <div class="matrix-wrap"><table class="matrix simple-matrix"><thead><tr><th>Партнер · ApiKey · описание</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function modeConnected(row, modeId) {
  return simpleConnected(row) && upsaleModeId(row) === String(modeId);
}

function renderModeMatrix(model, modeId) {
  const mode = upsaleModeMeta(modeId);
  const header = model.crossList.map((cross) =>
    `<th data-insurer="${esc(cross.insurer)}" data-cross="${esc(cross.id)}"><span>${esc(cross.name)}</span><small>${esc(cross.insurer)} · #${esc(cross.id)}</small></th>`
  ).join('');
  const rows = model.keyList.map((key) => {
    const cells = model.crossList.map((cross) => {
      const row = key.byCross.get(cross.id);
      const connected = modeConnected(row, modeId);
      const currentModeDisplay = upsaleModeDisplay(row);
      return `<td data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-status="${connected ? 'Y' : 'N'}" data-insurer="${esc(cross.insurer)}" data-cross="${esc(cross.id)}" data-mode="${esc(upsaleModeId(row))}" title="${esc(`${key.partnerName} · ${key.apiKey} · ${cross.name} · ${connected ? upsaleModeDisplay(modeId) : currentModeDisplay}`)}"><div class="mode-cell"><span class="binary ${connected ? 'yes' : 'no'}">${connected ? 'Да' : 'Нет'}</span><span class="chip mode-badge ${esc(upsaleModeClass(row))}">${esc(upsaleModeShort(row))}</span></div></td>`;
    }).join('');
    const search = `${key.partnerName} ${key.partnerFullName} ${key.apiKey} ${key.description}`.toLowerCase();
    return `<tr data-legal="${esc(key.legalFormId)}" data-health="${keyHealth(key)}" data-search="${esc(search)}">
      <th><strong>${esc(key.partnerName)}</strong><code>${esc(key.apiKey)}</code><small>${esc(key.description || 'Без описания')}</small></th>${cells}
    </tr>`;
  }).join('');
  return `<section class="mode-matrix-section">
    <div class="section-head"><div><h2>Обычная матрица — ${esc(upsaleModeDisplay(modeId))}</h2><p>Да только когда кросс подключен и UpsaleMode = ${esc(modeId)}.</p></div></div>
    <div class="matrix-wrap"><table class="matrix simple-matrix"><thead><tr><th>Партнер · ApiKey · описание</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function render(model) {
  const partners = new Set(model.keyList.map((x) => x.partnerId)).size;
  const generatedAt = new Date().toLocaleString('ru-RU');
  const legalItems = Array.from(model.legalForms.entries()).sort((a, b) => sortRu(a[1], b[1]));
  const crossItems = model.crossList.map((x) => [x.id, `${x.name}`]);
  const insurerItems = Array.from(new Set(model.crossList.map((x) => x.insurer))).sort(sortRu).map((x) => [x, x]);
  const statusItems = Object.entries(STATUSES).map(([code, meta]) => [code, meta.label]);
  const modeItems = [
    ...Object.keys(UPSALE_MODES).map((id) => [id, upsaleModeDisplay(id)]),
    ['none', 'нет (режим не задан)'],
  ];
  const modeTabs = Object.keys(UPSALE_MODES).map((id) =>
    `<button type="button" class="tab-btn" data-tab="mode-${esc(id)}">Обычная матрица — ${esc(upsaleModeDisplay(id))}</button>`
  ).join('');
  const modePanels = Object.keys(UPSALE_MODES).map((id) =>
    `<div class="tab-panel hidden" id="tab-mode-${esc(id)}">${renderModeMatrix(model, id)}</div>`
  ).join('');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ОСАГО — Кроссы</title>
<style>
:root{--bg:#f3f5f8;--panel:#fff;--text:#172033;--muted:#667085;--line:#d9e0ea;--accent:#205493;--ok:#087443;--warn:#b54708;--bad:#b42318;--blue:#175cd3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 Inter,Segoe UI,Arial,sans-serif}main{max-width:1680px;margin:0 auto;padding:24px}
.hero{padding:28px 0 18px}.eyebrow{font-weight:700;color:var(--accent);text-transform:uppercase;font-size:12px;letter-spacing:.08em}h1{margin:6px 0 8px;font-size:34px;line-height:1.1}.meta{color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;margin:18px 0}.metric{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.metric span{display:block;color:var(--muted);font-size:12px}.metric b{display:block;font-size:25px;margin-top:3px}
.toolbar{position:sticky;top:0;z-index:20;background:rgba(243,245,248,.96);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:8px;padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}.toolbar input[type=search]{height:38px;min-width:280px;border:1px solid var(--line);border-radius:6px;padding:0 11px}.filter-box{position:relative}.filter-box summary,.toolbar button{height:38px;border:1px solid var(--line);background:#fff;border-radius:6px;padding:8px 11px;cursor:pointer}.filter-menu{position:absolute;z-index:40;top:44px;left:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 14px 32px rgba(16,24,40,.16);min-width:270px;max-height:360px;overflow:auto;padding:8px}.check-row{display:flex;gap:8px;align-items:flex-start;padding:7px;border-radius:6px}.check-row:hover{background:#f7f9fc}.filter-actions{display:flex;justify-content:flex-end;border-bottom:1px solid var(--line);padding:0 0 8px;margin-bottom:4px}.secondary{color:var(--accent)}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.legend-item,.chip,.dot{display:inline-flex;align-items:center;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700;white-space:nowrap}.ok{background:#dcfae6;color:#067647}.miss-sk{background:#e0f2fe;color:#075985}.sk-off{background:#fee4e2;color:#b42318}.miss-cross{background:#fef0c7;color:#93370d}.cross-off{background:#f2f4f7;color:#344054}.neutral{background:#eef4ff;color:#3538cd}.mode-badge{min-width:28px;justify-content:center}.mode-1{background:#fff4d6;color:#92400e}.mode-2{background:#dcfae6;color:#067647}.mode-3{background:#dbeafe;color:#1d4ed8}.mode-4{background:#fce7f3;color:#9d174d}.mode-none{background:#f2f4f7;color:#475467}.mode-guide{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:12px 0}.mode-guide strong{margin-right:4px}.mode-guide-item{display:flex;gap:6px;align-items:center;color:var(--muted);font-size:12px}.mode-cell{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.tabs{display:flex;gap:8px;margin:18px 0}.tab-btn{border:1px solid var(--line);background:#fff;border-radius:6px;padding:9px 13px;cursor:pointer;font-weight:700}.tab-btn.active{background:#172033;color:#fff;border-color:#172033}.tab-panel.hidden{display:none!important}
.section-head{display:flex;justify-content:space-between;align-items:flex-end;margin:24px 0 10px}.section-head h2{margin:0;font-size:22px}.section-head p{margin:4px 0 0;color:var(--muted)}.key-card{background:#fff;border:1px solid var(--line);border-radius:8px;margin:10px 0;overflow:hidden}.key-card[open]{box-shadow:0 12px 28px rgba(16,24,40,.08)}.key-card summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;padding:14px 16px}.summary-main{min-width:0}.summary-main strong{display:block;font-size:15px}.summary-main code{display:block;font-family:Consolas,monospace;margin-top:3px;white-space:normal;word-break:break-all}.summary-main small{display:block;color:var(--muted);margin-top:3px}.score{align-self:start;border-radius:999px;padding:4px 10px;font-weight:800}.score.mid{background:#eef4ff;color:#175cd3}.score.bad{background:#fee4e2;color:#b42318}.key-metrics{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px}.key-metrics span{background:#f8fafc;border:1px solid var(--line);border-radius:6px;padding:5px 8px;color:#475467}.table-wrap{overflow:auto;border-top:1px solid var(--line)}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #eef1f5;padding:9px 10px;text-align:left;vertical-align:top}th{background:#f8fafc}td small,th small{display:block;color:var(--muted);font-weight:400}.detail-table th:first-child{min-width:260px}
.matrix-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff;max-height:76vh}.matrix{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0}.matrix th,.matrix td{border-right:1px solid #eef1f5;border-bottom:1px solid #eef1f5;min-width:180px;max-width:260px}.matrix thead th{position:sticky;top:0;z-index:8;background:#f8fafc}.matrix th:first-child{position:sticky;left:0;z-index:10;min-width:280px}.matrix tbody th{position:sticky;left:0;background:#fff;z-index:6}.matrix thead th:first-child{z-index:12}.matrix th code{display:block;margin-top:4px;white-space:normal;word-break:break-all}.matrix .dim{opacity:.16}.simple-matrix th:first-child{min-width:360px}.binary{display:inline-flex;align-items:center;justify-content:center;min-width:42px;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800}.binary.yes{background:#dcfae6;color:#067647}.binary.no{background:#f2f4f7;color:#344054}.hidden{display:none!important}.no-results{display:none;background:#fff;border:1px dashed var(--line);border-radius:8px;padding:18px;margin:16px 0;color:var(--muted)}
@media(max-width:760px){main{padding:14px}h1{font-size:27px}.metrics{grid-template-columns:1fr}.toolbar{position:static}.toolbar input[type=search]{min-width:100%;width:100%}}
</style>
</head>
<body>
<main>
<section class="hero">
  <div class="eyebrow">Insapp · prod DB</div>
  <h1>ОСАГО — Кроссы</h1>
  <div class="meta">Сформировано: ${esc(generatedAt)} · Источник: активные партнеры, активные ApiKey, только SupportedProductTypesJson = [1]. UpsalesDisabled не учитывается.</div>
  <div class="metrics">
    ${metric('Партнеров', partners)}
    ${metric('ApiKey ОСАГО', model.keyList.length)}
    ${metric('Типов кроссов', model.crossList.length)}
    ${metric('Строк матрицы', model.keyList.length * model.crossList.length)}
  </div>
  <div class="metrics">
    ${metric('Подключенных кроссов', model.statusTotals.Y)}
    ${metric('Нет настройки СК', model.statusTotals.I)}
    ${metric('СК отключена', model.statusTotals.S)}
    ${metric('Кросс выключен/нет настройки', model.statusTotals.M + model.statusTotals.C)}
  </div>
</section>
<section class="toolbar">
  <input id="search" type="search" placeholder="Поиск: партнер, ApiKey, описание">
  <details class="filter-box"><summary data-label="Юрформы">Юрформы: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="legal">Сбросить</button></div>${renderCheckboxes(legalItems, 'legal')}</div></details>
  <details class="filter-box"><summary data-label="Статусы">Статусы: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="status">Сбросить</button></div>${renderCheckboxes(statusItems, 'status')}<label class="check-row"><input type="checkbox" data-filter="status" value="empty"><span>Ключи без подключенных кроссов</span></label></div></details>
  <details class="filter-box"><summary data-label="Кроссы">Кроссы: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="cross">Сбросить</button></div>${renderCheckboxes(crossItems, 'cross')}</div></details>
  <details class="filter-box"><summary data-label="СК">СК: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="insurer">Сбросить</button></div>${renderCheckboxes(insurerItems, 'insurer')}</div></details>
  <details class="filter-box"><summary data-label="UpsaleMode">UpsaleMode: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="mode">Сбросить</button></div>${renderCheckboxes(modeItems, 'mode')}</div></details>
  <button type="button" id="resetBtn">Сбросить все</button>
  <button type="button" id="expandBtn">Раскрыть</button>
</section>
<div class="legend">${Object.entries(STATUSES).map(([code, meta]) => `<span class="legend-item ${meta.cls}" data-code="${code}">${esc(meta.label)}</span>`).join('')}</div>
<div class="mode-guide"><strong>Типы кроссов:</strong>${model.crossList.map((cross) => `<span class="mode-guide-item"><span class="chip neutral">#${esc(cross.id)}</span><span>${esc(cross.name)}</span></span>`).join('')}</div>
${renderModeGuide()}
<nav class="tabs" aria-label="Вкладки отчета">
  <button type="button" class="tab-btn active" data-tab="details">Детальная проверка</button>
  <button type="button" class="tab-btn" data-tab="simple">Обычная матрица</button>
  ${modeTabs}
</nav>
<div id="visibleCounter" class="meta"></div>
<div id="noResults" class="no-results">Ничего не найдено по выбранным фильтрам</div>
<div class="tab-panel" id="tab-details">
  ${renderGroups(model)}
  ${renderMatrix(model)}
</div>
<div class="tab-panel hidden" id="tab-simple">
  ${renderSimpleMatrix(model)}
</div>
${modePanels}
</main>
<script>
const active = { legal:new Set(), status:new Set(), cross:new Set(), insurer:new Set(), mode:new Set() };
const q = document.getElementById('search');
const keyCards = [...document.querySelectorAll('.key-card')];
const matrices = [...document.querySelectorAll('.matrix')];
function checked(type){active[type]=new Set([...document.querySelectorAll('[data-filter="'+type+'"]:checked')].map(x=>x.value));}
function hasIntersection(values,set){if(!set.size)return true;return values.some(v=>set.has(String(v)));}
function cardMatches(card){
  const text=(q.value||'').trim().toLowerCase();
  if(text && !card.dataset.search.includes(text)) return false;
  if(active.legal.size && !active.legal.has(card.dataset.legal)) return false;
  const rows=[...card.querySelectorAll('tbody tr')];
  const visibleRows=rows.filter(r=>hasIntersection([r.dataset.status],active.status)&&hasIntersection([r.dataset.cross],active.cross)&&hasIntersection([r.dataset.insurer],active.insurer)&&hasIntersection([r.dataset.mode],active.mode));
  const emptyWanted=active.status.has('empty');
  const noEnabled=card.querySelectorAll('tbody tr[data-status="Y"]').length===0;
  rows.forEach(r=>r.classList.toggle('hidden', !visibleRows.includes(r)));
  return (visibleRows.length>0 || (!active.cross.size&&!active.insurer.size&&!active.mode.size&&emptyWanted&&noEnabled)) && (!emptyWanted || noEnabled);
}
function applyMatrix(){
  const text=(q.value||'').trim().toLowerCase();
  for(const matrix of matrices){
    const isSimple=matrix.classList.contains('simple-matrix');
    const headers=[...matrix.tHead.rows[0].cells].slice(1);
    if(!isSimple){
      headers.forEach((h,i)=>{
        const keep=(!text||h.dataset.search.includes(text))&&(!active.legal.size||active.legal.has(h.dataset.legal));
        h.classList.toggle('dim',!keep);
        for(const row of matrix.tBodies[0].rows){row.cells[i+1].classList.toggle('dim',!keep)}
      });
    }
    for(const row of matrix.tBodies[0].rows){
      if(isSimple){
        const rowKeep=(!text||row.dataset.search.includes(text))&&(!active.legal.size||active.legal.has(row.dataset.legal));
        row.classList.toggle('hidden',!rowKeep);
      } else {
        const cross=row.cells[0].querySelector('small')?.textContent.match(/#(\\d+)/)?.[1] || '';
        const insurer=row.cells[0].querySelector('small')?.textContent.split('·')[0].trim() || '';
        const rowHasMode=[...row.cells].slice(1).some(cell=>hasIntersection([cell.dataset.mode],active.mode));
        const rowKeep=hasIntersection([cross],active.cross)&&hasIntersection([insurer],active.insurer)&&rowHasMode;
        row.classList.toggle('hidden',!rowKeep);
      }
      for(const cell of [...row.cells].slice(1)){
        const keep=hasIntersection([cell.dataset.status],active.status)&&hasIntersection([cell.dataset.cross],active.cross)&&hasIntersection([cell.dataset.insurer],active.insurer)&&hasIntersection([cell.dataset.mode],active.mode);
        cell.classList.toggle('dim',!keep);
      }
    }
  }
}
function updateSummaries(){
  for(const type of Object.keys(active)){
    const summary=document.querySelector('[data-label][data-label="'+({legal:'Юрформы',status:'Статусы',cross:'Кроссы',insurer:'СК',mode:'UpsaleMode'}[type])+'"]');
    if(summary){const n=active[type].size;summary.textContent=summary.dataset.label+': '+(n?n:'все');}
  }
}
function apply(){
  for(const type of Object.keys(active)) checked(type);
  let shown=0;
  for(const card of keyCards){const ok=cardMatches(card);card.classList.toggle('hidden',!ok);if(ok)shown++;}
  for(const section of document.querySelectorAll('.legal-section')){
    section.classList.toggle('hidden', section.querySelectorAll('.key-card:not(.hidden)').length===0);
  }
  applyMatrix(); updateSummaries();
  document.getElementById('visibleCounter').textContent='Показано ApiKey: '+shown+' из '+keyCards.length;
  document.getElementById('noResults').style.display=shown?'none':'block';
}
document.addEventListener('change',e=>{if(e.target.matches('[data-filter]'))apply();});
document.addEventListener('click',e=>{if(e.target.dataset.clear){document.querySelectorAll('[data-filter="'+e.target.dataset.clear+'"]').forEach(x=>x.checked=false);apply();}});
q.addEventListener('input',apply);
document.getElementById('resetBtn').addEventListener('click',()=>{q.value='';document.querySelectorAll('[data-filter]').forEach(x=>x.checked=false);apply();});
document.getElementById('expandBtn').addEventListener('click',e=>{const open=e.target.textContent==='Раскрыть';keyCards.filter(x=>!x.classList.contains('hidden')).forEach(x=>x.open=open);e.target.textContent=open?'Свернуть':'Раскрыть';});
document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===btn));
  document.querySelectorAll('.tab-panel').forEach(x=>x.classList.toggle('hidden',x.id!=='tab-'+btn.dataset.tab));
}));
apply();
</script>
</body>
</html>`;
}

function main() {
  const input = arg('input');
  const output = arg('out');
  if (!input || !output) {
    console.error('Usage: node build_report.js --input osago_crosses_result.json --out index.html');
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, ''));
  const rows = parsed.rows || [];
  const model = buildModel(rows);
  fs.writeFileSync(output, render(model), 'utf8');
  console.log(`wrote ${output}; keys=${model.keyList.length}; rows=${rows.length}; enabled=${model.statusTotals.Y}`);
}

main();
