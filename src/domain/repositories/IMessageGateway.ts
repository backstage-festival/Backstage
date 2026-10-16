import type { IsoDateString } from "../entities/common";
import type { OutboxMessage } from "../entities/OutboxMessage";

export interface IMessageGateway {
  send(message: OutboxMessage): Promise<void>;
  fetchForCrew(
    crewId: string,
    since: IsoDateString | null,
  ): Promise<readonly OutboxMessage[]>;
}
