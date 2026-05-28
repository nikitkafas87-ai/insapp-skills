#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REQUIRED_BADGES = ['BestService', 'LoyalInsurer', 'UserChoice', 'UsersInsurer'];
const ALL_BADGES = ['APay', ...REQUIRED_BADGES];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help' || key === '-h') {
      args.help = true;
      continue;
    }
    if (!key.startsWith('--')) throw new Error(`Unexpected argument: ${key}`);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
    args[key.slice(2)] = value;
    i += 1;
  }
  return args;
}

function usage() {
  console.log('Usage: node build_badges_report.js --badges badges.json --names names.json --active active.json --out report.html');
}

function normalizeRows(value) {
  if (Array.isArray(value)) {
    if (value.length === 1 && typeof value[0].text === 'string') {
      return normalizeRows(JSON.parse(value[0].text));
    }
    return value;
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.rows)) return value.rows;
    if (Array.isArray(value.data)) return value.data;
    if (value.result) return normalizeRows(value.result);
    if (typeof value.text === 'string') return normalizeRows(JSON.parse(value.text));
  }
  throw new Error('JSON must be an array, { rows }, { data }, { result }, or tool result { text }');
}

function readRows(filePath) {
  if (!filePath) return [];
  return normalizeRows(JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')));
}

function readKeys(filePath) {
  if (!filePath) return [];
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];
  if (raw.startsWith('[')) return JSON.parse(raw).map(String).map((x) => x.trim()).filter(Boolean);
  return raw.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
}

function asBool(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value).trim().toLowerCase();
  if (['да', 'yes', 'true', '1', 'active', 'активен'].includes(text)) return true;
  if (['нет', 'no', 'false', '0', 'inactive', 'неактивен'].includes(text)) return false;
  return fallback;
}

function ensurePartner(map, apiKey) {
  if (!map.has(apiKey)) {
    map.set(apiKey, {
      apiKey,
      partnerName: '',
      keyActive: true,
      partnerActive: true,
      badges: {
        APay: [],
        BestService: [],
        LoyalInsurer: [],
        UserChoice: [],
        UsersInsurer: false,
      },
    });
  }
  return map.get(apiKey);
}

function addUnique(list, value) {
  const text = value === undefined || value === null || value === '' ? 'Да' : String(value);
  if (!list.includes(text)) list.push(text);
}

function buildPartners({ badgeRows, nameRows, activeRows, keys }) {
  const partners = new Map();
  keys.forEach((apiKey) => ensurePartner(partners, apiKey));

  for (const row of nameRows) {
    const apiKey = String(firstValue(row, ['ApiKey', 'apiKey', 'apikey']) || '').trim();
    if (!apiKey) continue;
    ensurePartner(partners, apiKey).partnerName = String(firstValue(row, ['PartnerName', 'partnerName', 'Name', 'name']) || '');
  }

  for (const row of activeRows) {
    const apiKey = String(firstValue(row, ['ApiKey', 'apiKey', 'apikey']) || '').trim();
    if (!apiKey) continue;
    const partner = ensurePartner(partners, apiKey);
    partner.keyActive = asBool(firstValue(row, ['KeyActive', 'keyActive', 'ApiKeyActive', 'IsApiKeyActive']), true);
    partner.partnerActive = asBool(firstValue(row, ['PartnerActive', 'partnerActive', 'IsPartnerActive']), true);
  }

  for (const row of badgeRows) {
    const apiKey = String(firstValue(row, ['ApiKey', 'apiKey', 'apikey']) || '').trim();
    const badgeName = String(firstValue(row, ['BadgeName', 'badgeName', 'Badge', 'badge']) || '').trim();
    if (!apiKey || !ALL_BADGES.includes(badgeName)) continue;
    const partner = ensurePartner(partners, apiKey);
    const partnerName = firstValue(row, ['PartnerName', 'partnerName', 'Name', 'name']);
    if (partnerName && !partner.partnerName) partner.partnerName = String(partnerName);
    if (badgeName === 'UsersInsurer') partner.badges.UsersInsurer = true;
    else addUnique(partner.badges[badgeName], firstValue(row, ['InsurerName', 'insurerName', 'Insurer', 'insurer']));
  }

  return Array.from(partners.values()).sort((a, b) => {
    const byName = a.partnerName.localeCompare(b.partnerName, 'ru');
    return byName || a.apiKey.localeCompare(b.apiKey);
  });
}

