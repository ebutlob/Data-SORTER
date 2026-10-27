'use strict';

const $ = (id) => document.getElementById(id);

const SAMPLE = [
  '5409789528843844|05|27|504|أحمد القحطاني|جازان حي الملك سعود شارع الملك سلمان 389|جازان|SOUTH|99151|AE|+971 971 3406 2407|أحمدالقحطاني@yahoo.fr|| ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5409789591292275|01|27|569|brandoncoley|1117 Cypress St|richmond|VA|23222|AE|8045286620|brandoncoleydavis@icloud.com|| ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5409789561694781|08|27|001|Eric Hernandez|Jebel Ali Village, Al Muntazah Complex|Abu Dhabi|Dubai|4333|AE|+971 50 580 3464|white2610@gmail.com|| ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5409789605395411|06|27|461|Ricardo Martinez|Silkor, Jumeira Street, Umm Suqeim|Abu Dhabi|Dubai|000|AE|+971 54 001 2175|joshua37@hotmail.com|| ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5409789649894130|10|30|897|Jennifer Jackson|52461 Morgan Port Suite 725|Castilloland|Arizona|43344|AE|052 479 872|valencia.ronald@outlook.com|| ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5216009533413282|03|28|323|Derrick Pierce|07563 Wilson Dale Suite 524|East Chelsealand|Utah|20622|AE|+971 59 648 275|patrickcarey@gmail.com|| ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5216005001978699|05|28|429|Jesse Gutierrez II|831 Timothy Brooks|New Ashleybury|West Virginia|20494|AE|052 862 360|jenniferbaldwin@yahoo.com ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5175548356009411|01|29|344|Kimberly Hayes|04005 Beverly Ridge Suite 166|South Steven|Michigan|18425|AE|051 375 357|lisawhite1948@yahoo.com ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5175548359784515|03|27|571|Tiffany Hampton|361 Stacey Lodge Apt. 062|Amytown|Rhode Island|40104|AE|059 994 815|franklina@outlook.com ||LIVE|85 No reason to decline|T0CHECK.CO',
  '5326606602943870|08|30|308|عبدالله السهلي|الدمام حي الملك فهد شارع الملك فيصل 66|الدمام|EAST|80824|AE|+971 971 5258 1917|عبداللهالسهلي@yahoo.co.uk|| ||LIVE|85 No reason to decline|T0CHECK.CO',
].join('\n');

