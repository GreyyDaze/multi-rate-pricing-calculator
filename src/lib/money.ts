import Decimal from "decimal.js";

const SCALE = 2;

export function toDecimal(value: Decimal.Value | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function round2(value: Decimal.Value | Decimal): Decimal {
  return toDecimal(value).toDP(SCALE, Decimal.ROUND_HALF_UP);
}

export function formatMoney(value: Decimal.Value | Decimal): string {
  return toDecimal(value).toFixed(SCALE);
}