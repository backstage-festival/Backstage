import { useCallback, useEffect, useMemo } from "react";

import { mockCrew, mockUsers } from "@/mocks/mockData";
import { selectDeliveryState, selectQueuedCount, useMessageStore } from "@/store";
import { strings } from "@/strings";

import { buildCrewItems, type CrewItem } from "./crewItems";
import { useNow } from "./useNow";
import { useSession } from "./useSession";

export type CrewStatus = "loading" | "error" | "empty" | "ready";

export interface CrewScreen {
  readonly status: CrewStatus;
  /** Newest first (inverted list). */
  readonly items: readonly CrewItem[];
  readonly queuedCount: number;
  readonly crewCode: string;
  readonly membersLabel: string;
  readonly send: (body: string) => Promise<boolean>;
  /** „Wyślij mimo to” (stale) and „Spróbuj ponownie” (failed) – both retry. */
  readonly retry: (messageId: string) => void;
  readonly reload: () => void;
}

// TEMP: crew code and members are not in the domain yet (#71 Q6).
const memberNames = mockCrew.memberIds.flatMap((id) => {
  const user = mockUsers.find((u) => u.id === id);
  return user ? [user.login] : [];
});

/** The only place the Crew screen reads stores. */
export function useCrewScreen(): CrewScreen {
  const { userId, crewId } = useSession();
  const now = useNow();

  const messages = useMessageStore((state) => state.messages);
  const pendingIds = useMessageStore((state) => state.pendingIds);
  const loadStatus = useMessageStore((state) => state.loadStatus);
  const load = useMessageStore((state) => state.load);
  const sendMessage = useMessageStore((state) => state.send);
  const retryMessage = useMessageStore((state) => state.retry);

  useEffect(() => {
    void load(crewId);
  }, [load, crewId]);

  const items = useMemo(
    () =>
      buildCrewItems({
        messages,
        currentUserId: userId,
        pendingIds,
        now,
        deliveryStateOf: selectDeliveryState,
        // TEMP: no display name yet (#71 Q10)
        senderName: strings.crewScreen.fallbackName,
      }),
    [messages, userId, pendingIds, now],
  );
  const queuedCount = useMemo(() => selectQueuedCount({ messages }, now), [messages, now]);

  const send = useCallback((body: string) => sendMessage(body, userId), [sendMessage, userId]);
  const retry = useCallback(
    (messageId: string) => {
      void retryMessage(messageId);
    },
    [retryMessage],
  );
  const reload = useCallback(() => {
    void load(crewId);
  }, [load, crewId]);

  let status: CrewStatus = "ready";
  if (messages.length === 0) {
    if (loadStatus === "idle" || loadStatus === "loading") status = "loading";
    else if (loadStatus === "error") status = "error";
    else status = "empty";
  }

  return {
    status,
    items,
    queuedCount,
    crewCode: mockCrew.code,
    membersLabel: memberNames.length > 0 ? strings.crewScreen.members(memberNames) : strings.crewScreen.onlyYou,
    send,
    retry,
    reload,
  };
}