const state = {
  records: [],
  masked: false,
  query: '',
  status: 'ALL',
  sort: 'none',
};

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, isErr) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('err', !!isErr);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------- clipboard ---------- */
async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copied`);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(`${label} copied`); }
    catch { toast('copy blocked by browser', true); }
    ta.remove();
  }
}

/* ---------- formatting ---------- */
const FIELD_LABELS = {
  cardFormatted: 'Card',
  expiryLong: 'Expiry',
  cvv: 'CVV',
  name: 'Name',
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'Postal code',
  country: 'Country',
  phone: 'Phone',
  email: 'Email',
  status: 'Status',
  reason: 'Reason',
  source: 'Source',
};

function maskedCard(rec) {
  const last4 = rec.card.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

function asText(rec) {
  return [
    `Card: ${rec.cardFormatted}`,
    `Expiry: ${rec.expiryLong}`,
    `CVV: ${rec.cvv}`,
    `Name: ${rec.name}`,
    `Address: ${rec.address}`,
    `City: ${rec.city}`,
    `State: ${rec.state}`,
    `Postal code: ${rec.zip}`,
    `Country: ${rec.country}`,
    `Phone: ${rec.phone}`,
    `Email: ${rec.email}`,
    `Status: ${rec.status}`,
    rec.reason ? `Reason: ${rec.reason}` : null,
    rec.source ? `Source: ${rec.source}` : null,
  ].filter(Boolean).join('\n');
}

function fieldValue(rec, field) {
  if (field === '__full') return asText(rec);
  if (field === '__json') return JSON.stringify(rec, null, 2);
  if (field === 'cardFormatted') return rec.cardFormatted;
  if (field === 'expiryLong') return rec.expiryLong;
  return rec[field] == null ? '' : String(rec[field]);
}

/* ---------- filtering / sorting ---------- */
function visibleRecords() {
  const q = state.query.trim().toLowerCase();
  let list = state.records.filter((r) => {
    if (state.status !== 'ALL' && r.status !== state.status) return false;
    if (!q) return true;
    return [
      r.card, r.name, r.email, r.phone, r.address,
      r.city, r.state, r.zip, r.country, r.status,
      r.reason, r.source, r.brand,
    ].join(' ').toLowerCase().includes(q);
  });

  const cmp = {
    name: (a, b) => a.name.localeCompare(b.name),
    expiry: (a, b) => (a.year + a.month).localeCompare(b.year + b.month),
    country: (a, b) => a.country.localeCompare(b.country),
    status: (a, b) => a.status.localeCompare(b.status),
    luhn: (a, b) => Number(b.luhn) - Number(a.luhn),
  }[state.sort];

  if (cmp) list = list.slice().sort(cmp);
  return list;
}

/* ---------- rendering ---------- */
function fieldRow(rec, field, label, value, mono) {
  const shown = value === '' || value == null ? '—' : value;
  return `<div class="field">
    <span class="label">${esc(label)}</span>
    <span class="value${mono ? ' mono' : ''}" dir="auto">${esc(shown)}</span>
    <button class="copy" data-id="${rec.id}" data-field="${field}">copy</button>
  </div>`;
}

function statusBadge(rec) {
  const cls = rec.status === 'LIVE' ? 'live' : rec.status === 'DEAD' ? 'dead' : 'other';
  return `<span class="badge ${cls}">${esc(rec.status)}</span>`;
}

function renderCard(rec) {
  const num = state.masked ? maskedCard(rec) : rec.cardFormatted;
  const flags = [];
  if (!rec.luhn) flags.push('<span class="badge warn">luhn ✗</span>');
  if (rec.expired === true) flags.push('<span class="badge warn">expired</span>');

  return `<article class="card">
    <div class="card-head">
      <span class="card-num">${esc(num)}</span>
      ${statusBadge(rec)}
      ${flags.join('')}
      <button class="copy" data-id="${rec.id}" data-field="cardFormatted">copy</button>
    </div>
    <div class="card-body">
      ${fieldRow(rec, 'expiryLong', 'Expiry', rec.expiryLong, true)}
      ${fieldRow(rec, 'cvv', 'CVV', rec.cvv, true)}
      ${fieldRow(rec, 'name', 'Name', rec.name)}
      ${fieldRow(rec, 'address', 'Address', rec.address)}
      ${fieldRow(rec, 'city', 'City', rec.city)}
      ${fieldRow(rec, 'state', 'State', rec.state)}
      ${fieldRow(rec, 'zip', 'Postal', rec.zip, true)}
      ${fieldRow(rec, 'country', 'Country', rec.country, true)}
      ${fieldRow(rec, 'phone', 'Phone', rec.phone, true)}
      ${fieldRow(rec, 'email', 'Email', rec.email, true)}
      ${rec.reason ? fieldRow(rec, 'reason', 'Reason', rec.reason) : ''}
      ${rec.source ? fieldRow(rec, 'source', 'Source', rec.source, true) : ''}
    </div>
    <div class="card-foot">
      <button data-id="${rec.id}" data-field="__full">Copy all fields</button>
      <button data-id="${rec.id}" data-field="__json">Copy JSON</button>
    </div>
  </article>`;
}

function render() {
  const list = visibleRecords();
  const grid = $('results');
  const empty = $('empty');

  if (!state.records.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    $('toolbar').classList.add('hidden');
    $('statsBar').classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  $('toolbar').classList.remove('hidden');
  $('statsBar').classList.remove('hidden');

  if (!list.length) {
    grid.innerHTML = `<p class="hint" style="grid-column:1/-1;padding:24px">No records match the current filters.</p>`;
    return;
  }

  grid.innerHTML = list.map(renderCard).join('');
}

/* ---------- exports ---------- */
const CSV_HEADERS = ['Card', 'Month', 'Year', 'CVV', 'Name', 'Address', 'City', 'State', 'ZIP', 'Country', 'Phone', 'Email', 'Status', 'Reason', 'Source'];

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(list) {
  const rows = [CSV_HEADERS.join(',')];
  for (const r of list) {
    rows.push([
      r.card, r.month, r.year, r.cvv, r.name, r.address, r.city,
      r.state, r.zip, r.country, r.phone, r.email, r.status, r.reason, r.source,
    ].map(csvCell).join(','));
  }
  return rows.join('\r\n');
}

function toTSV(list) {
  return list.map((r) => [
    r.card, r.month, r.year, r.cvv, r.name, r.address, r.city,
    r.state, r.zip, r.country, r.phone, r.email, r.status, r.reason, r.source,
  ].join('\t')).join('\n');
}

function toTXT(list) {
  return list.map(asText).join('\n\n' + '─'.repeat(40) + '\n\n');
}

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- parse ---------- */
async function parseNow() {
  const text = $('input').value;
  if (!text.trim()) return toast('nothing to parse', true);

  const btn = $('parseBtn');
  btn.disabled = true;
  btn.textContent = 'Parsing…';

  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`server ${res.status}`);
    const data = await res.json();

    state.records = data.records || [];
    state.query = '';
    state.status = 'ALL';
    state.sort = 'none';
    $('search').value = '';
    $('statusFilter').value = 'ALL';
    $('sortBy').value = 'none';

    $('sTotal').textContent = data.stats.total;
    $('sLive').textContent = data.stats.live;
    $('sDead').textContent = data.stats.dead;
    $('sLuhn').textContent = data.stats.validLuhn;
    $('sSkipped').textContent = data.skipped;

    render();
    toast(`${data.count} records parsed${data.skipped ? `, ${data.skipped} skipped` : ''}`);
  } catch (err) {
    console.error(err);
    toast('parse failed — check console', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Parse';
  }
}

/* ---------- wiring ---------- */
$('parseBtn').addEventListener('click', parseNow);

$('sampleBtn').addEventListener('click', () => {
  $('input').value = SAMPLE;
  updateLineCount();
  parseNow();
});

$('clearBtn').addEventListener('click', () => {
  $('input').value = '';
  state.records = [];
  updateLineCount();
  render();
});

$('input').addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    parseNow();
  }
});

$('search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
$('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; render(); });
$('sortBy').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

$('maskBtn').addEventListener('click', (e) => {
  state.masked = !state.masked;
  e.target.classList.toggle('on', state.masked);
  render();
});

$('results').addEventListener('click', (e) => {
  const btn = e.target.closest('button.copy');
  if (!btn) return;
  const rec = state.records.find((r) => r.id === Number(btn.dataset.id));
  if (!rec) return;
  const field = btn.dataset.field;
  const value = fieldValue(rec, field);
  if (!value) return toast('empty field', true);
  copy(value, field === '__full' ? 'Card' : field === '__json' ? 'JSON' : (FIELD_LABELS[field] || field));
});

document.querySelectorAll('[data-export]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const list = visibleRecords();
    if (!list.length) return toast('nothing to export', true);
    const kind = btn.dataset.export;
    if (kind === 'csv') copy(toCSV(list), 'CSV');
    else if (kind === 'json') copy(JSON.stringify(list, null, 2), 'JSON');
    else if (kind === 'tsv') copy(toTSV(list), 'TSV');
    else copy(toTXT(list), 'TXT');
  });
});

$('downloadBtn').addEventListener('click', () => {
  const list = visibleRecords();
  if (!list.length) return toast('nothing to download', true);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  download(`records-${stamp}.csv`, toCSV(list), 'text/csv;charset=utf-8');
  toast('CSV downloaded');
});

/* ---------- line counter ---------- */
function updateLineCount() {
  const v = $('input').value;
  const n = v ? v.split(/\r?\n/).filter((l) => l.trim()).length : 0;
  $('lineCount').textContent = `${n} line${n === 1 ? '' : 's'}`;
}
$('input').addEventListener('input', updateLineCount);
updateLineCount();
