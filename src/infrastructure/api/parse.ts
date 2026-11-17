export function isRecord(value: unknown): value is Record<string,unknown>{
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(obj: Record<string, unknown>, key: string): string | null {
  const value = obj[key]
  if (typeof value === "string"){
    const trimmed = value.trim()
    if( trimmed !== ""){
        return trimmed
    }
  }
  return null
}


export function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const value = obj[key]

  if (Number.isFinite(value) && typeof value === "number"){
    return value
  }
  return null 
}

export function readArray(obj: Record<string, unknown>, key: string): unknown[] | null {
  const value = obj[key]

  if(Array.isArray(value)){
    return value
  }
  return null
}

const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;

export function toIsoUtc(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  if (!HAS_TIMEZONE.test(value)) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function lastSundayUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year,month + 1, 0))
  const weekday = lastDay.getUTCDay()
  const lastDate = lastDay.getUTCDate()
  return Date.UTC(year, month, lastDate - weekday, 1);
}

function isPolishSummerTime(utcMs: number): boolean {
  const year = new Date(utcMs).getUTCFullYear();
  const start = lastSundayUtc(year, 2);
  const end = lastSundayUtc(year, 9);

  return start <= utcMs && utcMs < end;
}

const WARSAW_LOCAL = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const HOUR_MS = 60 * 60 * 1000;

export function warsawLocalToIsoUtc(value: unknown): string | null {
  if(typeof value !== "string"){
    return null
  }
const match = WARSAW_LOCAL.exec(value);
if (match === null) { return null; }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(asIfUtc);
if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1) { return null; }
  const winterGuess = asIfUtc - HOUR_MS;
if (isPolishSummerTime(winterGuess)) {
  return new Date(asIfUtc - 2 * HOUR_MS).toISOString();
}
return new Date(winterGuess).toISOString();
}