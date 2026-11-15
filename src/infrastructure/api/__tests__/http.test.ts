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

  it("returns parsed JSON and clears the timeout timer", async () => {
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

  it("throws TIMEOUT when the server does not answer in time", async () => {
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

  it("throws NETWORK when there is no connection", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));

    await expect(fetchJson(URL)).rejects.toMatchObject({ code: "NETWORK" });
    expect(jest.getTimerCount()).toBe(0);
  });

  it("throws HTTP with the status code when the server returns an error", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(false, 500, () => Promise.resolve({})),
    );

    const error = await fetchJson(URL).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "HTTP" });
    expect((error as ApiError).message).toContain("500");
  });

  it("throws PARSE when the body is not valid JSON", async () => {
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
  it("keeps code, message, name and works with instanceof", () => {
    const error = new ApiError("TIMEOUT", "too slow");

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("TIMEOUT");
    expect(error.message).toBe("too slow");
    expect(error.name).toBe("ApiError");
  });
});
