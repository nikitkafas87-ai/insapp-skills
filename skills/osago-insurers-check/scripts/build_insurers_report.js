#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const INSURERS = [
  'Absolut', 'Alfa', 'AlfaDec', 'astrovolga', 'Energogarant', 'Gelios',
  'Ingos', 'Intouch', 'Maks', 'Renis', 'Reso', 'Rgs', 'Sber', 'Sogaz',
  'Soglasie', 'Sovkom', 'Tinkoff', 'Ugoria', 'Vsk', 'Zetta', 'BSO', 'Pari',
];

const LEGAL_ORDER = ['Юридическое лицо', 'ИП', 'Физическое лицо', 'Не указано'];
const POOL_FIELDS = {
  ReinsuranceEnabled: 'Продажа в пул',
  ReinsuranceWithoutUpsalesEnabled: 'Продажа в пул без кросса',
};
const PRODUCT_TYPES = {
  1: 'ОСАГО',
  2: 'КАСКО',
  3: 'Ипотека',
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--show-secrets') {
      // Kept as a no-op for compatibility with older commands. Public reports never render credentials.
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.input || !args.out) throw new Error('Usage: build_insurers_report.js --input rows.json --out report.html');
  return args;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function loadRows(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.rows)) return raw.rows;
  if (raw.result?.content?.[0]?.text) {
    const nested = JSON.parse(raw.result.content[0].text);
    if (Array.isArray(nested)) return nested;
    if (Array.isArray(nested.rows)) return nested.rows;
  }
  throw new Error('Input JSON must be an array, {rows:[...]}, or a DB MCP response with rows');
}

function truthy(value) {
  return value === true || value === 1 || value === '1';
}

function legalName(row) {
  const name = row.LegalFormName ?? row.legalFormName ?? 'Не указано';
  return LEGAL_ORDER.includes(name) ? name : 'Не указано';
}

function normalizeRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const apiKey = String(row.ApiKey ?? row.apiKey ?? '');
    const alias = String(row.InsurerAlias ?? row.insurerAlias ?? '');
    if (!apiKey || !alias) continue;
    if (!byKey.has(apiKey)) {
      byKey.set(apiKey, {
        apiKey,
        partnerName: row.PartnerName ?? row.partnerName ?? '',
        apiKeyDescription: row.ApiKeyDescription ?? row.apiKeyDescription ?? '',
        legalFormName: legalName(row),
        cells: new Map(),
      });
    }
    byKey.get(apiKey).cells.set(alias, row);
  }
  return [...byKey.values()].sort((a, b) => {
    const left = `${LEGAL_ORDER.indexOf(a.legalFormName)} ${a.partnerName} ${a.apiKey}`;
    const right = `${LEGAL_ORDER.indexOf(b.legalFormName)} ${b.partnerName} ${b.apiKey}`;
    return left.localeCompare(right, 'ru', { sensitivity: 'base' });
  });
}

function connected(row) {
  return truthy(row?.InsurerConnected ?? row?.insurerConnected);
}

function hasPis(row) {
  return truthy(row?.HasPartnerInsurerSettings ?? row?.hasPartnerInsurerSettings);
}

function pisProductTypeId(row) {
  return row?.PartnerInsurerSettingsProductTypeId
    ?? row?.partnerInsurerSettingsProductTypeId
    ?? row?.ProductTypeId
    ?? row?.productTypeId
    ?? null;
}

function productTypeLabel(row) {
  if (!hasPis(row)) return 'PIS нет';
  const id = pisProductTypeId(row);
  if (id === null || typeof id === 'undefined' || id === '') return 'ProductTypeId не указан';
  return PRODUCT_TYPES[String(id)] ?? `ProductTypeId ${id}`;
}

