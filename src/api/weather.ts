// src/api/weather.ts
import axios from 'axios';

export type WeatherNow = {
  temperature: number | null;
  windspeed: number | null;
  winddirection?: number | null;
  humidity?: number | null;
  pressure?: number | null;
  precipitation?: number | null;
  precipitation_probability?: number | null;
  cloudcover?: number | null;
  uv_index?: number | null;
  visibility?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  raw?: any;
};

export async function fetchWeatherAt(lat: number, lon: number): Promise<WeatherNow> {
  try {
    const base = 'https://api.open-meteo.com/v1/forecast';
    // request current_weather + hourly fields and daily sunrise/sunset
    const params = [
      `latitude=${encodeURIComponent(lat)}`,
      `longitude=${encodeURIComponent(lon)}`,
      `current_weather=true`,
      `hourly=relativehumidity_2m,pressure_msl,precipitation,cloudcover,uv_index,visibility,precipitation_probability`,
      `daily=sunrise,sunset`,
      `timezone=auto`,
    ].join('&');
    const url = `${base}?${params}`;

    const resp = await axios.get(url, { timeout: 10000 });
    const data = resp.data;

    const current = data.current_weather ?? null;
    let humidity: number | null = null;
    let pressure: number | null = null;
    let precipitation: number | null = null;
    let cloudcover: number | null = null;
    let uv_index: number | null = null;
    let visibility: number | null = null;
    let precipitation_probability: number | null = null;
    let sunrise: string | null = null;
    let sunset: string | null = null;

    try {
      if (data.hourly && data.hourly.relativehumidity_2m) {
        humidity = data.hourly.relativehumidity_2m[0] ?? null;
      }
      if (data.hourly && data.hourly.pressure_msl) {
        pressure = data.hourly.pressure_msl[0] ?? null;
      }
      if (data.hourly && data.hourly.precipitation) {
        precipitation = data.hourly.precipitation[0] ?? null;
      }
      if (data.hourly && data.hourly.cloudcover) {
        cloudcover = data.hourly.cloudcover[0] ?? null;
      }
      if (data.hourly && data.hourly.uv_index) {
        uv_index = data.hourly.uv_index[0] ?? null;
      }
      if (data.hourly && data.hourly.visibility) {
        visibility = data.hourly.visibility[0] ?? null;
      }
      if (data.hourly && data.hourly.precipitation_probability) {
        precipitation_probability = data.hourly.precipitation_probability[0] ?? null;
      }
      if (data.daily && data.daily.sunrise && data.daily.sunset) {
        sunrise = data.daily.sunrise[0] ?? null;
        sunset = data.daily.sunset[0] ?? null;
      }
    } catch (e) {
      // ignore
    }

    return {
      temperature: current ? current.temperature : null,
      windspeed: current ? current.windspeed : null,
      winddirection: current ? current.winddirection : null,
      humidity,
      pressure,
      precipitation,
      cloudcover,
      uv_index,
      visibility,
      precipitation_probability,
      sunrise,
      sunset,
      raw: data,
    };
  } catch (err) {
    return { temperature: null, windspeed: null, humidity: null, pressure: null, raw: null };
  }
}
