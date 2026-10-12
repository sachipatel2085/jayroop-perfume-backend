import crypto from 'crypto';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Escape user input before using it inside a RegExp (prevents ReDoS / regex injection)
export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);

export const formatINR = (n, { decimals = 2 } = {}) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const formatDateIN = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : '—';

export const formatDateTimeIN = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      })
    : '—';

/** Human readable order number: JR-YYMMDD-XXXXX (crypto random, retried on collision by caller) */
export const generateOrderNumber = () => {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000); // IST date
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = crypto.randomInt(10000, 99999);
  return `JR-${ymd}-${rand}`;
};

/** Financial year (India, April–March) for a given date → { full: '2026-27', short: '26-27' } */
export const financialYear = (date = new Date()) => {
  const d = new Date(new Date(date).getTime() + 5.5 * 3600 * 1000);
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 3 ? y : y - 1;
  const end = (start + 1) % 100;
  return {
    full: `${start}-${String(end).padStart(2, '0')}`,
    short: `${String(start % 100).padStart(2, '0')}-${String(end).padStart(2, '0')}`,
  };
};

// ───────────── Amount in words (Indian numbering system) ─────────────
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigits = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`);
const threeDigits = (n) => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', r ? twoDigits(r) : ''].filter(Boolean).join(' ');
};

const integerToWords = (num) => {
  if (num === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (num) parts.push(threeDigits(num));
  return parts.join(' ');
};

export const amountInWords = (amount) => {
  const value = Math.abs(round2(amount));
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  let words = `Rupees ${integerToWords(rupees)}`;
  if (paise) words += ` and ${twoDigits(paise)} Paise`;
  return `${words} Only`;
};

export const isValidGSTIN = (gstin = '') =>
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(String(gstin).toUpperCase().trim());

export const isValidIndianPhone = (phone = '') => /^[6-9]\d{9}$/.test(String(phone).replace(/\D/g, '').slice(-10));

export const isValidPincode = (pin = '') => /^[1-9][0-9]{5}$/.test(String(pin).trim());

export const maskPhone = (raw = '') => {
  const p = String(raw);
  return p.length > 4 ? '*'.repeat(Math.max(0, p.length - 4)) + p.slice(-4) : '******';
};

export const maskName = (raw = 'Customer') =>
  String(raw)
    .split(' ')
    .map((part) => (part.length > 1 ? part[0] + '*'.repeat(part.length - 1) : part))
    .join(' ');

/** Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD into IST day boundaries (inclusive) */
export const parseDateRange = (from, to, defaultDays = 30) => {
  const IST = 5.5 * 3600 * 1000;
  const toDate = to ? new Date(`${to}T23:59:59.999+05:30`) : new Date();
  const fromDate = from
    ? new Date(`${from}T00:00:00.000+05:30`)
    : new Date(new Date(toDate.getTime() - defaultDays * 86400000).toISOString().slice(0, 10) + 'T00:00:00.000+05:30');
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    const e = new Error('Invalid date range. Use YYYY-MM-DD.');
    e.statusCode = 400;
    throw e;
  }
  return { from: fromDate, to: toDate, IST };
};