function productTypeMeta(row) {
  if (!hasPis(row)) return 'PartnerInsurerSettings не заведена';
  const id = pisProductTypeId(row);
  return id === null || typeof id === 'undefined' || id === ''
    ? 'PartnerInsurerSettings.ProductTypeId = NULL'
    : `PartnerInsurerSettings.ProductTypeId = ${id}`;
}

function pool(row, field) {
  return truthy(row?.[field]);
}

function connectionClass(row) {
  if (connected(row) && !hasPis(row)) return 'miss-sk';
  return connected(row) ? 'ok' : 'sk-off';
}

function connectionLabel(row) {
  if (connected(row) && !hasPis(row)) return 'Включена по умолчанию';
  return connected(row) ? 'Включена' : 'Отключена';
}

function connectionChipLabel(row) {
  if (!hasPis(row)) return connectionLabel(row);
  return `${connectionLabel(row)} · ${productTypeLabel(row)}`;
}

function poolClass(row, field) {
  return pool(row, field) ? 'ok' : 'cross-off';
}

function poolLabel(row, field) {
  const label = POOL_FIELDS[field] ?? field;
  return `${label} ${pool(row, field) ? 'включена' : 'выключена'}`;
}

function poolValue(row, field) {
  return pool(row, field) ? '1' : '0';
}

function keyPoolValues(key, field) {
  return [...new Set(INSURERS.map((alias) => poolValue(key.cells.get(alias), field)))].join(' ');
}

function searchText(key) {
  const parts = [key.partnerName, key.apiKey, key.apiKeyDescription, key.legalFormName];
  for (const alias of INSURERS) {
    const row = key.cells.get(alias);
    parts.push(alias, row?.InsurerName ?? '', row?.InsurerConnectionStatus ?? '');
  }
  return parts.join(' ').toLowerCase();
}

function countForKey(key, predicate) {
  return INSURERS.reduce((sum, alias) => sum + (predicate(key.cells.get(alias)) ? 1 : 0), 0);
}

function groupKeys(keys) {
  return LEGAL_ORDER
    .map((name) => [name, keys.filter((key) => key.legalFormName === name)])
    .filter(([, items]) => items.length);
}

function renderConnectionRows(key) {
  return INSURERS.map((alias) => {
    const row = key.cells.get(alias);
    const cls = connectionClass(row);
    const reason = row?.InsurerConnectionStatus ?? 'Нет строки в результате';
    return `<tr data-status="${esc(cls)}" data-insurer="${esc(alias)}" data-reinsurance="${poolValue(row, 'ReinsuranceEnabled')}" data-without-upsales="${poolValue(row, 'ReinsuranceWithoutUpsalesEnabled')}">
        <td>${esc(alias)}<small>${esc(row?.InsurerName ?? '')}</small></td>
        <td><span class="chip ${esc(cls)}">${esc(connectionChipLabel(row))}</span></td>
        <td><span class="chip neutral">${esc(productTypeLabel(row))}</span><small>${esc(productTypeMeta(row))}</small></td>
        <td><span class="chip ${esc(poolClass(row, 'ReinsuranceEnabled'))}">${esc(poolLabel(row, 'ReinsuranceEnabled'))}</span><small>ReinsuranceEnabled</small></td>
        <td><span class="chip ${esc(poolClass(row, 'ReinsuranceWithoutUpsalesEnabled'))}">${esc(poolLabel(row, 'ReinsuranceWithoutUpsalesEnabled'))}</span><small>ReinsuranceWithoutUpsalesEnabled</small></td>
        <td>${esc(reason)}</td>
      </tr>`;
  }).join('');
}

