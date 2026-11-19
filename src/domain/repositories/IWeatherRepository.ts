import type { WeatherForecast } from "../entities/Weather";

export interface IWeatherRepository {
  getForecast(eventId: string): Promise<readonly WeatherForecast[]>;
  saveForecast(
    eventId: string,
    forecasts: readonly WeatherForecast[],
  ): Promise<void>;
}
