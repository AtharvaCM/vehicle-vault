import { EMPTY } from './empty';

type NumberInput = number | null | undefined;

const formatters = new Map<string, Intl.NumberFormat>();

/** One `Intl.NumberFormat` per option set: they are costly to build and every list row asks. */
function formatter(key: string, options: Intl.NumberFormatOptions) {
  let cached = formatters.get(key);

  if (!cached) {
    cached = new Intl.NumberFormat('en-IN', options);
    formatters.set(key, cached);
  }

  return cached;
}

function isReadable(value: NumberInput): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export type NumberOptions = {
  /** Most digits after the point, trimmed when zero. Default 2, so 42.5 litres never reads as 43. */
  decimals?: number;
  /** Always print `decimals` digits ("12.0"), for figures read down a column. */
  fixed?: boolean;
};

/** A plain figure in Indian grouping: 1,31,624. */
export function number(value: NumberInput, { decimals = 2, fixed = false }: NumberOptions = {}) {
  if (!isReadable(value)) return EMPTY;

  const minimumFractionDigits = fixed ? decimals : 0;

  return formatter(`n:${decimals}:${minimumFractionDigits}`, {
    maximumFractionDigits: decimals,
    minimumFractionDigits,
  }).format(value);
}

export type MoneyOptions = {
  /** ISO 4217 code. Records carry their own; everything else is rupees. */
  currency?: string | null;
  /** Digits after the point, always printed. Default 0 for rupees, 2 for anything else. */
  decimals?: number;
};

/** "₹1,31,624": rupees in Indian grouping, whole by default. */
export function money(value: NumberInput, { currency, decimals }: MoneyOptions = {}) {
  if (!isReadable(value)) return EMPTY;

  const code = currency || 'INR';
  const digits = decimals ?? (code === 'INR' ? 0 : 2);

  return formatter(`m:${code}:${digits}`, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** "12,480 km": whole kilometres, or "4.5 km" when asked for decimals. For distances travelled or still to go. */
export function distance(km: NumberInput, { decimals = 0 }: Pick<NumberOptions, 'decimals'> = {}) {
  if (!isReadable(km)) return EMPTY;

  return `${number(km, { decimals })} km`;
}

/** "31,800 km": an odometer reading, always whole kilometres. */
export function odometer(km: NumberInput) {
  return distance(km);
}
