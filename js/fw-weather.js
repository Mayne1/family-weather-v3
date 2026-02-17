(function () {
    const CACHE_KEY = "fw_weather_cache";
    const LOC_KEY = "fw_weather_loc";
    const FAVORITES_KEY = "fw_favorites_v1";
    const FAVORITES_CACHE_KEY = "fw_fav_cache_v1";
    const CACHE_TTL_MS = 3 * 60 * 1000;
    const FAVORITES_CACHE_TTL_MS = 10 * 60 * 1000;
    const FALLBACK_LOC = { lat: 37.9577, lon: -121.2908, label: "Stockton, CA" };
    const ICON_FALLBACK = "images/fw-icons/cloudy.svg";

    const CANONICAL = {
        CLEAR: "CLEAR",
        PARTLY: "PARTLY",
        CLOUDY: "CLOUDY",
        FOG: "FOG",
        DRIZZLE: "DRIZZLE",
        RAIN: "RAIN",
        HEAVY_RAIN: "HEAVY_RAIN",
        THUNDER: "THUNDER",
        SNOW: "SNOW"
    };

    const MGC_MAP = {
        CLEAR: "01_sun_fill.svg",
        PARTLY: "04_sun_cloudy_fill.svg",
        CLOUDY: "06_clouds_fill.svg",
        FOG: "15_fog_fill.svg",
        DRIZZLE: "09_drizzle_fill.svg",
        RAIN: "10_showers_fill.svg",
        HEAVY_RAIN: "11_heavy_rain_fill.svg",
        THUNDER: "14_thunderstorm_fill.svg",
        SNOW: "18_moderate_snow_fill.svg"
    };

    const MASTER_MAP = {
        CLEAR: "clear-day.svg",
        PARTLY: "partly-cloudy-day.svg",
        CLOUDY: "cloudy.svg",
        FOG: "fog.svg",
        DRIZZLE: "drizzle.svg",
        RAIN: "rain.svg",
        HEAVY_RAIN: "rain.svg",
        THUNDER: "thunderstorms.svg",
        SNOW: "snow.svg"
    };

    const LABELS = {
        CLEAR: "Clear",
        PARTLY: "Partly Cloudy",
        CLOUDY: "Cloudy",
        FOG: "Fog",
        DRIZZLE: "Drizzle",
        RAIN: "Rain",
        HEAVY_RAIN: "Heavy Rain",
        THUNDER: "Thunder",
        SNOW: "Snow"
    };

    const MGC_AVAILABLE = new Set([
        "01_sun_fill.svg",
        "04_sun_cloudy_fill.svg",
        "06_clouds_fill.svg",
        "15_fog_fill.svg",
        "09_drizzle_fill.svg",
        "10_showers_fill.svg",
        "11_heavy_rain_fill.svg",
        "14_thunderstorm_fill.svg",
        "18_moderate_snow_fill.svg"
    ]);

    const MASTER_AVAILABLE = new Set([
        "clear-day.svg",
        "partly-cloudy-day.svg",
        "cloudy.svg",
        "fog.svg",
        "drizzle.svg",
        "rain.svg",
        "thunderstorms.svg",
        "snow.svg"
    ]);

    let iconWarned = false;

    window.FW_ICON_ERR = function (img) {
        if (!img) return;
        const fallback = img.getAttribute("data-fallback");
        if (fallback && img.src !== fallback) {
            img.src = fallback;
            img.setAttribute("data-fallback", ICON_FALLBACK);
            return;
        }
        img.src = ICON_FALLBACK;
    };

    function safeParse(raw, fallback) {
        try {
            const parsed = JSON.parse(raw);
            return parsed || fallback;
        } catch (err) {
            return fallback;
        }
    }

    function loadLocation() {
        const raw = localStorage.getItem(LOC_KEY);
        if (raw) {
            const parsed = safeParse(raw, null);
            if (parsed && typeof parsed.lat === "number" && typeof parsed.lon === "number") {
                return parsed;
            }
        }
        return null;
    }

    function saveCache(payload) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }

    function loadCache() {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = safeParse(raw, null);
        if (!parsed || !parsed.timestamp || !parsed.weather) return null;
        if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
        return parsed;
    }

    function canonicalFromCode(code) {
        if (code === 0) return CANONICAL.CLEAR;
        if (code === 1 || code === 2) return CANONICAL.PARTLY;
        if (code === 3) return CANONICAL.CLOUDY;
        if (code >= 45 && code <= 48) return CANONICAL.FOG;
        if (code >= 51 && code <= 57) return CANONICAL.DRIZZLE;
        if (code >= 61 && code <= 67) return CANONICAL.RAIN;
        if (code >= 71 && code <= 77) return CANONICAL.SNOW;
        if (code >= 80 && code <= 82) return CANONICAL.HEAVY_RAIN;
        if (code >= 85 && code <= 86) return CANONICAL.SNOW;
        if (code >= 95) return CANONICAL.THUNDER;
        return CANONICAL.CLOUDY;
    }

    function normalizeNumber(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function getCurrentDisplayCode(current, weather) {
        const baseCode = Number(current && current.weather_code);
        const precipitation = normalizeNumber(current && current.precipitation);
        const rain = normalizeNumber(current && current.rain) + normalizeNumber(current && current.showers);
        const snowfall = normalizeNumber(current && current.snowfall);

        if (snowfall >= 0.01) return 71;
        if (rain >= 0.01 || precipitation >= 0.05) {
            if (baseCode >= 95) return baseCode;
            return 61;
        }

        // Fallback: if current snapshot lags, infer from nearby hourly nowcast.
        if (weather && weather.hourly && Array.isArray(weather.hourly.time)) {
            const times = weather.hourly.time;
            const probs = Array.isArray(weather.hourly.precipitation_probability) ? weather.hourly.precipitation_probability : [];
            const hourlyCodes = Array.isArray(weather.hourly.weather_code) ? weather.hourly.weather_code : [];
            const currentTime = String(current && current.time || "");
            let idx = times.indexOf(currentTime);
            if (idx < 0 && currentTime) {
                const nowMs = Date.parse(currentTime);
                if (Number.isFinite(nowMs)) {
                    let bestDelta = Number.POSITIVE_INFINITY;
                    for (let i = 0; i < times.length; i += 1) {
                        const t = Date.parse(times[i]);
                        if (!Number.isFinite(t)) continue;
                        const delta = Math.abs(t - nowMs);
                        if (delta < bestDelta) {
                            bestDelta = delta;
                            idx = i;
                        }
                    }
                }
            }
            if (idx >= 0) {
                const prevCode = Number(hourlyCodes[idx - 1]);
                const nowCode = Number(hourlyCodes[idx]);
                const nextCode = Number(hourlyCodes[idx + 1]);
                const nowProb = normalizeNumber(probs[idx]);
                const nextProb = normalizeNumber(probs[idx + 1]);

                const hasNearbyRainCode =
                    (prevCode >= 51 && prevCode <= 82) ||
                    (nowCode >= 51 && nowCode <= 82) ||
                    (nextCode >= 51 && nextCode <= 82);

                if (hasNearbyRainCode && (nowProb >= 45 || nextProb >= 55)) return 61;
                if ((nowProb >= 70 || nextProb >= 75) && (baseCode === 1 || baseCode === 2 || baseCode === 3)) return 61;
            }
        }
        return Number.isFinite(baseCode) ? baseCode : 3;
    }

    function resolveWxIconPath(weatherCode, isNight = false) {
        const type = canonicalFromCode(weatherCode);
        const mgc = MGC_MAP[type];
        if (mgc && MGC_AVAILABLE.has(mgc)) return `images/mgc-weather-icons-pack-v12/${mgc}`;
        const master = MASTER_MAP[type];
        if (master && MASTER_AVAILABLE.has(master)) return `images/weather-icons-master/${master}`;
        if (!iconWarned) {
            console.warn("fw-weather: icon mapping missing, using cloudy.svg");
            iconWarned = true;
        }
        return ICON_FALLBACK;
    }

    function resolveWxIconFallback(weatherCode) {
        const type = canonicalFromCode(weatherCode);
        const master = MASTER_MAP[type];
        if (master && MASTER_AVAILABLE.has(master)) return `images/weather-icons-master/${master}`;
        return ICON_FALLBACK;
    }

    function labelFromCode(code) {
        const type = canonicalFromCode(code);
        return LABELS[type] || "Cloudy";
    }

    function formatTime(date) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    function formatDay(date) {
        return date.toLocaleDateString([], { weekday: "short" });
    }

    function parseYmdLocal(ymd) {
        const parts = String(ymd || "").split("-");
        if (parts.length !== 3) return new Date(ymd);
        const year = Number(parts[0]);
        const month = Number(parts[1]) - 1;
        const day = Number(parts[2]);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return new Date(ymd);
        return new Date(year, month, day);
    }

    function toCardinal(deg) {
        if (typeof deg !== "number") return "-";
        const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        return dirs[Math.round(deg / 45) % 8];
    }

    function iconImg(code, sizeClass) {
        const src = resolveWxIconPath(code);
        const fallback = resolveWxIconFallback(code);
        const klass = sizeClass || "w-40px";
        return `<img src="${src}" data-fallback="${fallback}" class="${klass}" alt="" onerror="window.FW_ICON_ERR(this)">`;
    }

    function getPrecipChance(weather) {
        if (!weather.hourly || !weather.hourly.time || !weather.current || !weather.current.time) return null;
        const idx = weather.hourly.time.indexOf(weather.current.time);
        if (idx === -1) return null;
        if (!weather.hourly.precipitation_probability) return null;
        return weather.hourly.precipitation_probability[idx];
    }

    function riskBadge(code, wind, hi) {
        const type = canonicalFromCode(code);
        const heavyRain = code === 65 || code === 67 || code === 81 || code === 82;
        if (type === CANONICAL.THUNDER || heavyRain) return "Storm Risk";
        if (type === CANONICAL.RAIN || type === CANONICAL.DRIZZLE) return "Rain Risk";
        if (typeof wind === "number" && wind > 20) return "Windy";
        if (typeof hi === "number" && hi > 95) return "Heat";
        return "";
    }

    function setWeatherBackground(condition) {
        const bg = document.getElementById("fw-bg");
        if (!bg || !condition) return;

        const c = String(condition).toLowerCase();
        if (c.includes("snow")) {
            bg.style.backgroundImage = "url('/images/background/bg_snow.webp')";
        } else if (c.includes("storm") || c.includes("thunder")) {
            bg.style.backgroundImage = "url('/images/background/bg_storm.webp')";
        } else if (c.includes("rain") || c.includes("drizzle")) {
            bg.style.backgroundImage = "url('/images/background/bg_rain.webp')";
        } else {
            bg.style.backgroundImage = "none";
        }
    }

    function renderRightNow(target, payload) {
        if (!target) return;
        const current = payload.weather.current;
        const temp = Math.round(current.temperature_2m);
        const feels = Math.round(current.apparent_temperature);
        const humidity = Math.round(current.relative_humidity_2m);
        const wind = Math.round(current.wind_speed_10m);
        const windDir = toCardinal(current.wind_direction_10m);
        const precipChance = getPrecipChance(payload.weather);
        const displayCode = getCurrentDisplayCode(current, payload.weather);
        const label = labelFromCode(displayCode);
        const updated = formatTime(new Date(current.time || payload.timestamp));
        const aqi = payload.aqi != null ? payload.aqi : "-";
        setWeatherBackground(label);

        target.innerHTML = `
            <div class="rn-layout">
                <div class="rn-content">
                    <div class="subtitle fw-widget-kicker">Right Now</div>
                    <div class="fw-rn-location">${payload.location.label || ""}</div>
                    <div class="small text-muted">Updated: ${updated}</div>

                    <div class="d-flex align-items-center gap-3 my-3 fw-rightnow-main">
                        <div class="fw-rightnow-icon">${iconImg(displayCode, "w-50px")}</div>
                        <div>
                            <div class="fs-60 lh-1 fw-temp">${temp}&deg;F</div>
                            <div class="small">${label}</div>
                            <div class="small fw-rightnow-subtitle">Feels calm outside</div>
                        </div>
                    </div>

                    <div class="small">Feels Like: ${feels}&deg;F</div>
                    <div class="small">Humidity: ${humidity}%</div>
                    <div class="small">Wind: ${wind} mph ${windDir}</div>
                    <div class="small">Chance of rain: ${precipChance != null ? `${Math.round(precipChance)}%` : "-"}</div>
                    <div class="small">AQI: ${aqi}</div>
                </div>

                <div class="rn-scene-wrap">
                    <div class="rn-scene" aria-hidden="true">
                        <div class="rn-layer rn-sky"></div>
                        <div class="rn-layer rn-clouds">
                            <img class="rn-asset rn-asset-cloud" src="images/mgc-weather-icons-pack-v12/06_clouds_fill.svg" alt="">
                        </div>
                        <div class="rn-layer rn-rain"><span></span><span></span><span></span><span></span><span></span></div>
                        <div class="rn-layer rn-snow"><span></span><span></span><span></span><span></span></div>
                        <div class="rn-layer rn-fog"></div>
                        <div class="rn-layer rn-clear">
                            <img class="rn-asset rn-asset-sun" src="images/mgc-weather-icons-pack-v12/01_sun_fill.svg" alt="">
                        </div>
                        <div class="rn-layer rn-thunder"></div>
                        <div class="rn-layer rn-wind"><span></span><span></span><span></span></div>

                        <svg class="rn-diorama" viewBox="0 0 420 300" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Weather diorama scene">
                            <path d="M0 245 Q85 218 190 236 T420 232 L420 300 L0 300 Z" fill="rgba(124,210,156,0.25)"></path>
                            <path d="M130 195 L210 130 L292 195" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"></path>
                            <rect x="150" y="194" width="120" height="82" rx="7" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.95)" stroke-width="6"></rect>
                            <rect x="202" y="228" width="20" height="48" rx="3" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.8)" stroke-width="3"></rect>
                            <rect x="168" y="214" width="20" height="20" rx="3" fill="rgba(255,255,255,0.25)"></rect>
                            <rect x="232" y="214" width="20" height="20" rx="3" fill="rgba(255,255,255,0.25)"></rect>
                            <ellipse cx="118" cy="260" rx="9" ry="20" fill="rgba(255,255,255,0.55)"></ellipse>
                            <ellipse cx="102" cy="264" rx="7" ry="14" fill="rgba(255,255,255,0.45)"></ellipse>
                            <ellipse cx="322" cy="264" rx="8" ry="16" fill="rgba(255,255,255,0.55)"></ellipse>
                            <ellipse cx="336" cy="266" rx="7" ry="13" fill="rgba(255,255,255,0.45)"></ellipse>
                            <ellipse cx="344" cy="260" rx="6" ry="12" fill="rgba(255,255,255,0.35)"></ellipse>
                        </svg>
                    </div>
                </div>
            </div>

            <div class="rn-hourly-block mt-3">
                <div class="subtitle">Hourly Forecast</div>
                <div id="fw-hourly-row" class="hourly-row" aria-live="polite"></div>
            </div>
        `;
    }

    function renderForecast(target, payload) {
        if (!target) return;
        const daily = payload.weather.daily;
        const count = Math.min(10, daily.time.length);
        const tiles = Array.from({ length: count }).map((_, idx) => {
            const day = formatDay(parseYmdLocal(daily.time[idx]));
            const hi = Math.round(daily.temperature_2m_max[idx]);
            const lo = Math.round(daily.temperature_2m_min[idx]);
            const code = daily.weather_code[idx];
            const wind = daily.wind_speed_10m_max ? daily.wind_speed_10m_max[idx] : null;
            const badge = riskBadge(code, wind, hi);
            return `
                <div class="text-center bg-dark-2 rounded-1 p-20 fw-forecast-tile" style="min-width:110px;">
                    <div class="small">${day}</div>
                    <div class="my-2 fw-forecast-icon">${iconImg(code, "w-40px")}</div>
                    <div class="small">${hi}&deg;F / ${lo}&deg;F</div>
                    ${badge ? `<div class=\"small text-muted mt-1\">${badge}</div>` : ""}
                </div>
            `;
        }).join("");

        target.innerHTML = `
            <div class="subtitle">10-Day</div>
            <div class="d-flex gap-3 overflow-auto">${tiles}</div>
            <div class="fw-favorites-wrap mt-4">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <div class="subtitle mb-0">Favorites (Top 5)</div>
                    <a href="settings.html#favorites" class="small">Manage</a>
                </div>
                <div id="fw-favorites-strip" class="fw-favorites-strip">
                    <div class="small text-muted">No favorites saved. Use Manage to add up to 5.</div>
                </div>
            </div>
        `;
    }

    function loadFavorites() {
        try {
            const raw = localStorage.getItem(FAVORITES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((row) => {
                    const lat = Number(row && row.lat);
                    const lon = Number(row && row.lon);
                    return {
                        id: String((row && row.id) || ""),
                        label: String((row && row.label) || (row && row.query) || "").trim(),
                        query: String((row && row.query) || "").trim(),
                        lat: Number.isFinite(lat) ? lat : null,
                        lon: Number.isFinite(lon) ? lon : null,
                        updatedAt: Number(row && row.updatedAt) || 0
                    };
                })
                .filter((row) => row.label && Number.isFinite(row.lat) && Number.isFinite(row.lon))
                .slice(0, 5);
        } catch (_err) {
            return [];
        }
    }

    function loadFavoritesCache() {
        try {
            const raw = localStorage.getItem(FAVORITES_CACHE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (_err) {
            return {};
        }
    }

    function saveFavoritesCache(cache) {
        localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(cache || {}));
    }

    async function fetchFavoriteCurrent(favorite) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${favorite.lat}&longitude=${favorite.lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("favorite_weather_failed");
        const json = await res.json();
        if (!json || !json.current) throw new Error("favorite_weather_missing");
        return {
            temp: Math.round(json.current.temperature_2m),
            code: json.current.weather_code,
            ts: Date.now()
        };
    }

    async function mapLimit(items, limit, iterator) {
        const results = new Array(items.length);
        let index = 0;
        async function worker() {
            while (index < items.length) {
                const current = index;
                index += 1;
                results[current] = await iterator(items[current], current);
            }
        }
        const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }).map(() => worker());
        await Promise.all(workers);
        return results;
    }

    function isRecentFavorite(favorite, activeLocation) {
        if (favorite && favorite.updatedAt && Date.now() - favorite.updatedAt < 24 * 60 * 60 * 1000) return true;
        if (!activeLocation || !Number.isFinite(activeLocation.lat) || !Number.isFinite(activeLocation.lon)) return false;
        const latDiff = Math.abs(favorite.lat - activeLocation.lat);
        const lonDiff = Math.abs(favorite.lon - activeLocation.lon);
        return latDiff < 0.05 && lonDiff < 0.05;
    }

    async function renderFavoritesStrip(activeLocation) {
        const host = document.getElementById("fw-favorites-strip");
        if (!host) return;
        const favorites = loadFavorites();
        if (!favorites.length) {
            host.innerHTML = '<div class="small text-muted">No favorites saved. Use Manage to add up to 5.</div>';
            return;
        }

        const cache = loadFavoritesCache();
        const now = Date.now();
        const weatherRows = await mapLimit(favorites, 2, async (favorite) => {
            const key = favorite.id || `${favorite.lat},${favorite.lon}`;
            const cached = cache[key];
            if (cached && cached.ts && now - cached.ts < FAVORITES_CACHE_TTL_MS) {
                return { ...favorite, weather: cached };
            }
            try {
                const weather = await fetchFavoriteCurrent(favorite);
                cache[key] = weather;
                return { ...favorite, weather };
            } catch (_err) {
                return { ...favorite, weather: null };
            }
        });
        saveFavoritesCache(cache);

        host.innerHTML = weatherRows.map((row) => {
            const code = row.weather && row.weather.code != null ? row.weather.code : 3;
            const temp = row.weather && row.weather.temp != null ? `${row.weather.temp}&deg;F` : "--";
            const recent = isRecentFavorite(row, activeLocation);
            return `
                <button type="button" class="fw-fav-pill" data-fav-id="${row.id}" aria-label="Switch to ${row.label}">
                    <span class="fw-fav-label">${row.label}</span>
                    <span class="fw-fav-icon">${iconImg(code, "w-24px")}</span>
                    <span class="fw-fav-temp">${temp}</span>
                    ${recent ? '<span class="fw-fav-recent">RECENT</span>' : ""}
                </button>
            `;
        }).join("");

        host.querySelectorAll(".fw-fav-pill").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const favId = btn.getAttribute("data-fav-id");
                const match = favorites.find((row) => row.id === favId);
                if (!match) return;
                const nextLoc = { lat: match.lat, lon: match.lon, label: match.label };
                localStorage.setItem(LOC_KEY, JSON.stringify(nextLoc));
                localStorage.removeItem(CACHE_KEY);
                try {
                    const [weather, aqi] = await Promise.all([
                        fetchWeather(nextLoc),
                        fetchAqi(nextLoc).catch(() => null)
                    ]);
                    const payload = { timestamp: Date.now(), location: nextLoc, weather, aqi };
                    saveCache(payload);
                    renderAll(payload);
                    renderFavoritesStrip(nextLoc).catch(() => {});
                } catch (_err) {
                    location.reload();
                }
            });
        });
    }

    function renderHeadsUp(payload) {
        const list = document.getElementById("headsUpList");
        if (!list) return;
        const daily = payload.weather.daily;
        const items = [];
        let hasSevere = false;
        for (let idx = 0; idx < Math.min(5, daily.time.length); idx += 1) {
            const day = formatDay(parseYmdLocal(daily.time[idx]));
            const code = daily.weather_code[idx];
            const hi = daily.temperature_2m_max[idx];
            const wind = daily.wind_speed_10m_max ? daily.wind_speed_10m_max[idx] : null;
            const badge = riskBadge(code, wind, hi);
            if (!badge) continue;
            if (badge === "Storm Risk") hasSevere = true;
            items.push({ day, badge });
            if (items.length >= 4) break;
        }
        if (!items.length) {
            list.innerHTML = "<div class=\"small text-muted\">No heads-up right now.</div>";
            list.classList.remove("fw-has-severe");
            return;
        }
        list.classList.toggle("fw-has-severe", hasSevere);
        list.innerHTML = items.map((item) => `<div class="small fw-headsup-item"><i class="fa fa-exclamation-circle me-2" aria-hidden="true"></i>${item.day} - ${item.badge}</div>`).join("");
    }

    async function geocodeZip(zip) {
        const z = String(zip || "").replace(/[^0-9]/g, "").slice(0, 10);
        if (!z) return null;
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(z)}&count=1&language=en&format=json`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        const first = json && json.results && json.results[0];
        if (!first) return null;
        return { lat: first.latitude, lon: first.longitude, label: first.name || `ZIP ${z}` };
    }

    async function fetchArchiveDay(lat, lon, ymd) {
        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${ymd}&end_date=${ymd}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        if (!json.daily || !json.daily.time || !json.daily.time.length) return null;
        return {
            date: json.daily.time[0],
            hi: json.daily.temperature_2m_max ? json.daily.temperature_2m_max[0] : null,
            lo: json.daily.temperature_2m_min ? json.daily.temperature_2m_min[0] : null,
            precip: json.daily.precipitation_sum ? json.daily.precipitation_sum[0] : null,
            code: json.daily.weather_code ? json.daily.weather_code[0] : null
        };
    }

    async function initAlmanac(payload) {
        const dateEl = document.getElementById("almanacDate");
        const zipEl = document.getElementById("almanacZip");
        const btn = document.getElementById("btnAlmanacGo");
        const out = document.getElementById("almanacMiniOut");
        if (!dateEl || !btn || !out) return;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        if (!dateEl.value) dateEl.value = `${yyyy}-${mm}-${dd}`;

        const run = async () => {
            const targetDate = new Date(dateEl.value + "T00:00:00");
            if (Number.isNaN(targetDate.getTime())) {
                out.textContent = "Choose a valid date first.";
                return;
            }

            const month = String(targetDate.getMonth() + 1).padStart(2, "0");
            const day = String(targetDate.getDate()).padStart(2, "0");
            const years = [yyyy - 1, yyyy - 2, yyyy - 3, yyyy - 4, yyyy - 5];

            let loc = payload.location;
            if (zipEl && zipEl.value) {
                const geo = await geocodeZip(zipEl.value);
                if (geo) loc = geo;
            }

            out.textContent = "Loading almanac...";

            const results = await Promise.all(
                years.map((y) => fetchArchiveDay(loc.lat, loc.lon, `${y}-${month}-${day}`))
            );

            const rows = results.filter(Boolean);
            if (!rows.length) {
                out.textContent = "Almanac not available.";
                return;
            }

            let avgHi = 0;
            let avgLo = 0;
            let count = 0;
            let rainYears = 0;

            const lines = rows.map((row) => {
                const hi = row.hi != null ? Math.round(row.hi) : null;
                const lo = row.lo != null ? Math.round(row.lo) : null;
                if (hi != null && lo != null) {
                    avgHi += hi;
                    avgLo += lo;
                    count += 1;
                }
                const rain = row.precip != null && row.precip > 0 ? "Rain" : "No rain";
                if (rain === "Rain") rainYears += 1;
                const label = row.code != null ? labelFromCode(row.code) : "";
                return `${row.date} - High ${hi != null ? hi + "&deg;F" : "-"} / Low ${lo != null ? lo + "&deg;F" : "-"} - ${rain}${label ? " - " + label : ""}`;
            });

            const avgLine = count ? `Avg High / Low: ${Math.round(avgHi / count)}&deg;F / ${Math.round(avgLo / count)}&deg;F` : "Avg High / Low: -";
            const rainLine = `Rain frequency: ${rainYears}/${rows.length} years`;

            out.textContent = `Almanac for ${month}-${day}\n${lines.join("\n")}\n${avgLine}\n${rainLine}`;
        };

        btn.addEventListener("click", () => {
            run().catch(() => {
                out.textContent = "Almanac lookup failed.";
            });
        });
    }

    function renderAll(payload) {
        window.__FW_WEATHER_PAYLOAD = payload;
        try {
            window.dispatchEvent(new CustomEvent("fw:weather", { detail: { payload } }));
        } catch (_err) {}
        const rightNow = document.getElementById("fw-rightnow");
        const forecast = document.getElementById("fw-forecast");
        renderRightNow(rightNow, payload);
        renderForecast(forecast, payload);
        renderFavoritesStrip(payload.location).catch(() => {});
        renderHeadsUp(payload);
        initAlmanac(payload);
    }

    async function fetchWeather(location) {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,rain,showers,snowfall&hourly=precipitation_probability,weather_code,precipitation,rain,showers,snowfall&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&forecast_days=10&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather fetch failed");
        return res.json();
    }

    async function fetchAqi(location) {
        const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=us_aqi&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("aqi fetch failed");
        const json = await res.json();
        return json.current && typeof json.current.us_aqi === "number" ? json.current.us_aqi : null;
    }

    function getLocation() {
        const stored = loadLocation();
        if (stored) return Promise.resolve(stored);

        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(FALLBACK_LOC);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lon: pos.coords.longitude,
                        label: "Current Location"
                    });
                },
                () => resolve(FALLBACK_LOC),
                { timeout: 6000 }
            );
        });
    }

    async function init() {
        const cached = loadCache();
        if (cached) {
            renderAll(cached);
            return;
        }
        try {
            const location = await getLocation();
            const [weather, aqi] = await Promise.all([
                fetchWeather(location),
                fetchAqi(location).catch(() => null)
            ]);
            const payload = {
                timestamp: Date.now(),
                location,
                weather,
                aqi
            };
            saveCache(payload);
            renderAll(payload);
        } catch (err) {
            const fallbackDays = Array.from({ length: 10 }).map((_, idx) => {
                const d = new Date();
                d.setDate(d.getDate() + idx);
                return d.toISOString().slice(0, 10);
            });
            const payload = {
                timestamp: Date.now(),
                location: FALLBACK_LOC,
                weather: {
                    current: {
                        temperature_2m: 72,
                        apparent_temperature: 72,
                        relative_humidity_2m: 40,
                        weather_code: 3,
                        wind_speed_10m: 5,
                        wind_direction_10m: 180,
                        precipitation: 0,
                        rain: 0,
                        showers: 0,
                        snowfall: 0,
                        time: new Date().toISOString()
                    },
                    hourly: {
                        time: fallbackDays,
                        precipitation_probability: fallbackDays.map(() => 10),
                        weather_code: fallbackDays.map(() => 3),
                        precipitation: fallbackDays.map(() => 0),
                        rain: fallbackDays.map(() => 0),
                        showers: fallbackDays.map(() => 0),
                        snowfall: fallbackDays.map(() => 0)
                    },
                    daily: {
                        time: fallbackDays,
                        weather_code: fallbackDays.map(() => 3),
                        temperature_2m_max: fallbackDays.map(() => 75),
                        temperature_2m_min: fallbackDays.map(() => 60),
                        precipitation_probability_max: fallbackDays.map(() => 10),
                        wind_speed_10m_max: fallbackDays.map(() => 8)
                    }
                },
                aqi: null
            };
            renderAll(payload);
        }
    }

    if (document.getElementById("fw-rightnow") && document.getElementById("fw-forecast")) {
        window.addEventListener("storage", (evt) => {
            if (!evt || evt.key !== FAVORITES_KEY) return;
            const cached = loadCache();
            const active = cached && cached.location ? cached.location : null;
            renderFavoritesStrip(active).catch(() => {});
        });
        window.addEventListener("fw:favorites", () => {
            const cached = loadCache();
            const active = cached && cached.location ? cached.location : null;
            renderFavoritesStrip(active).catch(() => {});
        });
        init();
    }
})();




