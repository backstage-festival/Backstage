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