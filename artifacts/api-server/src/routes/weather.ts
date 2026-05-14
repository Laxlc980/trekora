import { Router, type IRouter, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// In-memory cache: destination → { data, fetchedAt }
// Entries expire after 30 minutes.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { data: BaseWeatherData; fetchedAt: number }>();

interface BaseWeatherData {
  destination: string;
  temperature: number; // °C
  condition: string;   // e.g. "Clouds", "Rain", "Snow", "Clear"
  windSpeed: number;   // m/s
  humidity: number;    // %
  icon: string;        // OpenWeatherMap icon code
  updatedAt: string;   // ISO timestamp
}

interface EnhancedWeatherResponse extends BaseWeatherData {
  // Nepal-specific intelligence
  monsoonWarning: boolean;
  monsoonMessage: string | null;
  snowAlert: boolean;
  seasonStatus: string;
  trailStatus: "open" | "caution";
}

/** Determine if today is in monsoon season (June 1 – September 15) */
function isMonsoonSeason(): boolean {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  if (month >= 6 && month <= 8) return true;
  if (month === 9 && day <= 15) return true;
  return false;
}

/** Get season status string based on current month */
function getSeasonStatus(): string {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "Spring Peak Season — best time to trek";
  if (month >= 6 && month <= 8) return "Monsoon Season — difficult conditions expected";
  if (month >= 9 && month <= 11) return "Autumn Peak Season — best time to trek";
  return "Winter Season — cold but clear skies";
}

router.get("/weather", async (req: Request, res: Response) => {
  const destination = (req.query.destination as string)?.trim();
  if (!destination) {
    res.status(400).json({ error: "destination query parameter is required" });
    return;
  }

  const altitude = req.query.altitude ? parseInt(String(req.query.altitude), 10) : null;

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Weather service not configured" });
    return;
  }

  // Check cache for base weather data
  const cacheKey = destination.toLowerCase();
  let baseData: BaseWeatherData;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    baseData = cached.data;
  } else {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(destination)}&units=metric&appid=${apiKey}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          res.status(404).json({ error: "Destination not found in weather service" });
          return;
        }
        logger.warn({ status: response.status, destination }, "OpenWeatherMap API error");
        res.status(502).json({ error: "Weather service unavailable" });
        return;
      }

      const raw = await response.json() as {
        main: { temp: number; humidity: number };
        weather: Array<{ main: string; icon: string }>;
        wind: { speed: number };
      };

      baseData = {
        destination,
        temperature: Math.round(raw.main.temp),
        condition: raw.weather[0]?.main ?? "Unknown",
        windSpeed: raw.wind.speed,
        humidity: raw.main.humidity,
        icon: raw.weather[0]?.icon ?? "01d",
        updatedAt: new Date().toISOString(),
      };

      cache.set(cacheKey, { data: baseData, fetchedAt: Date.now() });
    } catch (err) {
      logger.error({ err, destination }, "Failed to fetch weather");
      res.status(502).json({ error: "Weather service unavailable" });
      return;
    }
  }

  // Compute Nepal-specific intelligence
  const monsoonWarning = isMonsoonSeason();
  const monsoonMessage = monsoonWarning
    ? "Active monsoon season — expect heavy rainfall and possible trail disruptions"
    : null;

  // Snow alert: altitude > 4000m AND temperature < 2°C
  const snowAlert = altitude != null && altitude > 4000 && baseData.temperature < 2;

  const seasonStatus = getSeasonStatus();
  const trailStatus: "open" | "caution" = monsoonWarning || snowAlert ? "caution" : "open";

  const enhanced: EnhancedWeatherResponse = {
    ...baseData,
    monsoonWarning,
    monsoonMessage,
    snowAlert,
    seasonStatus,
    trailStatus,
  };

  res.json(enhanced);
});

export default router;
