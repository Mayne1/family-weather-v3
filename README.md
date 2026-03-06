# family-weather-v3

## API Notes

- Frontend API access is centralized in `js/apiBox.js`.
- Public homepage weather adapter route:
  - `GET /api/public-weather?lat=..&lon=..`
  - Alias: `GET /api/weather/public-weather?lat=..&lon=..`
- Response shape:
  - `{ ok, location, current, hourly, daily, headsUp, favorites }`
- Homepage weather boxes (right-now/hourly/7-day/heads-up/favorites) read from this adapter.

## Intel Hint Bridge

- Optional backend env var: `INTEL_ENGINE_BASE_URL`
  - Example: `http://127.0.0.1:5173`
- Hint endpoints used by frontend:
  - Used by backend site-weather adapter to set `background.severeHint`.
- Expected response includes `severeHint` (boolean) and/or `background_variant_hint`.
