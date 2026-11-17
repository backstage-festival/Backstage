import { CkanClient, stripHtml } from "../CkanClient";
import { ApiError } from "../http";

const NOW = new Date("2026-11-15T12:00:00Z");

function clientReturning(response: unknown) {
  const fetcher = jest.fn<Promise<unknown>, [string]>().mockResolvedValue(response);
  const client = new CkanClient(fetcher, () => NOW);
  return { client, fetcher };
}

function stopRow(overrides: Record<string, unknown> = {}) {
  return {
    stopId: 1752,
    stopName: "Brama Oliwska",
    subName: "01",
    stopDesc: "Gdansk Brama Oliwska",
    stopLat: 54.3612,
    stopLon: 18.6456,
    virtual: 0,
    nonpassenger: 0,
    depot: 0,
    ...overrides,
  };
}

function departureRow(overrides: Record<string, unknown> = {}) {
  return {
    routeId: 127,
    routeShortName: "127",
    headsign: "Oliwa PKP",
    estimatedTime: "2026-11-15T14:30:49Z",
    theoreticalTime: "2026-11-15T14:28:00Z",
    delayInSeconds: 169,
    ...overrides,
  };
}

function alertRow(overrides: Record<string, unknown> = {}) {
  return {
    title: "Awaryjna zmiana trasy linii 195",
    summary: null,
    content: "<p>Objazd dla linii 195.</p>\n<p>Przystanek Wawelska 01 nieobslugiwany.</p>",
    url: "https://ztm.gda.pl/komunikaty/11936",
    publishFrom: "2026-11-09 08:07:00",
    publishTo: "9999-12-31 23:59:59",
    ...overrides,
  };
}

describe("CkanClient.fetchStops", () => {
  it("zamienia przystanki na encje Stop z nazwą i numerem słupka", async () => {
    const { client } = clientReturning({
      "2026-11-15": { lastUpdate: "2026-11-15 02:26:49", stops: [stopRow()] },
    });

    await expect(client.fetchStops()).resolves.toEqual([
      {
        id: 1752,
        name: "Brama Oliwska 01",
        location: { latitude: 54.3612, longitude: 18.6456 },
      },
    ]);
  });

  it("bierze dzisiejszy dzień z pliku, a gdy go brak - najnowszy", async () => {
    const withToday = clientReturning({
      "2026-11-14": { stops: [stopRow({ stopId: 1 })] },
      "2026-11-15": { stops: [stopRow({ stopId: 2 })] },
      "2026-11-16": { stops: [stopRow({ stopId: 3 })] },
    });
    const withoutToday = clientReturning({
      "2026-11-12": { stops: [stopRow({ stopId: 1 })] },
      "2026-11-13": { stops: [stopRow({ stopId: 2 })] },
    });

    const today = await withToday.client.fetchStops();
    const newest = await withoutToday.client.fetchStops();

    expect(today.map((stop) => stop.id)).toEqual([2]);
    expect(newest.map((stop) => stop.id)).toEqual([2]);
  });

  it("pomija zepsute wiersze i przystanki techniczne", async () => {
    const { client } = clientReturning({
      "2026-11-15": {
        stops: [
          stopRow({ stopId: 1 }),
          null,
          "smieci",
          stopRow({ stopId: 2, stopLat: null }),
          stopRow({ stopId: 3, stopLat: 120 }),
          stopRow({ stopId: 4, virtual: 1 }),
          stopRow({ stopId: 5, depot: 1 }),
          stopRow({ stopId: 6, stopName: "", subName: null }),
        ],
      },
    });

    const stops = await client.fetchStops();

    expect(stops.map((stop) => stop.id)).toEqual([1, 6]);
    expect(stops[1]?.name).toBe("Gdansk Brama Oliwska");
  });

  it("rzuca PARSE, gdy odpowiedź nie ma listy przystanków", async () => {
    await expect(clientReturning([]).client.fetchStops()).rejects.toMatchObject({
      code: "PARSE",
    });
    await expect(
      clientReturning({ "2026-11-15": { stops: "nie lista" } }).client.fetchStops(),
    ).rejects.toMatchObject({ code: "PARSE" });
  });
});

