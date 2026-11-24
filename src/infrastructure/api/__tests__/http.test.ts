import { ApiError, fetchJson } from "../http";

const URL = "https://example.test/data";

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
const originalFetch = global.fetch;

function fakeResponse(
  ok: boolean,
  status: number,
  json: () => Promise<unknown>,
): Response {
  const partial: Partial<Response> = { ok, status, json };
  return partial as Response;
}

describe("fetchJson", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("zwraca dane z JSON-a i wyłącza budzik", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(true, 200, () => Promise.resolve({ departures: [] })),
    );

    await expect(fetchJson(URL)).resolves.toEqual({ departures: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rzuca TIMEOUT, gdy serwer nie odpowie na czas", async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new Error("aborted"));
          });
        }),
    );

    const result = fetchJson(URL, 1_000);
    const assertion = expect(result).rejects.toMatchObject({ code: "TIMEOUT" });

    jest.advanceTimersByTime(1_000);

    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rzuca NETWORK, gdy nie ma internetu", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    await expect(fetchJson(URL)).rejects.toMatchObject({ code: "NETWORK" });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rzuca HTTP z numerem błędu, gdy serwer zwróci błąd", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(false, 500, () => Promise.resolve({})),
    );

    const error = await fetchJson(URL).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "HTTP" });
    expect((error as ApiError).message).toContain("500");
  });

  it("rzuca PARSE, gdy odpowiedź nie jest poprawnym JSON-em", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(true, 200, () =>
        Promise.reject(new SyntaxError("Unexpected token <")),
      ),
    );

    await expect(fetchJson(URL)).rejects.toMatchObject({ code: "PARSE" });
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("ApiError", () => {
  it("ma etykietę, tekst i nazwę oraz działa z instanceof", () => {
    const error = new ApiError("TIMEOUT", "za wolno");

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("TIMEOUT");
    expect(error.message).toBe("za wolno");
    expect(error.name).toBe("ApiError");
  });
});