function hasBadge(partner, badge) {
  if (badge === 'UsersInsurer') return partner.badges.UsersInsurer;
  return partner.badges[badge].length > 0;
}

function missingRequired(partner) {
  return REQUIRED_BADGES.filter((badge) => !hasBadge(partner, badge));
}

function classify(partner) {
  const anyBadge = ALL_BADGES.some((badge) => hasBadge(partner, badge));
  if (!anyBadge) return 'none';
  if (missingRequired(partner).length === 0) return 'full';
  return 'partial';
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function badgeCell(partner, badge) {
  if (badge === 'UsersInsurer') return partner.badges.UsersInsurer ? 'Да' : 'Нет';
  return partner.badges[badge].length ? partner.badges[badge].join(', ') : 'Нет';
}

function renderSection(id, title, rows, includeMissing) {
  const headers = ['Партнёр', 'ApiKey', 'Ключ акт.', 'Партнёр акт.', 'APay', 'Лучший сервис', 'Надёжная СК', 'Выбор поль-лей', 'Ваша СК'];
  if (includeMissing) headers.push('Не подключены');

  const tableId = `${id}-table`;
  const counterId = `${id}-counter`;
  const parts = [];
  parts.push(`<section class="report-section ${id}">`);
  parts.push(`<h2 class="${id}">${esc(title)} <span>${rows.length}</span></h2>`);
  parts.push(`<div class="counter" id="${counterId}">Показано: ${rows.length} из ${rows.length}</div>`);

  if (!rows.length) {
    parts.push('<div class="empty-msg">Нет партнёров в этой категории</div></section>');
    return parts.join('\n');
  }

  parts.push(`<div class="table-wrap"><table id="${tableId}"><thead>`);
  parts.push('<tr>' + headers.map((header) => `<th>${esc(header)}</th>`).join('') + '</tr>');
  parts.push('<tr class="filter-row">' + headers.map((header, index) => `<th><select data-table="${tableId}" data-counter="${counterId}" data-col="${index}" aria-label="Фильтр ${esc(header)}"><option value="">Все</option></select></th>`).join('') + '</tr>');
  parts.push('</thead><tbody>');

  for (const partner of rows) {
    const inactive = !partner.keyActive || !partner.partnerActive;
    const cells = [
      partner.partnerName || '(нет имени)',
      partner.apiKey,
      partner.keyActive ? 'Да' : 'Нет',
      partner.partnerActive ? 'Да' : 'Нет',
      badgeCell(partner, 'APay'),
      badgeCell(partner, 'BestService'),
      badgeCell(partner, 'LoyalInsurer'),
      badgeCell(partner, 'UserChoice'),
      badgeCell(partner, 'UsersInsurer'),
    ];
    if (includeMissing) cells.push(missingRequired(partner).join(', ') || 'Нет');
    parts.push(`<tr class="${inactive ? 'inactive' : ''}">` + cells.map((cell, index) => `<td${index === 1 ? ' class="apikey"' : ''}>${esc(cell)}</td>`).join('') + '</tr>');
  }

  parts.push('</tbody></table></div></section>');
  return parts.join('\n');
}

function renderHtml(partners) {
  const groups = { full: [], partial: [], none: [] };
  for (const partner of partners) groups[classify(partner)].push(partner);
  const generatedAt = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OSAGO badges report</title>
<style>
:root { --bg:#f4f6f8; --text:#1f2933; --muted:#667085; --line:#d9dee7; --full:#177245; --partial:#9a6700; --none:#b42318; }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:14px/1.45 Arial,sans-serif; }
main { max-width:1440px; margin:0 auto; padding:24px; }
h1 { margin:0 0 6px; font-size:28px; }
.meta,.counter { color:var(--muted); }
.summary { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0 20px; }
.summary span { border:1px solid var(--line); background:#fff; border-radius:6px; padding:8px 10px; }
.actions { margin:0 0 16px; }
button { border:1px solid #98a2b3; background:#fff; border-radius:6px; padding:8px 12px; cursor:pointer; }
.report-section { margin:18px 0 28px; }
h2 { margin:0 0 8px; font-size:20px; }
h2.full { color:var(--full); } h2.partial { color:var(--partial); } h2.none { color:var(--none); }
.empty-msg { border:1px dashed var(--line); background:#fff; border-radius:6px; padding:14px; color:var(--muted); }
.table-wrap { overflow:auto; border:1px solid var(--line); background:#fff; border-radius:6px; }
table { width:100%; border-collapse:collapse; min-width:1120px; }
th,td { border-bottom:1px solid var(--line); padding:8px 10px; text-align:left; vertical-align:top; }
th { background:#f8fafc; position:sticky; top:0; z-index:1; }
.filter-row th { top:35px; }
select { width:100%; min-width:90px; }
.apikey { font-family:Consolas,monospace; white-space:nowrap; }
.inactive { opacity:.55; }
tbody tr:hover { background:#f9fafb; }
</style>
</head>
<body>
<main>
<h1>Отчёт по бейджам ОСАГО</h1>
<div class="meta">Сформировано: ${esc(generatedAt)}</div>
<div class="summary">
  <span>Всего ключей: ${partners.length}</span>
  <span>Все 4 бейджа: ${groups.full.length}</span>
  <span>Не все бейджи: ${groups.partial.length}</span>
  <span>Без бейджей: ${groups.none.length}</span>
</div>
<div class="actions"><button type="button" onclick="resetAll()">Сбросить все фильтры</button></div>
${renderSection('full', 'Все 4 бейджа подключены', groups.full, false)}
${renderSection('partial', 'Не все бейджи подключены', groups.partial, true)}
${renderSection('none', 'Без бейджей - нет настроек', groups.none, false)}
</main>
<script>
function cellText(row,col){ return (row.cells[col] && row.cells[col].textContent || '').trim(); }
function populateFilters(table){
  const rows = Array.from(table.tBodies[0].rows);
  const selects = Array.from(table.querySelectorAll('select[data-col]'));
  for (const select of selects) {
    const col = Number(select.dataset.col);
    const values = Array.from(new Set(rows.map(row => cellText(row,col)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ru'));
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value; option.textContent = value; select.appendChild(option);
    }
    select.addEventListener('change', () => applyFilters(table.id, select.dataset.counter));
  }
}
function applyFilters(tableId,counterId){
  const table = document.getElementById(tableId);
  const rows = Array.from(table.tBodies[0].rows);
  const filters = Array.from(table.querySelectorAll('select[data-col]')).map(select => ({ col:Number(select.dataset.col), value:select.value })).filter(filter => filter.value);
  let shown = 0;
  for (const row of rows) {
    const visible = filters.every(filter => cellText(row, filter.col) === filter.value);
    row.style.display = visible ? '' : 'none';
    if (visible) shown += 1;
  }
  const counter = document.getElementById(counterId);
  if (counter) counter.textContent = 'Показано: ' + shown + ' из ' + rows.length;
}
function resetAll(){
  for (const select of document.querySelectorAll('select[data-col]')) select.value = '';
  for (const table of document.querySelectorAll('table')) {
    const firstSelect = table.querySelector('select[data-counter]');
    applyFilters(table.id, firstSelect ? firstSelect.dataset.counter : '');
  }
}
for (const table of document.querySelectorAll('table')) populateFilters(table);
</script>
</body>
</html>`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.badges) {
    usage();
    throw new Error('--badges is required');
  }

  const partners = buildPartners({
    badgeRows: readRows(args.badges),
    nameRows: readRows(args.names),
    activeRows: readRows(args.active),
    keys: readKeys(args.keys),
  });

  if (!partners.length) throw new Error('No partners found. Check --badges, --names, or --keys input.');

  const outputPath = args.out || 'C:/Users/nikit/Desktop/badges_osago_report.html';
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderHtml(partners), 'utf8');

  const counts = partners.reduce((acc, partner) => {
    acc[classify(partner)] += 1;
    return acc;
  }, { full: 0, partial: 0, none: 0 });
  console.log(`Wrote ${outputPath}`);
  console.log(`Total: ${partners.length}; full: ${counts.full}; partial: ${counts.partial}; none: ${counts.none}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
