import {
  asNumber,
  buildForecasts,
  OpenMeteoClient,
  openMeteoHourToIso,
  weatherCodeToSummary,
} from "../OpenMeteoClient";

const NOW = new Date("2026-11-23T12:00:00Z");
const EVENT_ID = "e1";
const GDANSK = { latitude: 54.36, longitude: 18.65 };

function clientReturning(response: unknown) {
  const fetcher = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(response);
  const client = new OpenMeteoClient(fetcher, () => NOW);
  return { client, fetcher };
}

const okResponse = {
  latitude: 54.3596,
  longitude: 18.664854,
  timezone: "GMT",
  hourly: {
    time: ["2026-11-23T00:00", "2026-11-23T01:00"],
    temperature_2m: [3.1, -0.5],
    precipitation: [0, 0.4],
    weather_code: [3, 61],
  },
};

describe("OpenMeteoClient.fetchForecast", () => {
  it("pyta o właściwe miejsce i pola pogody w UTC", async () => {
    const { client, fetcher } = clientReturning(okResponse);

    await client.fetchForecast(EVENT_ID, GDANSK);

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.open-meteo.com/v1/forecast?latitude=54.36&longitude=18.65" +
        "&hourly=temperature_2m,precipitation,weather_code&timezone=GMT",
    );
  });

  it("zamienia godziny na encje WeatherForecast", async () => {
    const { client } = clientReturning(okResponse);

    await expect(client.fetchForecast(EVENT_ID, GDANSK)).resolves.toEqual([
      {
        eventId: EVENT_ID,
        forecastFor: "2026-11-23T00:00:00.000Z",
        temperatureC: 3.1,
        rainMm: 0,
        summary: "cloudy",
        fetchedAt: NOW.toISOString(),
      },
      {
        eventId: EVENT_ID,
        forecastFor: "2026-11-23T01:00:00.000Z",
        temperatureC: -0.5,
        rainMm: 0.4,
        summary: "rain",
        fetchedAt: NOW.toISOString(),
      },
    ]);
  });

  it("rzuca PARSE, gdy brak danych godzinowych albo którejś listy", async () => {
    await expect(
      clientReturning({ latitude: 54 }).client.fetchForecast(EVENT_ID, GDANSK),
    ).rejects.toMatchObject({ code: "PARSE" });
    await expect(
      clientReturning({
        hourly: { ...okResponse.hourly, weather_code: "nie lista" },
      }).client.fetchForecast(EVENT_ID, GDANSK),
    ).rejects.toMatchObject({ code: "PARSE" });
    await expect(
      clientReturning("<html>").client.fetchForecast(EVENT_ID, GDANSK),
    ).rejects.toMatchObject({ code: "PARSE" });
  });
});

describe("buildForecasts", () => {
  it("składa jedną prognozę z tej samej pozycji w czterech listach", () => {
    const result = buildForecasts(EVENT_ID, NOW.toISOString(), {
      times: ["2026-08-14T18:00"],
      temperatures: [21.5],
      precipitation: [1.2],
      weatherCodes: [95],
    });

    expect(result).toEqual([
      {
        eventId: EVENT_ID,
        forecastFor: "2026-08-14T18:00:00.000Z",
        temperatureC: 21.5,
        rainMm: 1.2,
        summary: "storm",
        fetchedAt: NOW.toISOString(),
      },
    ]);
  });

  it("pomija zepsute godziny, a resztę zostawia", () => {
    const result = buildForecasts(EVENT_ID, NOW.toISOString(), {
      times: ["2026-08-14T18:00", "banan", "2026-08-14T20:00", "2026-08-14T21:00", "2026-08-14T22:00", "2026-08-14T23:00"],
      temperatures: [20, 19, null, 17, 16, 15],
      precipitation: [0, 0, 0, -1, 0, 0],
      weatherCodes: [0, 0, 0, 0, 999, 1],
    });

    expect(result.map((f) => f.forecastFor)).toEqual([
      "2026-08-14T18:00:00.000Z",
      "2026-08-14T23:00:00.000Z",
    ]);
  });

  it("bierze tylko tyle godzin, ile ma najkrótsza lista", () => {
    const result = buildForecasts(EVENT_ID, NOW.toISOString(), {
      times: ["2026-08-14T18:00", "2026-08-14T19:00", "2026-08-14T20:00"],
      temperatures: [20, 19],
      precipitation: [0, 0, 0],
      weatherCodes: [0, 0, 0],
    });

    expect(result).toHaveLength(2);
  });

  it("dla pustych list zwraca pustą listę", () => {
    expect(
      buildForecasts(EVENT_ID, NOW.toISOString(), {
        times: [],
        temperatures: [],
        precipitation: [],
        weatherCodes: [],
      }),
    ).toEqual([]);
  });
});

describe("weatherCodeToSummary", () => {
  it.each([
    [0, "clear"],
    [1, "clear"],
    [2, "cloudy"],
    [3, "cloudy"],
    [45, "fog"],
    [48, "fog"],
    [51, "rain"],
    [61, "rain"],
    [67, "rain"],
    [80, "rain"],
    [82, "rain"],
    [71, "snow"],
    [77, "snow"],
    [85, "snow"],
    [86, "snow"],
    [95, "storm"],
    [96, "storm"],
    [99, "storm"],
  ])("kod %i to %s", (code, summary) => {
    expect(weatherCodeToSummary(code)).toBe(summary);
  });

  it("zwraca null dla nieznanego kodu", () => {
    expect(weatherCodeToSummary(4)).toBeNull();
    expect(weatherCodeToSummary(70)).toBeNull();
    expect(weatherCodeToSummary(999)).toBeNull();
    expect(weatherCodeToSummary(-1)).toBeNull();
  });
});

describe("pomocnicze", () => {
  it("asNumber przepuszcza tylko prawdziwe liczby", () => {
    expect(asNumber(3.5)).toBe(3.5);
    expect(asNumber(0)).toBe(0);
    expect(asNumber(NaN)).toBeNull();
    expect(asNumber("3")).toBeNull();
    expect(asNumber(null)).toBeNull();
  });

  it("openMeteoHourToIso dokleja strefę UTC", () => {
    expect(openMeteoHourToIso("2026-11-23T14:00")).toBe("2026-11-23T14:00:00.000Z");
    expect(openMeteoHourToIso("banan")).toBeNull();
    expect(openMeteoHourToIso(null)).toBeNull();
  });
});
