import type { SupabaseClient } from "@supabase/supabase-js";

import type { IsoDateString } from "../../domain/entities/common";
import type { OutboxMessage } from "../../domain/entities/OutboxMessage";
import type { IMessageGateway } from "../../domain/repositories/IMessageGateway";
import { ApiError } from "./http";
import { isRecord, readString, toIsoUtc } from "./parse";

export class SupabaseMessageGateway implements IMessageGateway {
  constructor(private readonly supabase: SupabaseClient) {}

  async send(message: OutboxMessage): Promise<void> {
    const authorId = await this.currentUserId();
    const { error } = await this.supabase.from("messages").upsert(
      {
        id: message.id,
        crew_id: message.crewId,
        author_id: authorId,
        body: message.body,
        created_at: message.createdAt,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error !== null) {
      throw new ApiError("HTTP", `Nie udalo sie wyslac wiadomosci: ${error.message}`);
    }
  }

  async fetchForCrew(
    crewId: string,
    since: IsoDateString | null,
  ): Promise<readonly OutboxMessage[]> {
    let query = this.supabase
      .from("messages")
      .select("id, crew_id, author_id, body, created_at, sent_at")
      .eq("crew_id", crewId)
      .order("created_at");
    if (since !== null) {
      query = query.gt("created_at", since);
    }

    const { data, error } = await query;
    if (error !== null) {
      throw new ApiError("HTTP", `Nie udalo sie pobrac wiadomosci: ${error.message}`);
    }
    if (!Array.isArray(data)) {
      throw new ApiError("PARSE", "Supabase zwrocil wiadomosci w zlym formacie");
    }

    return data.map(mapMessage).filter((m): m is OutboxMessage => m !== null);
  }

  private async currentUserId(): Promise<string> {
    const { data } = await this.supabase.auth.getSession();
    if (data.session !== null) {
      return data.session.user.id;
    }

    const result = await this.supabase.auth.signInAnonymously();
    if (result.error !== null || result.data.user === null) {
      throw new ApiError("HTTP", "Nie udalo sie zalogowac anonimowo do Supabase");
    }
    return result.data.user.id;
  }
}

function mapMessage(row: unknown): OutboxMessage | null {
  if (!isRecord(row)) {
    return null;
  }
  const id = readString(row, "id");
  const crewId = readString(row, "crew_id");
  const authorId = readString(row, "author_id");
  const body = readString(row, "body");
  const createdAt = toIsoUtc(row["created_at"]);
  const sentAt = toIsoUtc(row["sent_at"]);
  if (
    id === null ||
    crewId === null ||
    authorId === null ||
    body === null ||
    createdAt === null ||
    sentAt === null
  ) {
    return null;
  }
  return {
    id,
    crewId,
    authorId,
    body,
    status: "sent",
    attempts: 0,
    createdAt,
    nextAttemptAt: null,
    sentAt,
  };
}
