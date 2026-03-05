"use strict";

const express = require("express");
const { Pool } = require("pg");

const router = express.Router();
if (!process.env.DATABASE_URL) {
  console.error("[weather-cache] Missing DATABASE_URL in env");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Cache-first 10-day forecast
// GET /weather/forecast10?city=Oakland&state=CA
router.get("/forecast10", async (req, res, next) => {
  const city = (req.query.city || "").trim();
  const state = (req.query.state || "CA").trim();
  const zip = (req.query.zip || "").trim();

  try {
    let loc;

    if (zip) {
      const r = await pool.query(
        `SELECT id, label, city, state, zip
         FROM locations
         WHERE zip = $1 AND COALESCE(is_active,true)=true
         ORDER BY id ASC
         LIMIT 1`,
        [zip]
      );
      loc = r.rows[0];
    } else if (city) {
      const r = await pool.query(
        `SELECT id, label, city, state, zip
         FROM locations
         WHERE lower(city)=lower($1) AND state=$2 AND COALESCE(is_active,true)=true
         ORDER BY id ASC
         LIMIT 1`,
        [city, state]
      );
      loc = r.rows[0];
    } else {
      const r = await pool.query(
        `SELECT id, label, city, state, zip
         FROM locations
         WHERE COALESCE(is_active,true)=true
         ORDER BY id ASC
         LIMIT 1`
      );
      loc = r.rows[0];
    }

    if (!loc) return next();

    const snap = await pool.query(
      `SELECT data_json, fetched_at, expires_at
       FROM weather_snapshots
       WHERE location_id=$1
         AND kind='forecast10'
         AND expires_at > NOW()
       ORDER BY fetched_at DESC
       LIMIT 1`,
      [loc.id]
    );

    if (snap.rowCount === 0) return next();

    const payload = snap.rows[0].data_json || {};
    payload.source = "cache";
    payload.cached_at = snap.rows[0].fetched_at;
    payload.cache_expires_at = snap.rows[0].expires_at;
    payload.cache_location = {
      id: loc.id,
      label: loc.label,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
    };

    return res.json(payload);

  } catch (e) {
    console.error("[weather-cache] /locations error:", e);
    return res.status(500).json({ ok: false, error: "locations_fetch_failed", detail: String(e?.message || e) });
  }

});

// Cache-first: return active locations + latest non-expired forecast10 snapshot for each
// GET /weather/locations?limit=10
router.get("/locations", async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);

    const r = await pool.query(
      `
      SELECT
        l.id,
        l.label,
        l.city,
        l.state,
        l.zip,
        l.country,
        l.lat,
        l.lon,
        ws.data_json,
        ws.fetched_at,
        ws.expires_at
      FROM locations l
      LEFT JOIN LATERAL (
        SELECT data_json, fetched_at, expires_at
        FROM weather_snapshots
        WHERE location_id = l.id
          AND kind = 'forecast10'
          AND expires_at > NOW()
        ORDER BY fetched_at DESC
        LIMIT 1
      ) ws ON true
      WHERE COALESCE(l.is_active, true) = true
      ORDER BY l.id ASC
      LIMIT $1
      `,
      [limit]
    );

    return res.json({
      ok: true,
      count: r.rows.length,
      items: r.rows.map((row) => ({
        location: {
          id: row.id,
          label: row.label,
          city: row.city,
          state: row.state,
          zip: row.zip,
          country: row.country,
          lat: row.lat,
          lon: row.lon,
        },
        snapshot: row.data_json
          ? {
              kind: "forecast10",
              fetched_at: row.fetched_at,
              expires_at: row.expires_at,
              data: row.data_json,
            }
          : null,
      })),
      source: "cache",
    });
  } catch (e) {
    console.error("[weather-cache] /locations error:", e.message);
    return next();
  }
});

      // Manual refresh: fetch fresh forecast10 for active locations and store snapshots
// POST /weather/refresh-locations?limit=10
router.post("/refresh-locations", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);

    // Simple cooldown so people can’t spam it (per-node-process)
    global.__FW_REFRESH_LAST__ = global.__FW_REFRESH_LAST__ || 0;
    const nowMs = Date.now();
    if (nowMs - global.__FW_REFRESH_LAST__ < 15000) {
      return res.status(429).json({ ok: false, error: "refresh_cooldown_15s" });
    }
    global.__FW_REFRESH_LAST__ = nowMs;

    const locs = await pool.query(
      `SELECT id, lat, lon
       FROM locations
       WHERE COALESCE(is_active,true)=true
       ORDER BY id ASC
       LIMIT $1`,
      [limit]
    );

    async function fetchForecast10(lat, lon) {
      const url =
        "https://api.open-meteo.com/v1/forecast" +
        `?latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max" +
        "&forecast_days=10" +
        "&temperature_unit=fahrenheit" +
        "&wind_speed_unit=mph" +
        "&timezone=auto";

      const r = await fetch(url);
      if (!r.ok) throw new Error(`open_meteo_http_${r.status}`);
      const j = await r.json();

      const d = j.daily || {};
      const days = (d.time || []).map((date, i) => ({
        date,
        temp_max_f: d.temperature_2m_max?.[i],
        temp_min_f: d.temperature_2m_min?.[i],
        weather_code: d.weather_code?.[i],
        wind_max_mph: d.wind_speed_10m_max?.[i],
        precip_prob_pct: d.precipitation_probability_max?.[i],
      }));

      return { ok: true, days };
    }

    let refreshed = 0;
    let skipped = 0;
    let failed = 0;

    for (const loc of locs.rows) {
      try {
        if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lon)) {
          skipped++;
          continue;
        }

        const payload = await fetchForecast10(loc.lat, loc.lon);

        // TTL: 48 hours (matches your snapshot pattern)
        await pool.query(
          `INSERT INTO weather_snapshots (location_id, kind, data_json, fetched_at, expires_at)
           VALUES ($1, 'forecast10', $2::jsonb, NOW(), NOW() + interval '48 hours')`,
          [loc.id, JSON.stringify(payload)]
        );

        refreshed++;
      } catch (e) {
        failed++;
      }
    }

    return res.json({ ok: true, refreshed, skipped, failed, limit, source: "open-meteo" });
  } catch (e) {
    console.error("[weather-cache] /refresh-locations error:", e);
    return res.status(500).json({ ok: false, error: "refresh_failed" });
  }
});



module.exports = router;