describe("CkanClient.fetchDepartures", () => {
  it("pyta o właściwy przystanek i zamienia odjazdy na encje", async () => {
    const { client, fetcher } = clientReturning({
      lastUpdate: "2026-11-15T14:28:40Z",
      departures: [departureRow()],
    });

    const departures = await client.fetchDepartures(1752);

    expect(fetcher).toHaveBeenCalledWith(
      "https://ckan2.multimediagdansk.pl/departures?stopId=1752",
    );
    expect(departures).toEqual([
      {
        stopId: 1752,
        routeName: "127",
        headsign: "Oliwa PKP",
        departureAt: "2026-11-15T14:30:49.000Z",
        delaySeconds: 169,
        fetchedAt: "2026-11-15T14:28:40.000Z",
      },
    ]);
  });

  it("używa godziny z rozkładu, gdy brak godziny na żywo, i sortuje po czasie", async () => {
    const { client } = clientReturning({
      lastUpdate: "2026-11-15T14:28:40Z",
      departures: [
        departureRow({ headsign: "Pozniej", estimatedTime: "2026-11-15T15:00:00Z" }),
        departureRow({
          headsign: "Wczesniej",
          estimatedTime: null,
          theoreticalTime: "2026-11-15T14:40:00Z",
          delayInSeconds: null,
        }),
      ],
    });

    const departures = await client.fetchDepartures(1752);

    expect(departures.map((d) => d.headsign)).toEqual(["Wczesniej", "Pozniej"]);
    expect(departures[0]?.departureAt).toBe("2026-11-15T14:40:00.000Z");
    expect(departures[0]?.delaySeconds).toBeNull();
  });

  it("pomija zepsute odjazdy, a bez lastUpdate bierze aktualny czas", async () => {
    const { client } = clientReturning({
      departures: [
        departureRow(),
        departureRow({ headsign: null }),
        departureRow({ estimatedTime: "banan", theoreticalTime: null }),
        departureRow({ routeShortName: null, routeId: 158 }),
        42,
      ],
    });

    const departures = await client.fetchDepartures(1752);

    expect(departures).toHaveLength(2);
    expect(departures.map((d) => d.routeName)).toEqual(["127", "158"]);
    expect(departures[0]?.fetchedAt).toBe(NOW.toISOString());
  });

  it("rzuca PARSE, gdy odpowiedź nie ma listy odjazdów", async () => {
    await expect(
      clientReturning({ lastUpdate: "2026-11-15T14:28:40Z" }).client.fetchDepartures(1),
    ).rejects.toMatchObject({ code: "PARSE" });
  });

  it("przepuszcza dalej błąd sieci z fetchera", async () => {
    const fetcher = jest
      .fn<Promise<unknown>, [string]>()
      .mockRejectedValue(new ApiError("TIMEOUT", "za wolno"));
    const client = new CkanClient(fetcher, () => NOW);

    await expect(client.fetchDepartures(1752)).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("CkanClient.fetchAlerts", () => {
  it("zamienia komunikat na encję: czas polski na UTC, HTML na tekst, 9999 na brak końca", async () => {
    const { client } = clientReturning({
      metadata: { generationDate: "2026-11-15T14:29:02Z" },
      count: 1,
      results: [alertRow()],
    });

    await expect(client.fetchAlerts()).resolves.toEqual([
      {
        id: "https://ztm.gda.pl/komunikaty/11936",
        title: "Awaryjna zmiana trasy linii 195",
        body: "Objazd dla linii 195.\nPrzystanek Wawelska 01 nieobslugiwany.",
        validFrom: "2026-11-09T07:07:00.000Z",
        validTo: null,
        fetchedAt: "2026-11-15T14:29:02.000Z",
      },
    ]);
  });

  it("przelicza datę końca i radzi sobie bez treści i adresu", async () => {
    const { client } = clientReturning({
      results: [
        alertRow({
          content: null,
          summary: null,
          url: null,
          publishTo: "2026-08-14 23:00:00",
        }),
      ],
    });

    const [alert] = await client.fetchAlerts();

    expect(alert?.validTo).toBe("2026-08-14T21:00:00.000Z");
    expect(alert?.body).toBe("Awaryjna zmiana trasy linii 195");
    expect(alert?.id).toBe("Awaryjna zmiana trasy linii 195|2026-11-09T07:07:00.000Z");
    expect(alert?.fetchedAt).toBe(NOW.toISOString());
  });

  it("pomija komunikaty bez tytułu albo daty początku", async () => {
    const { client } = clientReturning({
      results: [alertRow(), alertRow({ title: null }), alertRow({ publishFrom: "wczoraj" }), null],
    });

    await expect(client.fetchAlerts()).resolves.toHaveLength(1);
  });

  it("rzuca PARSE, gdy odpowiedź nie ma listy komunikatów", async () => {
    await expect(clientReturning("<html>").client.fetchAlerts()).rejects.toMatchObject({
      code: "PARSE",
    });
  });
});

describe("stripHtml", () => {
  it("usuwa znaczniki, zamienia akapity na nowe linie i dekoduje encje", () => {
    expect(stripHtml("<p>Linia&nbsp;195</p><p>Tom &amp; Jerry<br/>dalej</p>")).toBe(
      "Linia 195\nTom & Jerry\ndalej",
    );
  });

  it("zwraca null, gdy po usunięciu znaczników nic nie zostaje", () => {
    expect(stripHtml("<p> </p>")).toBeNull();
  });
});
