import { buildInjectedCommand, parseMapEvent, type MapMarker } from "../mapMessages";

describe("buildInjectedCommand", () => {
  it("wraps the command in a call to the page's command handler", () => {
    const markers: MapMarker[] = [{ id: "p1", type: "toilet", latitude: 1, longitude: 2 }];
    const script = buildInjectedCommand({ type: "setMarkers", markers });

    expect(script).toContain("window.__backstageHandleCommand");
    expect(script.trim().endsWith("true;")).toBe(true);
    expect(script).toContain('"type":"setMarkers"');
    expect(script).toContain('"id":"p1"');
  });

  it("serializes a centerOn command", () => {
    const script = buildInjectedCommand({ type: "centerOn", latitude: 54.36, longitude: 18.64, zoom: 17 });
    expect(script).toContain('"type":"centerOn"');
    expect(script).toContain('"zoom":17');
  });
});

describe("parseMapEvent", () => {
  it("parses a mapReady event", () => {
    expect(parseMapEvent(JSON.stringify({ type: "mapReady" }))).toEqual({ type: "mapReady" });
  });

  it("parses a markerPressed event", () => {
    expect(parseMapEvent(JSON.stringify({ type: "markerPressed", markerId: "p1" }))).toEqual({
      type: "markerPressed",
      markerId: "p1",
    });
  });

  it("parses a boundsChanged event", () => {
    const bounds = { minLatitude: 1, maxLatitude: 2, minLongitude: 3, maxLongitude: 4 };
    expect(parseMapEvent(JSON.stringify({ type: "boundsChanged", bounds }))).toEqual({
      type: "boundsChanged",
      bounds,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseMapEvent("{not json")).toBeNull();
  });

  it("returns null for an unknown event type", () => {
    expect(parseMapEvent(JSON.stringify({ type: "somethingElse" }))).toBeNull();
  });

  it("returns null when markerPressed is missing markerId", () => {
    expect(parseMapEvent(JSON.stringify({ type: "markerPressed" }))).toBeNull();
  });

  it("returns null when boundsChanged has a malformed bounds object", () => {
    expect(
      parseMapEvent(JSON.stringify({ type: "boundsChanged", bounds: { minLatitude: 1 } })),
    ).toBeNull();
  });

  it("returns null for a non-object payload", () => {
    expect(parseMapEvent(JSON.stringify("just a string"))).toBeNull();
    expect(parseMapEvent(JSON.stringify(42))).toBeNull();
    expect(parseMapEvent(JSON.stringify(null))).toBeNull();
  });
});
