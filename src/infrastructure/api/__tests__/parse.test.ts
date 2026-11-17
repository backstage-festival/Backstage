import {
  isRecord,
  readArray,
  readNumber,
  readString,
  toIsoUtc,
  warsawLocalToIsoUtc,
} from "../parse";

describe("isRecord", () => {
  it("zwraca true dla zwykłego obiektu", () => {
    expect(isRecord({ stopId: 1 })).toBe(true);
    expect(isRecord({})).toBe(true);
  });

  it("zwraca false dla null, tablicy, tekstu i liczby", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
    expect(isRecord([1, 2])).toBe(false);
    expect(isRecord("abc")).toBe(false);
    expect(isRecord(42)).toBe(false);
  });
});

describe("readString", () => {
  it("zwraca tekst bez spacji na początku i końcu", () => {
    expect(readString({ name: "Brama Oliwska" }, "name")).toBe("Brama Oliwska");
    expect(readString({ name: "  Brama  " }, "name")).toBe("Brama");
  });

  it("zwraca null dla pustego tekstu, braku pola i innych typów", () => {
    expect(readString({ name: "   " }, "name")).toBeNull();
    expect(readString({ name: null }, "name")).toBeNull();
    expect(readString({ name: 123 }, "name")).toBeNull();
    expect(readString({}, "name")).toBeNull();
  });
});

describe("readNumber", () => {
  it("zwraca liczbę, także zero i liczby ujemne", () => {
    expect(readNumber({ lat: 54.35 }, "lat")).toBe(54.35);
    expect(readNumber({ delay: 0 }, "delay")).toBe(0);
    expect(readNumber({ delay: -205 }, "delay")).toBe(-205);
  });

  it("zwraca null dla NaN, Infinity, tekstu i braku pola", () => {
    expect(readNumber({ lat: NaN }, "lat")).toBeNull();
    expect(readNumber({ lat: Infinity }, "lat")).toBeNull();
    expect(readNumber({ lat: "54.35" }, "lat")).toBeNull();
    expect(readNumber({ lat: null }, "lat")).toBeNull();
    expect(readNumber({}, "lat")).toBeNull();
  });
});

describe("readArray", () => {
  it("zwraca tablicę, także pustą", () => {
    expect(readArray({ stops: [{ id: 1 }] }, "stops")).toEqual([{ id: 1 }]);
    expect(readArray({ stops: [] }, "stops")).toEqual([]);
  });

  it("zwraca null, gdy pole nie jest tablicą", () => {
    expect(readArray({ stops: { id: 1 } }, "stops")).toBeNull();
    expect(readArray({ stops: null }, "stops")).toBeNull();
    expect(readArray({}, "stops")).toBeNull();
  });
});

describe("toIsoUtc", () => {
  it("zostawia datę z Z w formacie UTC", () => {
    expect(toIsoUtc("2026-11-15T14:30:49Z")).toBe("2026-11-15T14:30:49.000Z");
  });

  it("przelicza datę z przesunięciem na UTC", () => {
    expect(toIsoUtc("2026-11-15T15:30:49+01:00")).toBe("2026-11-15T14:30:49.000Z");
    expect(toIsoUtc("2026-08-14T18:00:00+00:00")).toBe("2026-08-14T18:00:00.000Z");
  });

  it("zwraca null dla daty bez strefy, śmieci i nie-tekstu", () => {
    expect(toIsoUtc("2026-11-15 14:30:49")).toBeNull();
    expect(toIsoUtc("banan")).toBeNull();
    expect(toIsoUtc("2026-13-45T10:00:00Z")).toBeNull();
    expect(toIsoUtc(null)).toBeNull();
    expect(toIsoUtc(123)).toBeNull();
  });
});

describe("warsawLocalToIsoUtc", () => {
  it("odejmuje 1 godzinę zimą", () => {
    expect(warsawLocalToIsoUtc("2026-11-09 08:07:00")).toBe("2026-11-09T07:07:00.000Z");
    expect(warsawLocalToIsoUtc("2026-01-15 12:00:00")).toBe("2026-01-15T11:00:00.000Z");
  });

  it("odejmuje 2 godziny latem", () => {
    expect(warsawLocalToIsoUtc("2026-08-14 20:00:00")).toBe("2026-08-14T18:00:00.000Z");
  });

  it("dobrze liczy dni zmiany czasu w 2026", () => {
    // 29 marca: o 02:00 zegarki przeskakuja na 03:00
    expect(warsawLocalToIsoUtc("2026-03-29 01:30:00")).toBe("2026-03-29T00:30:00.000Z");
    expect(warsawLocalToIsoUtc("2026-03-29 03:30:00")).toBe("2026-03-29T01:30:00.000Z");
    // 25 pazdziernika: o 03:00 zegarki cofaja sie na 02:00
    expect(warsawLocalToIsoUtc("2026-10-24 12:00:00")).toBe("2026-10-24T10:00:00.000Z");
    expect(warsawLocalToIsoUtc("2026-10-25 12:00:00")).toBe("2026-10-25T11:00:00.000Z");
  });

  it("obsługuje rok, w którym ostatni dzień października jest niedzielą", () => {
    expect(warsawLocalToIsoUtc("2027-10-30 12:00:00")).toBe("2027-10-30T10:00:00.000Z");
    expect(warsawLocalToIsoUtc("2027-10-31 12:00:00")).toBe("2027-10-31T11:00:00.000Z");
  });

  it("przyjmuje też literę T zamiast spacji", () => {
    expect(warsawLocalToIsoUtc("2026-11-09T08:07:00")).toBe("2026-11-09T07:07:00.000Z");
  });

  it("zwraca null dla nieistniejącej daty, daty ze strefą, śmieci i nie-tekstu", () => {
    expect(warsawLocalToIsoUtc("2026-02-31 10:00:00")).toBeNull();
    expect(warsawLocalToIsoUtc("2026-13-01 10:00:00")).toBeNull();
    expect(warsawLocalToIsoUtc("2026-11-09T08:07:00Z")).toBeNull();
    expect(warsawLocalToIsoUtc("banan")).toBeNull();
    expect(warsawLocalToIsoUtc(null)).toBeNull();
  });
});
