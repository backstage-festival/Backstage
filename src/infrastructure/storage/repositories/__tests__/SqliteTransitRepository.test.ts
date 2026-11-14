import { SqliteTransitRepository } from "../SqliteTransitRepository";

const mockDb = {
  getAllAsync: jest.fn(),
};

jest.mock("../../database", () => ({
  getDb: async () => mockDb,
}));

describe("SqliteTransitRepository", () => {
  it("getStopsInBounds podaje granice w kolejności BETWEEN", async () => {
    mockDb.getAllAsync.mockResolvedValue([
      { id: 1, name: "Stocznia SKM", latitude: 54.36, longitude: 18.64 },
    ]);
    const repo = new SqliteTransitRepository();

    const stops = await repo.getStopsInBounds({
      minLatitude: 54.3,
      maxLatitude: 54.4,
      minLongitude: 18.6,
      maxLongitude: 18.7,
    });

    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?"),
      [54.3, 54.4, 18.6, 18.7],
    );
    expect(stops).toEqual([
      { id: 1, name: "Stocznia SKM", location: { latitude: 54.36, longitude: 18.64 } },
    ]);
  });
});