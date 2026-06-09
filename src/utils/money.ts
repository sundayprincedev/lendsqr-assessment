import { KOBO_PER_NAIRA } from '../config/constants';

export function nairaToKobo(amount: number): number {
  return Math.round(amount * KOBO_PER_NAIRA);
}

export function koboToNaira(kobo: number): string {
  const naira = kobo / KOBO_PER_NAIRA;
  return naira.toFixed(2);
}

export function formatKoboAsNaira(kobo: number): string {
  return koboToNaira(kobo);
}