function renderConnectionCard(key) {
  const enabled = countForKey(key, connected);
  const defaultEnabled = countForKey(key, (row) => connected(row) && !hasPis(row));
  const disabled = INSURERS.length - enabled;
  return `<details class="key-card" data-key-card data-legal="${esc(key.legalFormName)}" data-search="${esc(searchText(key))}">
    <summary>
      <div class="summary-main">
        <strong>${esc(key.partnerName)}</strong>
        <code>${esc(key.apiKey)}</code>
        <small>${esc(key.legalFormName)} · ${esc(key.apiKeyDescription || 'Без описания')}</small>
      </div>
      <span class="score ${disabled ? 'mid' : 'good'}">${enabled}/${INSURERS.length}</span>
    </summary>
    <div class="key-metrics">
      <span>СК включены <b>${enabled}</b></span>
      <span>Включены по умолчанию <b>${defaultEnabled}</b></span>
      <span>СК отключены <b>${disabled}</b></span>
    </div>
    <div class="table-wrap"><table class="detail-table"><thead><tr><th>СК</th><th>Статус</th><th>Продукт PIS <small>PartnerInsurerSettings.ProductTypeId</small></th><th>Продажа в пул <small>ReinsuranceEnabled</small></th><th>Продажа в пул без кросса <small>ReinsuranceWithoutUpsalesEnabled</small></th><th>Причина</th></tr></thead><tbody>${renderConnectionRows(key)}</tbody></table></div>
  </details>`;
}

function renderConnectionTab(keys) {
  const sections = groupKeys(keys).map(([legal, items]) => {
    const enabled = items.reduce((sum, key) => sum + countForKey(key, connected), 0);
    return `<section class="legal-section" data-legal-section="${esc(legal)}">
      <div class="section-head"><div><h2>${esc(legal)}</h2><p>${items.length} ApiKey · подключено СК: ${enabled}</p></div></div>
      <div class="keys">${items.map(renderConnectionCard).join('')}</div>
    </section>`;
  }).join('');
  return `<section class="tab-panel" id="tab-connect">${sections}</section>`;
}

