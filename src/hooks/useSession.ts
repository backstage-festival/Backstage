import { mockCrewId, mockCurrentUserId, mockEvent } from "@/mocks/mockData";
import { useAuthStore } from "@/store";

export interface Session {
  readonly userId: string;
  readonly eventId: string;
  readonly crewId: string;
}

/**
 * Who is using the app and for which festival / crew. Screens never read
 * auth directly. Without a session the mock user is used – there is no
 * redirect to login in #28.
 */
export function useSession(): Session {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  return {
    // TEMP: until session contract (#71 Q5)
    userId: userId ?? mockCurrentUserId,
    // TEMP: until session contract (#71 Q5)
    eventId: mockEvent.id,
    // TEMP: until session contract (#71 Q5)
    crewId: mockCrewId,
  };
}
