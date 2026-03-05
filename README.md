# family-weather-v3

## API Notes

- Frontend API access is centralized in `js/apiBox.js`.
- Expected weather proxy routes:
  - `GET /api/weather/bundle?lat=..&lon=..`
  - `GET /api/weather/hourly?lat=..&lon=..`
  - `GET /api/weather/rightnow?lat=..&lon=..`

## Intel Hint Bridge

- Optional backend env var: `INTEL_ENGINE_BASE_URL`
  - Example: `http://127.0.0.1:5173`
- Hint endpoints used by frontend:
  - `GET /api/intel/hint?lat=..&lon=..&dateIso=YYYY-MM-DD`
  - Fallback: `GET /api/weather/intel/hint?lat=..&lon=..&dateIso=YYYY-MM-DD`
- Expected response includes `severeHint` (boolean) and/or `background_variant_hint`.