function renderConnectionMatrix(keys) {
  const headers = INSURERS.map((alias) => `<th>${esc(alias)}</th>`).join('');
  const body = keys.map((key) => {
    const cells = INSURERS.map((alias) => {
      const row = key.cells.get(alias);
      const yes = connected(row);
      return `<td title="${esc(`${alias} · ${connectionLabel(row)} · ${productTypeMeta(row)}`)}"><span class="binary ${yes ? 'yes' : 'no'}">${yes ? 'Да' : 'Нет'}</span></td>`;
    }).join('');
    return `<tr data-matrix-row data-legal="${esc(key.legalFormName)}" data-search="${esc(searchText(key))}" data-reinsurance-values="${esc(keyPoolValues(key, 'ReinsuranceEnabled'))}" data-without-upsales-values="${esc(keyPoolValues(key, 'ReinsuranceWithoutUpsalesEnabled'))}">
      <th>${esc(key.partnerName)}<code>${esc(key.apiKey)}</code><small>${esc(key.legalFormName)} · ${esc(key.apiKeyDescription || 'Без описания')}</small></th>${cells}
    </tr>`;
  }).join('');
  return `<section class="tab-panel hidden" id="tab-connection-matrix">
    <div class="section-head"><div><h2>Обычная матрица — Подключенность СК</h2><p>Строки — ApiKey, столбцы — СК. Да: pis.IsDisabled = 0 или записи PIS нет. Нет: pis.IsDisabled = 1. Продукт найденной PIS-строки показан в детальной таблице и tooltip ячейки.</p></div></div>
    <div class="matrix-wrap"><table class="matrix"><thead><tr><th>Партнер / ApiKey</th>${headers}</tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

function renderPoolMatrix(keys, field, title) {
  const headers = INSURERS.map((alias) => `<th>${esc(alias)}</th>`).join('');
  const body = keys.map((key) => {
    const cells = INSURERS.map((alias) => {
      const row = key.cells.get(alias);
      const yes = pool(row, field);
      return `<td title="${esc(`${alias} · ${poolLabel(row, field)} · ${productTypeMeta(row)}`)}"><span class="binary ${yes ? 'yes' : 'no'}">${yes ? 'Да' : 'Нет'}</span></td>`;
    }).join('');
    return `<tr data-matrix-row data-legal="${esc(key.legalFormName)}" data-search="${esc(searchText(key))}" data-reinsurance-values="${esc(keyPoolValues(key, 'ReinsuranceEnabled'))}" data-without-upsales-values="${esc(keyPoolValues(key, 'ReinsuranceWithoutUpsalesEnabled'))}">
      <th>${esc(key.partnerName)}<code>${esc(key.apiKey)}</code><small>${esc(key.legalFormName)} · ${esc(key.apiKeyDescription || 'Без описания')}</small></th>${cells}
    </tr>`;
  }).join('');
  return `<section class="tab-panel hidden" id="tab-${esc(field)}">
    <div class="section-head"><div><h2>${esc(title)}</h2><p>Единая матрица по всем ApiKey. Фильтр по юрформе скрывает лишние строки.</p></div></div>
    <div class="matrix-wrap"><table class="matrix"><thead><tr><th>Партнер / ApiKey</th>${headers}</tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

function countCells(keys, predicate) {
  let count = 0;
  for (const key of keys) {
    for (const alias of INSURERS) if (predicate(key.cells.get(alias))) count += 1;
  }
  return count;
}

function render(keys) {
  const totalCells = keys.length * INSURERS.length;
  const partners = new Set(keys.map((key) => key.partnerName)).size;
  const connectedCount = countCells(keys, connected);
  const disabledCount = totalCells - connectedCount;
  const reinsuranceCount = countCells(keys, (row) => pool(row, 'ReinsuranceEnabled'));
  const reinsuranceWithoutUpsalesCount = countCells(keys, (row) => pool(row, 'ReinsuranceWithoutUpsalesEnabled'));
  const generated = new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' });
  const legalFilter = LEGAL_ORDER.map((name) =>
    `<label class="check-row"><input type="checkbox" data-filter="legal" value="${esc(name)}"><span>${esc(name)}</span></label>`,
  ).join('');
  const reinsuranceFilter = [
    ['1', 'Продажа в пул включена'],
    ['0', 'Продажа в пул выключена'],
  ].map(([value, label]) => `<label class="check-row"><input type="checkbox" data-filter="reinsurance" value="${value}"><span>${label}</span></label>`).join('');
  const withoutUpsalesFilter = [
    ['1', 'Продажа в пул без кросса включена'],
    ['0', 'Продажа в пул без кросса выключена'],
  ].map(([value, label]) => `<label class="check-row"><input type="checkbox" data-filter="withoutUpsales" value="${value}"><span>${label}</span></label>`).join('');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ОСАГО — Подключенность СК</title>
<style>
:root{--bg:#f3f5f8;--panel:#fff;--text:#172033;--muted:#667085;--line:#d9e0ea;--accent:#205493;--ok:#087443;--warn:#b54708;--bad:#b42318;--blue:#175cd3}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 Inter,Segoe UI,Arial,sans-serif}main{max-width:1680px;margin:0 auto;padding:24px}
.hero{padding:28px 0 18px}.eyebrow{font-weight:700;color:var(--accent);text-transform:uppercase;font-size:12px;letter-spacing:.08em}h1{margin:6px 0 8px;font-size:34px;line-height:1.1}.meta{color:var(--muted)}.metrics{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:12px;margin:18px 0}.metric{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px}.metric span{display:block;color:var(--muted);font-size:12px}.metric b{display:block;font-size:25px;margin-top:3px}
.toolbar{position:sticky;top:0;z-index:20;background:rgba(243,245,248,.96);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:8px;padding:12px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start}.toolbar input[type=search]{height:38px;min-width:320px;border:1px solid var(--line);border-radius:6px;padding:0 11px}.filter-box{position:relative}.filter-box summary,.toolbar button{height:38px;border:1px solid var(--line);background:#fff;border-radius:6px;padding:8px 11px;cursor:pointer}.filter-menu{position:absolute;z-index:40;top:44px;left:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 14px 32px rgba(16,24,40,.16);min-width:240px;padding:8px}.check-row{display:flex;gap:8px;align-items:flex-start;padding:7px;border-radius:6px}.check-row:hover{background:#f7f9fc}.filter-actions{display:flex;justify-content:flex-end;border-bottom:1px solid var(--line);padding:0 0 8px;margin-bottom:4px}.secondary{color:var(--accent)}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}.legend-item,.chip,.binary{display:inline-flex;align-items:center;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700;white-space:nowrap}.ok{background:#dcfae6;color:#067647}.miss-sk{background:#e0f2fe;color:#075985}.sk-off{background:#fee4e2;color:#b42318}.cross-off{background:#f2f4f7;color:#344054}.neutral{background:#eef4ff;color:#3538cd}.binary.yes{background:#dcfae6;color:#067647}.binary.no{background:#fee4e2;color:#b42318}
.tabs{display:flex;gap:8px;margin:18px 0}.tab-btn{border:1px solid var(--line);background:#fff;border-radius:6px;padding:9px 13px;cursor:pointer;font-weight:700}.tab-btn.active{background:#172033;color:#fff;border-color:#172033}.tab-panel.hidden{display:none!important}
.section-head{display:flex;justify-content:space-between;align-items:flex-end;margin:24px 0 10px}.section-head h2{margin:0;font-size:22px}.section-head p{margin:4px 0 0;color:var(--muted)}.key-card{background:#fff;border:1px solid var(--line);border-radius:8px;margin:10px 0;overflow:hidden}.key-card[open]{box-shadow:0 12px 28px rgba(16,24,40,.08)}.key-card summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;padding:14px 16px}.summary-main{min-width:0}.summary-main strong{display:block;font-size:15px}.summary-main code{display:block;font-family:Consolas,monospace;margin-top:3px;white-space:normal;word-break:break-all}.summary-main small{display:block;color:var(--muted);margin-top:3px}.score{align-self:start;border-radius:999px;padding:4px 10px;font-weight:800}.score.good{background:#dcfae6;color:#067647}.score.mid{background:#eef4ff;color:#175cd3}.key-metrics{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 12px}.key-metrics span{background:#f8fafc;border:1px solid var(--line);border-radius:6px;padding:5px 8px;color:#475467}.table-wrap{overflow:auto;border-top:1px solid var(--line)}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #eef1f5;padding:9px 10px;text-align:left;vertical-align:top}th{background:#f8fafc}td small,th small{display:block;color:var(--muted);font-weight:400;margin-top:3px}
.matrix-wrap{overflow:auto;border:1px solid var(--line);border-radius:8px;background:#fff;max-height:76vh}.matrix{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0}.matrix th,.matrix td{border-right:1px solid #eef1f5;border-bottom:1px solid #eef1f5;min-width:170px;max-width:260px}.matrix thead th{position:sticky;top:0;z-index:8;background:#f8fafc}.matrix th:first-child{position:sticky;left:0;z-index:10;min-width:360px}.matrix tbody th{position:sticky;left:0;background:#fff;z-index:6}.matrix thead th:first-child{z-index:12}.matrix th code{display:block;margin-top:4px;white-space:normal;word-break:break-all;font-family:Consolas,monospace}.hidden{display:none!important}.no-results{display:none;background:#fff;border:1px dashed var(--line);border-radius:8px;padding:18px;margin:16px 0;color:var(--muted)}
@media(max-width:760px){main{padding:14px}h1{font-size:27px}.metrics{grid-template-columns:1fr}.toolbar{position:static}.toolbar input[type=search]{min-width:100%;width:100%}}
</style>
</head>
<body>
<main>
<section class="hero">
  <div class="eyebrow">Insapp · prod DB</div>
  <h1>ОСАГО — Подключенность СК</h1>
  <div class="meta">Сформировано: ${esc(generated)} · активные партнеры, активные ApiKey, SupportedProductTypesJson = [1], PartnerInsurerSettings сопоставлены по ApiKeyId + InsurerId без фильтра ProductTypeId.</div>
  <div class="metrics">
    <div class="metric"><span>Партнеров</span><b>${partners}</b></div>
    <div class="metric"><span>ApiKey ОСАГО</span><b>${keys.length}</b></div>
    <div class="metric"><span>Проверяемых СК</span><b>${INSURERS.length}</b></div>
    <div class="metric"><span>Строк матрицы</span><b>${totalCells}</b></div>
  </div>
  <div class="metrics">
    <div class="metric"><span>СК подключены</span><b>${connectedCount}</b></div>
    <div class="metric"><span>СК отключены</span><b>${disabledCount}</b></div>
    <div class="metric"><span>Продажа в пул включена</span><b>${reinsuranceCount}</b></div>
    <div class="metric"><span>Продажа в пул без кросса включена</span><b>${reinsuranceWithoutUpsalesCount}</b></div>
  </div>
</section>
<section class="toolbar">
  <input id="search" type="search" placeholder="Поиск: партнер, ApiKey, СК, описание">
  <details class="filter-box"><summary data-label="Юрформы">Юрформы: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="legal">Сбросить</button></div>${legalFilter}</div></details>
  <details class="filter-box"><summary data-label="Продажа в пул">Продажа в пул: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="reinsurance">Сбросить</button></div>${reinsuranceFilter}</div></details>
  <details class="filter-box"><summary data-label="Продажа в пул без кросса">Продажа в пул без кросса: все</summary><div class="filter-menu"><div class="filter-actions"><button type="button" class="secondary" data-clear="withoutUpsales">Сбросить</button></div>${withoutUpsalesFilter}</div></details>
  <button type="button" id="resetBtn">Сбросить все</button>
  <button type="button" id="expandBtn">Раскрыть</button>
</section>
<div class="legend"><span class="legend-item ok">СК или параметр включены</span><span class="legend-item miss-sk">СК включена по умолчанию: настройки не заведены</span><span class="legend-item sk-off">СК отключена</span><span class="legend-item cross-off">Параметр выключен</span></div>
<div class="legend"><span class="legend-item neutral">Проверяемые СК: ${esc(INSURERS.join(', '))}</span><span class="legend-item cross-off">Строк матрицы = ApiKey ОСАГО × ${INSURERS.length}</span></div>
<nav class="tabs" aria-label="Вкладки отчета">
  <button type="button" class="tab-btn active" data-tab="connect">Детальная проверка</button>
  <button type="button" class="tab-btn" data-tab="connection-matrix">Обычная матрица — Подключенность СК</button>
  <button type="button" class="tab-btn" data-tab="ReinsuranceEnabled">Обычная матрица — Продажа в пул</button>
  <button type="button" class="tab-btn" data-tab="ReinsuranceWithoutUpsalesEnabled">Обычная матрица — Продажа в пул без кросса</button>
</nav>
<div id="visibleCounter" class="meta"></div>
<div id="noResults" class="no-results">Ничего не найдено по поиску</div>
${renderConnectionTab(keys)}
${renderConnectionMatrix(keys)}
${renderPoolMatrix(keys, 'ReinsuranceEnabled', 'Обычная матрица — Продажа в пул')}
${renderPoolMatrix(keys, 'ReinsuranceWithoutUpsalesEnabled', 'Обычная матрица — Продажа в пул без кросса')}
</main>
<script>
const search = document.getElementById('search');
const resetBtn = document.getElementById('resetBtn');
const expandBtn = document.getElementById('expandBtn');
const visibleCounter = document.getElementById('visibleCounter');
const noResults = document.getElementById('noResults');
function selected(kind) {
  return [...document.querySelectorAll('input[data-filter="' + kind + '"]:checked')].map(x => x.value);
}
function updateSummaries() {
  document.querySelectorAll('.filter-box').forEach(box => {
    const summary = box.querySelector('summary');
    const inputs = [...box.querySelectorAll('input:checked')];
    const label = summary.dataset.label;
    summary.textContent = inputs.length ? label + ': ' + inputs.length : label + ': все';
  });
}
function rowMatches(el) {
  const q = search.value.trim().toLowerCase();
  const legal = selected('legal');
  return (!q || (el.dataset.search || '').includes(q)) && (!legal.length || legal.includes(el.dataset.legal));
}
function fieldMatches(value, values) {
  return !values.length || values.includes(value);
}
function valuesMatch(valuesText, selectedValues) {
  if (!selectedValues.length) return true;
  return (valuesText || '').split(/\s+/).some(value => selectedValues.includes(value));
}
function applySearch() {
  let visible = 0;
  const reinsurance = selected('reinsurance');
  const withoutUpsales = selected('withoutUpsales');
  document.querySelectorAll('[data-key-card]').forEach(card => {
    const rows = [...card.querySelectorAll('tbody tr')];
    const visibleRows = rows.filter(row =>
      fieldMatches(row.dataset.reinsurance, reinsurance) &&
      fieldMatches(row.dataset.withoutUpsales, withoutUpsales)
    );
    rows.forEach(row => row.classList.toggle('hidden', !visibleRows.includes(row)));
    const ok = rowMatches(card) && visibleRows.length > 0;
    card.classList.toggle('hidden', !ok);
    if (ok && !card.closest('.tab-panel').classList.contains('hidden')) visible += 1;
  });
  document.querySelectorAll('[data-matrix-row]').forEach(row => {
    const ok = rowMatches(row) &&
      valuesMatch(row.dataset.reinsuranceValues, reinsurance) &&
      valuesMatch(row.dataset.withoutUpsalesValues, withoutUpsales);
    row.classList.toggle('hidden', !ok);
    if (ok && !row.closest('.tab-panel').classList.contains('hidden')) visible += 1;
  });
  document.querySelectorAll('.legal-section').forEach(section => {
    section.classList.toggle('hidden', !section.querySelector('[data-key-card]:not(.hidden)'));
  });
  visibleCounter.textContent = 'Показано строк текущей вкладки: ' + visible + ' из ${keys.length}';
  noResults.style.display = visible ? 'none' : 'block';
  updateSummaries();
}
search.addEventListener('input', applySearch);
document.querySelectorAll('input[data-filter]').forEach(input => input.addEventListener('change', applySearch));
document.querySelectorAll('[data-clear]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('input[data-filter="' + button.dataset.clear + '"]').forEach(x => x.checked = false);
  applySearch();
}));
resetBtn.addEventListener('click', () => {
  search.value = '';
  document.querySelectorAll('input[data-filter]').forEach(x => x.checked = false);
  applySearch();
});
expandBtn.addEventListener('click', () => {
  const cards = [...document.querySelectorAll('[data-key-card]:not(.hidden)')];
  const shouldOpen = cards.some(card => !card.open);
  cards.forEach(card => card.open = shouldOpen);
  expandBtn.textContent = shouldOpen ? 'Свернуть' : 'Раскрыть';
});
document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(x => x.classList.add('hidden'));
  button.classList.add('active');
  document.getElementById('tab-' + button.dataset.tab).classList.remove('hidden');
  applySearch();
}));
applySearch();
</script>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv);
  const rows = loadRows(args.input);
  const keys = normalizeRows(rows);
  const html = render(keys);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, html, 'utf8');
  console.log(JSON.stringify({
    out: args.out,
    keys: keys.length,
    insurers: INSURERS.length,
    matrixCells: keys.length * INSURERS.length,
    credentials: 'omitted',
  }, null, 2));
}

main();
