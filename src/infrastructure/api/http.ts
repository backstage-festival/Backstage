export type ApiErrorCode = "TIMEOUT" | "HTTP" | "NETWORK" | "PARSE";

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(etykieta: ApiErrorCode, text: string) {
    super(text);
    this.code = etykieta;
    this.name = "ApiError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchJson(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try{
    let res: Response;
    try{
        res = await fetch(url, {signal: controller.signal});
    }catch{
        if(controller.signal.aborted){
            throw new ApiError("TIMEOUT", "Minął czas na połączenie")
        }
        throw new ApiError("NETWORK", "Brak dostępu do internetu" )
    }

    if(!res.ok){
        throw new ApiError("HTTP", `Serwer zwrocil blad ${res.status}`)
    }

    try{
        const data: unknown = await res.json()
        return data
    }catch{
        throw new ApiError("PARSE", "Odpowiedz serwera nie jest poprawnym JSON-em" )
    }

  }finally{
    clearTimeout(timer)
  }
}
