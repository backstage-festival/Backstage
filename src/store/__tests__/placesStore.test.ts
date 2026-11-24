import type { Coordinates } from "@/domain/entities/common";
import type { SavedPlace } from "@/domain/entities/SavedPlace";
import { DomainError } from "@/domain/errors/DomainError";
import type { SavePlaceInput, SavePlaceResult } from "@/use-cases/SavePlaceUseCase";

import {
  createPlacesStore,
  type PlacesStoreDeps,
  selectIsPlacePending,
  selectIsSavingPosition,
  selectTentPlace,
} from "../placesStore";
import { deferred } from "../testing/deferred";

const HERE: Coordinates = { latitude: 54.3618, longitude: 18.6472 };

const place = (id: string, savedAt: string, type: SavedPlace["type"] = "other", label = id): SavedPlace => ({
  id,
  userId: "user-1",
  label,
  type,
  location: { latitude: 54.36, longitude: 18.65 },
  savedAt,
});

const tent = place("p-tent", "2027-07-02T15:00:00Z", "tent", "Namiot");
const a = place("p-a", "2027-07-02T14:00:00Z");
const b = place("p-b", "2027-07-02T13:00:00Z");

describe("placesStore", () => {
  const makeDeps = () => ({
    savePlace: { execute: jest.fn<Promise<SavePlaceResult>, [SavePlaceInput]>() },
    location: {
      requestPermissions: jest.fn<Promise<boolean>, []>().mockResolvedValue(true),
      getCurrentPosition: jest.fn<Promise<Coordinates | null>, []>().mockResolvedValue(HERE),
    },
    loadPlaces: jest.fn<Promise<readonly SavedPlace[]>, [string]>(),
    removePlace: jest.fn<Promise<void>, [string]>(),
    renamePlace: jest.fn<Promise<void>, [SavedPlace]>(),
  });
  let deps: ReturnType<typeof makeDeps>;

  const setup = async (saved: readonly SavedPlace[] = [tent, a, b]) => {
    deps.loadPlaces.mockResolvedValueOnce(saved);
    const store = createPlacesStore(deps satisfies PlacesStoreDeps);
    await store.getState().load("user-1");
    return store;
  };

  const ids = (store: Awaited<ReturnType<typeof setup>>) => store.getState().saved.map((p) => p.id);

  beforeEach(() => {
    // Festival evening: later than every saved place, like a real save.
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    jest.setSystemTime(new Date("2027-07-02T17:00:00Z"));
    deps = makeDeps();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("load", () => {
    it("loads the places of the user, newest first", async () => {
      const store = await setup([b, tent, a]);

      expect(deps.loadPlaces).toHaveBeenCalledWith("user-1");
      expect(ids(store)).toEqual(["p-tent", "p-a", "p-b"]);
      expect(store.getState().loadStatus).toBe("ready");
      expect(selectTentPlace(store.getState())).toBe(store.getState().saved[0]);
    });

    it("sets loadFailed when loading fails", async () => {
      deps.loadPlaces.mockRejectedValueOnce(new Error("db"));
      const store = createPlacesStore(deps);

      await expect(store.getState().load("user-1")).resolves.toBe(false);
      expect(store.getState()).toMatchObject({ loadStatus: "error", lastError: { kind: "loadFailed" } });
    });

    it("keeps a place still being saved when a reload finishes", async () => {
      const store = await setup([a]);
      const saving = deferred<SavePlaceResult>();
      deps.savePlace.execute.mockReturnValueOnce(saving.promise);

      const adding = store.getState().savePosition("Nowe", "other");
      await flush();
      deps.loadPlaces.mockResolvedValueOnce([a]);
      await store.getState().load("user-1");

      expect(ids(store)).toEqual(["local-1", "p-a"]);
      saving.resolve({ place: place("p-new", "2027-07-02T16:00:00Z", "other", "Nowe"), replacedIds: [] });
      await adding;
      expect(ids(store)).toEqual(["p-new", "p-a"]);
    });
  });

  describe("savePosition", () => {
    it("shows the row at once with a temporary id, then swaps in the real id", async () => {
      const store = await setup([a]);
      const saving = deferred<SavePlaceResult>();
      deps.savePlace.execute.mockReturnValueOnce(saving.promise);

      const adding = store.getState().savePosition("  Scena  ", "other");
      await flush();

      expect(ids(store)).toEqual(["local-1", "p-a"]);
      expect(store.getState().saved[0]).toMatchObject({ label: "Scena", location: HERE });
      expect(selectIsPlacePending("local-1")(store.getState())).toBe(true);
      expect(selectIsSavingPosition(store.getState())).toBe(true);
      expect(deps.savePlace.execute).toHaveBeenCalledWith({
        userId: "user-1",
        label: "Scena",
        type: "other",
        location: HERE,
      });

      const saved = place("p-real", "2027-07-02T16:00:00Z", "other", "Scena");
      saving.resolve({ place: saved, replacedIds: [] });

      await expect(adding).resolves.toBe(true);
      expect(ids(store)).toEqual(["p-real", "p-a"]);
      expect(store.getState().pendingIds.size).toBe(0);
      expect(selectIsSavingPosition(store.getState())).toBe(false);
    });

    it("drops the tents the use case replaced", async () => {
      const store = await setup();
      const newTent = place("p-tent-2", "2027-07-02T16:00:00Z", "tent", "Namiot");
      deps.savePlace.execute.mockResolvedValueOnce({ place: newTent, replacedIds: ["p-tent"] });

      await store.getState().savePosition("Namiot", "tent");

      expect(ids(store)).toEqual(["p-tent-2", "p-a", "p-b"]);
    });

    it("rolls back only its own row when the write fails", async () => {
      const store = await setup();
      deps.savePlace.execute.mockRejectedValueOnce(new Error("disk full"));

      await expect(store.getState().savePosition("Scena", "other")).resolves.toBe(false);

      expect(ids(store)).toEqual(["p-tent", "p-a", "p-b"]);
      expect(store.getState().pendingIds.size).toBe(0);
      expect(store.getState().lastError).toEqual({ kind: "saveFailed" });
    });

    it("sets noLocation (permission denied) without adding a row", async () => {
      const store = await setup();
      deps.location.requestPermissions.mockResolvedValueOnce(false);

      await expect(store.getState().savePosition("Scena", "other")).resolves.toBe(false);

      expect(store.getState().lastError).toEqual({ kind: "noLocation", permissionDenied: true });
      expect(ids(store)).toEqual(["p-tent", "p-a", "p-b"]);
      expect(store.getState().locating).toBe(false);
      expect(deps.savePlace.execute).not.toHaveBeenCalled();
    });

    it("sets noLocation when there is no GPS fix", async () => {
      const store = await setup();
      deps.location.getCurrentPosition.mockResolvedValueOnce(null);

      await store.getState().savePosition("Scena", "other");

      expect(store.getState().lastError).toEqual({ kind: "noLocation", permissionDenied: false });
    });

    it("maps LOCATION_UNAVAILABLE from the use case to noLocation", async () => {
      const store = await setup();
      deps.savePlace.execute.mockRejectedValueOnce(new DomainError("LOCATION_UNAVAILABLE", "x"));

      await store.getState().savePosition("Scena", "other");

      expect(store.getState().lastError).toEqual({ kind: "noLocation", permissionDenied: false });
    });

    it("rejects an empty label before asking for GPS", async () => {
      const store = await setup();

      await expect(store.getState().savePosition("   ", "other")).resolves.toBe(false);

      expect(store.getState().lastError).toEqual({ kind: "invalidLabel" });
      expect(deps.location.requestPermissions).not.toHaveBeenCalled();
    });

    it("ignores a second tap while locating", async () => {
      const store = await setup();
      const permission = deferred<boolean>();
      deps.location.requestPermissions.mockReturnValueOnce(permission.promise);
      deps.savePlace.execute.mockResolvedValue({ place: place("p-x", "2027-07-02T16:00:00Z"), replacedIds: [] });

      const first = store.getState().savePosition("Scena", "other");
      await expect(store.getState().savePosition("Scena", "other")).resolves.toBe(false);
      permission.resolve(true);
      await first;

      expect(deps.savePlace.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe("remove", () => {
    it("removes at once and keeps it removed when the write succeeds", async () => {
      const store = await setup();
      const removing = deferred<void>();
      deps.removePlace.mockReturnValueOnce(removing.promise);

      const result = store.getState().remove("p-a");

      expect(ids(store)).toEqual(["p-tent", "p-b"]);
      expect(selectIsPlacePending("p-a")(store.getState())).toBe(true);
      removing.resolve();
      await expect(result).resolves.toBe(true);
      expect(store.getState().pendingIds.size).toBe(0);
    });

    it("puts the place back where it was when the write fails", async () => {
      const store = await setup();
      deps.removePlace.mockRejectedValueOnce(new Error("disk full"));

      await expect(store.getState().remove("p-a")).resolves.toBe(false);

      expect(ids(store)).toEqual(["p-tent", "p-a", "p-b"]);
      expect(store.getState().lastError).toEqual({ kind: "removeFailed", placeId: "p-a" });
    });

    it("blocks a second remove of the same place while the first is in flight", async () => {
      const store = await setup();
      const removing = deferred<void>();
      deps.removePlace.mockReturnValueOnce(removing.promise);

      const first = store.getState().remove("p-a");
      await expect(store.getState().remove("p-a")).resolves.toBe(false);
      removing.resolve();
      await first;

      expect(deps.removePlace).toHaveBeenCalledTimes(1);
    });
  });

  describe("rename", () => {
    it("renames at once through an upsert with the same id", async () => {
      const store = await setup();
      deps.renamePlace.mockResolvedValueOnce();

      await expect(store.getState().rename("p-a", " Bar ")).resolves.toBe(true);

      expect(store.getState().saved[1]).toMatchObject({ id: "p-a", label: "Bar" });
      expect(deps.renamePlace).toHaveBeenCalledWith({ ...a, label: "Bar" });
    });

    it("restores the old label when the write fails", async () => {
      const store = await setup();
      deps.renamePlace.mockRejectedValueOnce(new Error("disk full"));

      await expect(store.getState().rename("p-a", "Bar")).resolves.toBe(false);

      expect(store.getState().saved[1]?.label).toBe("p-a");
      expect(store.getState().lastError).toEqual({ kind: "renameFailed", placeId: "p-a" });
    });

    it("rejects an empty label", async () => {
      const store = await setup();

      await expect(store.getState().rename("p-a", "  ")).resolves.toBe(false);

      expect(store.getState().lastError).toEqual({ kind: "invalidLabel" });
      expect(deps.renamePlace).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("goes back to the initial state", async () => {
      const store = await setup();

      store.getState().reset();

      expect(store.getState()).toMatchObject({ userId: null, saved: [], loadStatus: "idle", lastError: null });
    });

    it("drops a save that finishes after reset", async () => {
      const store = await setup();
      const saving = deferred<SavePlaceResult>();
      deps.savePlace.execute.mockReturnValueOnce(saving.promise);

      const adding = store.getState().savePosition("Scena", "other");
      await flush();
      store.getState().reset();
      saving.reject(new Error("disk full"));
      await adding;

      expect(store.getState()).toMatchObject({ saved: [], lastError: null });
      expect(store.getState().pendingIds.size).toBe(0);
    });

    it("drops a load that finishes after reset", async () => {
      const loading = deferred<readonly SavedPlace[]>();
      deps.loadPlaces.mockReturnValueOnce(loading.promise);
      const store = createPlacesStore(deps);

      const load = store.getState().load("user-1");
      store.getState().reset();
      loading.resolve([tent]);

      await expect(load).resolves.toBe(false);
      expect(store.getState().saved).toEqual([]);
    });
  });
});

/** Lets the permission and GPS promises of savePosition() settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}
