export type BadgeCode =
  | "prepared"
  | "night_owl"
  | "all_three_days"
  | "three_stages";

export interface BadgeProgress {
  readonly code: BadgeCode;
  readonly progress: number;
  readonly goal: number;
  readonly earned: boolean;
}
