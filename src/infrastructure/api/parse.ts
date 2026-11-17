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