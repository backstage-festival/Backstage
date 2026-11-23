import type { IsoDateString } from "./common";

export type WeatherSummary =
  | "clear"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "storm";

export interface WeatherForecast {
  readonly eventId: string;
  readonly forecastFor: IsoDateString;
  readonly temperatureC: number;
  readonly rainMm: number;
  readonly summary: WeatherSummary;
  readonly fetchedAt: IsoDateString;
}
