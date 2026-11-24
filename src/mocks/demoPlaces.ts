// TEMP: mock data until #32 (DI)
import type { SavedPlace } from "@/domain/entities/SavedPlace";

import { mockCurrentUserId } from "./mockData";

/** Saved places near the festival gate (mockGatePosition), newest first. */
export const mockSavedPlaces: readonly SavedPlace[] = [
  {
    id: "p-tent",
    userId: mockCurrentUserId,
    label: "Namiot",
    type: "tent",
    location: { latitude: 54.3637, longitude: 18.6494 },
    savedAt: "2027-07-02T15:20:00+02:00",
  },
  {
    id: "p-meeting",
    userId: mockCurrentUserId,
    label: "Zbiórka pod Dokami",
    type: "meeting_point",
    location: { latitude: 54.3632, longitude: 18.6505 },
    savedAt: "2027-07-02T15:10:00+02:00",
  },
  {
    id: "p-parking",
    userId: mockCurrentUserId,
    label: "Auto, rząd F",
    type: "parking",
    location: { latitude: 54.3561, longitude: 18.6398 },
    savedAt: "2027-07-02T14:30:00+02:00",
  },
];
