"use strict";

const assert = require("assert");
const nws = require("../js/nws-adapter");

async function run() {
  const lat = Number(process.argv[2] || 37.9577);
  const lon = Number(process.argv[3] || -121.2908);

  const hourly = await nws.getHourly(lat, lon);
  assert(Array.isArray(hourly.hourly), "hourly.hourly must be an array");
  assert(hourly.hourly.length > 0, "hourly endpoint should return at least one period");

  const forecast = await nws.getForecast(lat, lon);
  assert(forecast.daily7 && Array.isArray(forecast.daily7.time), "forecast.daily7.time must exist");
  assert(forecast.daily7.time.length > 0, "forecast should include at least one daily period");
  assert(forecast.daily7.time.length <= 7, "forecast.daily7 should cap at 7 periods");

  const alerts = await nws.getAlerts(lat, lon);
  assert(Array.isArray(alerts.alerts), "alerts.alerts must be an array");
  assert(alerts.headsUp && typeof alerts.headsUp.count === "number", "alerts.headsUp must be present");

  console.log(
    JSON.stringify(
      {
        ok: true,
        location: { lat, lon },
        checks: {
          hourlyPeriods: hourly.hourly.length,
          dailyPeriods: forecast.daily7.time.length,
          alertCount: alerts.alerts.length
        },
        sample: {
          hourly: hourly.hourly[0] || null,
          daily: forecast.days7 && forecast.days7[0] ? forecast.days7[0] : null,
          alert: alerts.alerts[0] || null
        }
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err && err.message ? err.message : String(err) }, null, 2));
  process.exit(1);
});
