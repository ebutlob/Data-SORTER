'use strict';

// Column order for the core block. Change here if your source format shifts.
const COLUMNS = [
  'card',     // 0
  'month',    // 1
  'year',     // 2
  'cvv',      // 3
  'name',     // 4
  'address',  // 5
  'city',     // 6
  'state',    // 7
  'zip',      // 8
  'country',  // 9
  'phone',    // 10
  'email',    // 11
];

const STATUSES = new Set([
  'LIVE', 'DEAD', 'UNKNOWN', 'CHECK', 'VALID', 'INVALID',
  'ACTIVE', 'INACTIVE', 'WORKING', 'FAILED', 'APPROVED', 'DECLINED',
]);

const DOMAIN_RE = /^[A-Z0-9][A-Z0-9.-]*\.[A-Z]{2,}$/i;

function clean(v) {
  return (v == null ? '' : String(v)).replace(/\u00a0/g, ' ').trim();
}

function digitsOnly(v) {
  return String(v || '').replace(/\D/g, '');
}

function luhn(num) {
  const d = digitsOnly(num);
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function brandOf(num) {
  const d = digitsOnly(num);
  if (/^4/.test(d)) return 'VISA';
  if (/^5[1-5]/.test(d) || /^2(2[2-9]|[3-6]\d|7[01]|720)/.test(d)) return 'MASTERCARD';
  if (/^3[47]/.test(d)) return 'AMEX';
  if (/^6(?:011|5\d{2})/.test(d)) return 'DISCOVER';
  if (/^35\d{2}/.test(d)) return 'JCB';
  if (/^3(?:0[0-5]|[689])/.test(d)) return 'DINERS';
  if (/^62/.test(d)) return 'UNIONPAY';
  if (/^5[06]/.test(d)) return 'MAESTRO';
  return 'UNKNOWN';
}

function formatCard(num) {
  return digitsOnly(num).replace(/(.{4})/g, '$1 ').trim();
}

function normalizeYear(raw) {
  const d = digitsOnly(raw);
  if (d.length === 4) return d;
  if (d.length === 3) return '2' + d;
  if (d.length === 2) return '20' + d;
  if (d.length === 1) return '200' + d;
  return '';
}

function normalizeMonth(raw) {
  const d = digitsOnly(raw);
  if (!d) return '';
  const n = parseInt(d, 10);
  if (n < 1 || n > 12) return d.padStart(2, '0');
  return String(n).padStart(2, '0');
}

function isExpired(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m || !y) return null;
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  if (y < curY) return true;
  if (y === curY && m < curM) return true;
  return false;
}

function pickDelimiter(line, override) {
  if (override) return override;
  if (line.includes('|')) return '|';
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  return '|';
}

function parseRecord(rawLine, delimiterOverride) {
  const line = String(rawLine).replace(/^\uFEFF/, '').trim();
  if (!line) return null;

  const delim = pickDelimiter(line, delimiterOverride);
  const parts = line.split(delim).map(clean);

  // A record must lead with something card-shaped.
  if (!/\d{12,19}/.test(digitsOnly(parts[0] || ''))) return null;
  if (parts.length < 5) return null;

  const core = {};
  COLUMNS.forEach((key, i) => { core[key] = parts[i] || ''; });

  const card = digitsOnly(core.card);
  const month = normalizeMonth(core.month);
  const year = normalizeYear(core.year);
  const cvv = digitsOnly(core.cvv);

  // Tail metadata varies in width — collapse blanks, then classify.
  const tail = parts.slice(COLUMNS.length).map(clean).filter((t) => t !== '');

  let status = '';
  let statusIdx = -1;
  for (let i = 0; i < tail.length; i++) {
    if (STATUSES.has(tail[i].toUpperCase())) {
      status = tail[i].toUpperCase();
      statusIdx = i;
      break;
    }
  }

  const rest = statusIdx >= 0 ? tail.slice(statusIdx + 1) : tail.slice();
  let reason = '';
  let source = '';

  if (rest.length >= 2) {
    reason = rest[0];
    source = rest[rest.length - 1];
    if (reason === source) reason = '';
  } else if (rest.length === 1) {
    if (DOMAIN_RE.test(rest[0])) source = rest[0];
    else reason = rest[0];
  }

  const expired = isExpired(month, year);

  return {
    card,
    cardFormatted: formatCard(card),
    brand: brandOf(card),
    luhn: luhn(card),
    length: card.length,
    month,
    year,
    expiry: month && year ? `${month}/${year.slice(-2)}` : '',
    expiryLong: month && year ? `${month}/${year}` : '',
    expired,
    cvv,
    name: core.name,
    address: core.address,
    city: core.city,
    state: core.state,
    zip: core.zip,
    country: core.country,
    phone: core.phone,
    email: core.email,
    status: status || 'UNKNOWN',
    reason,
    source,
    raw: line,
  };
}

function parseText(text, delimiterOverride) {
  const lines = String(text || '').split(/\r?\n/);
  const records = [];
  const errors = [];
  let skipped = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    if (line.trim().startsWith('#')) continue;

    let rec = null;
    try {
      rec = parseRecord(line, delimiterOverride);
    } catch (err) {
      rec = null;
    }

    if (rec) {
      rec.id = records.length;
      rec.line = i + 1;
      records.push(rec);
    } else {
      skipped++;
      if (errors.length < 25) {
        errors.push({ line: i + 1, raw: line.slice(0, 160) });
      }
    }
  }

  const stats = {
    total: records.length,
    live: records.filter((r) => r.status === 'LIVE').length,
    dead: records.filter((r) => r.status === 'DEAD').length,
    validLuhn: records.filter((r) => r.luhn).length,
    expired: records.filter((r) => r.expired === true).length,
  };

  return { count: records.length, skipped, errors, stats, records };
}

module.exports = { parseText, parseRecord, COLUMNS };
