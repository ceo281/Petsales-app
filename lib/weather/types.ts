/** Icon groups the widget knows how to draw. */
export type IconKind = "sun" | "moon" | "partly-day" | "partly-night" | "cloud" | "fog" | "showers" | "rain" | "storm" | "snow";

export type DayForecast = {
  date: string; // YYYY-MM-DD in the location's time zone
  min: number | null;
  max: number | null;
  icon: IconKind;
  label: string;
  rainMm: number;
  uvMax: number | null;
};

export type WeatherPayload = {
  location: { name: string; state: string | null; timeZone: string };
  now: {
    temp: number | null;
    feelsLike: number | null;
    humidity: number | null;
    windKmh: number | null;
    windDir: string | null;
    icon: IconKind;
    label: string;
    isNight: boolean;
  };
  today: DayForecast | null;
  next: DayForecast[];
  tip: { tone: "ok" | "warn" | "danger"; text: string };
  modelUpdatedAt: string | null;
  fetchedAt: string;
  via: "gps" | "search" | "ip";
};
