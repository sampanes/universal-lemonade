// src/ui/format.js -- how money and counts are written on screen.
import { BigNum } from '../bignum.ts';

// Number style: millions and billions are written out in full, never as "30.00 M", so a
// kid can see that $30,000,000 plus an $11 chore is $30,000,011: more, but not by much.
// Only from a trillion up do numbers switch to the short "1.23 T" style.
const FULL_DIGITS_BELOW = 1e12;
const CENTS_BELOW = 100000;
const fmt2 = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Whole dollars, cents cut off. +0.005: BigNum hands back mantissa * 10^e, which can land a
// hair under the true value (123456789 came out as 123456788.99999999 and floored to ...788).
export const fmtWhole = (n) => Math.floor(n + 0.005).toLocaleString('en-US');
const fmtShort = (n) => BigNum.fromNumber(n).format(2);
// Dollar text for a plain number >= 0: cents while small, then whole dollars in full digits.
// exact = keep the cents all the way up (Day Report rows, so they still add up).
export function fmtDollars(n, exact = false) {
  if (n >= FULL_DIGITS_BELOW) return fmtShort(n);
  return exact || n < CENTS_BELOW ? fmt2(n) : fmtWhole(n);
}
export function fmtMoney(bn) {
  const n = bn.toNumber();
  if (!(Math.abs(n) < FULL_DIGITS_BELOW)) return bn.format(2);
  return (n < 0 ? '-' : '') + fmtDollars(Math.abs(n));
}
export function fmtCount(bn) {
  const n = bn.toNumber();
  return Math.abs(n) < FULL_DIGITS_BELOW ? Math.round(n).toLocaleString('en-US') : bn.format(2);
}
export function fmtSigned(n, exact = false) {
  return `${n < 0 ? '-' : '+'}$${fmtDollars(Math.abs(n), exact)}`;
}

// Chore rest countdown: "8.2s" under a minute, then "2:05" (rests grow with each chore today).
export function fmtRest(sec) {
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const whole = Math.ceil(sec);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// The two Money Bag tiles stay short so they fit at full size: cents under $1,000, whole
// dollars under $100,000, then K, M and B with three digits ($123K, $1.23M, $45.6B).
// Rounded down, so a tile never shows more than the kid has. (The cash pill keeps every digit.)
export function tileMoney(n) {
  const a = Math.abs(n);
  if (a < 1000) return `$${fmt2(a)}`;
  if (a < 1e5) return `$${fmtWhole(a)}`;
  const [div, unit] = a < 1e6 ? [1e3, 'K'] : a < 1e9 ? [1e6, 'M'] : [1e9, 'B'];
  const v = a / div;
  const dec = v < 10 ? 2 : v < 100 ? 1 : 0;
  const shown = Math.floor(v * 10 ** dec + 1e-6) / 10 ** dec;   // 1,230,000 / 1e6 * 100 is 122.99999...
  return `$${shown.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${unit}`;
}
