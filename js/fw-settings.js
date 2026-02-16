(function () {
    const SETTINGS_KEY = "fw_settings";
    const FAVORITES_KEY = "fw_favorites_v1";
    const FAVORITES_MAX = 5;
    const defaults = {
        theme: "dark",
        scheme: "scheme-01",
        background: "default",
        font: "system",
        backgroundColor: "",
        uiColor: "#9fd0ff",
        fontColor: "#e8f3ff",
        heroBoxColor: "#1b2942"
    };

    function normalizeHexColor(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        const normalized = raw.startsWith("#") ? raw : `#${raw}`;
        return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : "";
    }

    function hexToRgbString(hex) {
        const clean = normalizeHexColor(hex);
        if (!clean) return "";
        const value = clean.replace("#", "");
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        return `${r}, ${g}, ${b}`;
    }

    function safeParse(raw) {
        try {
            const data = JSON.parse(raw);
            if (!data || typeof data !== "object") return { ...defaults };
            return {
                theme: data.theme || defaults.theme,
                scheme: data.scheme || defaults.scheme,
                background: data.background || defaults.background,
                font: data.font || defaults.font,
                backgroundColor: normalizeHexColor(data.backgroundColor),
                uiColor: normalizeHexColor(data.uiColor) || defaults.uiColor,
                fontColor: normalizeHexColor(data.fontColor) || defaults.fontColor,
                heroBoxColor: normalizeHexColor(data.heroBoxColor) || defaults.heroBoxColor
            };
        } catch (err) {
            return { ...defaults };
        }
    }

    function loadSettings() {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (!raw) return { ...defaults };
        return safeParse(raw);
    }

    function saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    function getOwnerEmail() {
        try {
            const raw = localStorage.getItem("fw_auth_user");
            const user = raw ? JSON.parse(raw) : null;
            return user && user.email ? String(user.email).trim().toLowerCase() : "";
        } catch (_err) {
            return "";
        }
    }

    async function syncSettingsFromServer() {
        const ownerEmail = getOwnerEmail();
        if (!ownerEmail || !window.apiBox || typeof window.apiBox.getSettings !== "function") return null;
        try {
            const remote = await window.apiBox.getSettings(ownerEmail);
            if (remote && typeof remote === "object") {
                const merged = {
                    ...defaults,
                    ...safeParse(JSON.stringify(remote))
                };
                saveSettings(merged);
                return merged;
            }
        } catch (_err) {
            // keep local fallback
        }
        return null;
    }

    async function persistSettingsToServer(settings) {
        const ownerEmail = getOwnerEmail();
        if (!ownerEmail || !window.apiBox || typeof window.apiBox.saveSettings !== "function") return;
        try {
            await window.apiBox.saveSettings(ownerEmail, settings);
        } catch (_err) {
            // keep local fallback
        }
    }

    function applySettings(settings) {
        const body = document.body;
        const root = document.documentElement;
        if (!body) return;

        body.classList.remove("dark-scheme", "light-scheme");
        body.classList.add(settings.theme === "light" ? "light-scheme" : "dark-scheme");

        body.classList.remove("fw-bg-default", "fw-bg-gradient", "fw-bg-pattern");
        body.classList.add(`fw-bg-${settings.background}`);

        body.classList.remove("fw-font-system", "fw-font-serif", "fw-font-mono");
        body.classList.add(`fw-font-${settings.font}`);
        const uiColor = normalizeHexColor(settings.uiColor) || defaults.uiColor;
        root.style.setProperty("--fw-ui-accent", uiColor);
        const fontColor = normalizeHexColor(settings.fontColor) || defaults.fontColor;
        root.style.setProperty("--fw-font-color", fontColor);
        const heroBoxColor = normalizeHexColor(settings.heroBoxColor) || defaults.heroBoxColor;
        root.style.setProperty("--fw-hero-box-color", heroBoxColor);
        root.style.setProperty("--fw-card-bg", heroBoxColor);

        const wrapper = document.getElementById("wrapper");
        const bgVideo = document.getElementById("fw-bg-video");
        const customColor = normalizeHexColor(settings.backgroundColor);
        if (customColor) {
            const rgb = hexToRgbString(customColor);
            if (root) {
                root.style.setProperty("--bg-dark-1", customColor);
                root.style.setProperty("--bg-dark-2", customColor);
                root.style.setProperty("--bg-dark-3", customColor);
                if (rgb) {
                    root.style.setProperty("--bg-dark-1-rgb", rgb);
                }
            }
            body.style.backgroundColor = customColor;
            if (wrapper) {
                wrapper.style.backgroundImage = "none";
                wrapper.style.backgroundColor = customColor;
            }
            if (bgVideo) {
                bgVideo.style.display = "none";
            }
        } else {
            if (root) {
                root.style.removeProperty("--bg-dark-1");
                root.style.removeProperty("--bg-dark-2");
                root.style.removeProperty("--bg-dark-3");
                root.style.removeProperty("--bg-dark-1-rgb");
            }
            body.style.removeProperty("background-color");
            if (wrapper) {
                wrapper.style.removeProperty("background-color");
                wrapper.style.removeProperty("background-image");
            }
            if (bgVideo) {
                bgVideo.style.removeProperty("display");
            }
        }

        const colorsLink = document.getElementById("colors");
        if (colorsLink) {
            const scheme = settings.scheme || defaults.scheme;
            const href = `css/colors/${scheme}.css`;
            colorsLink.setAttribute("href", href);
        }
    }

    function initControls(settings) {
        const form = document.getElementById("fw-settings-form");
        if (!form) return;

        const themeLight = document.getElementById("fw-theme-light");
        const themeDark = document.getElementById("fw-theme-dark");
        const schemeSelect = document.getElementById("fw-scheme");
        const bgSelect = document.getElementById("fw-background");
        const fontSelect = document.getElementById("fw-font");
        const bgColorInput = document.getElementById("fw-bg-color");
        const bgColorHexInput = document.getElementById("fw-bg-color-hex");
        const uiColorInput = document.getElementById("fw-ui-color");
        const uiColorHexInput = document.getElementById("fw-ui-color-hex");
        const fontColorInput = document.getElementById("fw-font-color");
        const fontColorHexInput = document.getElementById("fw-font-color-hex");
        const heroBoxColorInput = document.getElementById("fw-hero-box-color");
        const heroBoxColorHexInput = document.getElementById("fw-hero-box-color-hex");
        const resetBtn = document.getElementById("fw-reset");

        if (themeLight && themeDark) {
            if (settings.theme === "light") {
                themeLight.checked = true;
            } else {
                themeDark.checked = true;
            }
        }
        if (schemeSelect) schemeSelect.value = settings.scheme;
        if (bgSelect) bgSelect.value = settings.background;
        if (fontSelect) fontSelect.value = settings.font;
        if (bgColorInput) bgColorInput.value = normalizeHexColor(settings.backgroundColor) || "#0b1226";
        if (bgColorHexInput) bgColorHexInput.value = normalizeHexColor(settings.backgroundColor) || "";
        if (uiColorInput) uiColorInput.value = normalizeHexColor(settings.uiColor) || defaults.uiColor;
        if (uiColorHexInput) uiColorHexInput.value = normalizeHexColor(settings.uiColor) || defaults.uiColor;
        if (fontColorInput) fontColorInput.value = normalizeHexColor(settings.fontColor) || defaults.fontColor;
        if (fontColorHexInput) fontColorHexInput.value = normalizeHexColor(settings.fontColor) || defaults.fontColor;
        if (heroBoxColorInput) heroBoxColorInput.value = normalizeHexColor(settings.heroBoxColor) || defaults.heroBoxColor;
        if (heroBoxColorHexInput) heroBoxColorHexInput.value = normalizeHexColor(settings.heroBoxColor) || defaults.heroBoxColor;

        function saveFromControls() {
            const bgColor = normalizeHexColor(bgColorHexInput ? bgColorHexInput.value : (bgColorInput ? bgColorInput.value : ""));
            const next = {
                theme: themeLight && themeLight.checked ? "light" : "dark",
                scheme: schemeSelect ? schemeSelect.value : defaults.scheme,
                background: bgSelect ? bgSelect.value : defaults.background,
                font: fontSelect ? fontSelect.value : defaults.font,
                backgroundColor: bgColor,
                uiColor: normalizeHexColor(uiColorHexInput ? uiColorHexInput.value : (uiColorInput ? uiColorInput.value : defaults.uiColor)) || defaults.uiColor,
                fontColor: normalizeHexColor(fontColorHexInput ? fontColorHexInput.value : (fontColorInput ? fontColorInput.value : defaults.fontColor)) || defaults.fontColor,
                heroBoxColor: normalizeHexColor(heroBoxColorHexInput ? heroBoxColorHexInput.value : (heroBoxColorInput ? heroBoxColorInput.value : defaults.heroBoxColor)) || defaults.heroBoxColor
            };
            if (bgColorInput) bgColorInput.value = bgColor || "#0b1226";
            if (bgColorHexInput) bgColorHexInput.value = bgColor;
            if (uiColorInput) uiColorInput.value = next.uiColor;
            if (uiColorHexInput) uiColorHexInput.value = next.uiColor;
            if (fontColorInput) fontColorInput.value = next.fontColor;
            if (fontColorHexInput) fontColorHexInput.value = next.fontColor;
            if (heroBoxColorInput) heroBoxColorInput.value = next.heroBoxColor;
            if (heroBoxColorHexInput) heroBoxColorHexInput.value = next.heroBoxColor;
            saveSettings(next);
            applySettings(next);
            persistSettingsToServer(next);
        }

        form.addEventListener("change", () => {
            saveFromControls();
        });

        if (bgColorInput) {
            bgColorInput.addEventListener("input", () => {
                if (bgColorHexInput) bgColorHexInput.value = bgColorInput.value.toLowerCase();
                saveFromControls();
            });
        }

        if (bgColorHexInput) {
            bgColorHexInput.addEventListener("input", () => {
                const normalized = normalizeHexColor(bgColorHexInput.value);
                if (normalized && bgColorInput) bgColorInput.value = normalized;
                saveFromControls();
            });
        }

        if (uiColorInput) {
            uiColorInput.addEventListener("input", () => {
                if (uiColorHexInput) uiColorHexInput.value = uiColorInput.value.toLowerCase();
                saveFromControls();
            });
        }

        if (uiColorHexInput) {
            uiColorHexInput.addEventListener("input", () => {
                const normalized = normalizeHexColor(uiColorHexInput.value);
                if (normalized && uiColorInput) uiColorInput.value = normalized;
                saveFromControls();
            });
        }

        if (fontColorInput) {
            fontColorInput.addEventListener("input", () => {
                if (fontColorHexInput) fontColorHexInput.value = fontColorInput.value.toLowerCase();
                saveFromControls();
            });
        }

        if (fontColorHexInput) {
            fontColorHexInput.addEventListener("input", () => {
                const normalized = normalizeHexColor(fontColorHexInput.value);
                if (normalized && fontColorInput) fontColorInput.value = normalized;
                saveFromControls();
            });
        }

        if (heroBoxColorInput) {
            heroBoxColorInput.addEventListener("input", () => {
                if (heroBoxColorHexInput) heroBoxColorHexInput.value = heroBoxColorInput.value.toLowerCase();
                saveFromControls();
            });
        }

        if (heroBoxColorHexInput) {
            heroBoxColorHexInput.addEventListener("input", () => {
                const normalized = normalizeHexColor(heroBoxColorHexInput.value);
                if (normalized && heroBoxColorInput) heroBoxColorInput.value = normalized;
                saveFromControls();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                saveSettings({ ...defaults });
                applySettings({ ...defaults });
                persistSettingsToServer({ ...defaults });
                if (themeLight && themeDark) {
                    themeDark.checked = true;
                }
                if (schemeSelect) schemeSelect.value = defaults.scheme;
                if (bgSelect) bgSelect.value = defaults.background;
                if (fontSelect) fontSelect.value = defaults.font;
                if (bgColorInput) bgColorInput.value = "#0b1226";
                if (bgColorHexInput) bgColorHexInput.value = "";
                if (uiColorInput) uiColorInput.value = defaults.uiColor;
                if (uiColorHexInput) uiColorHexInput.value = defaults.uiColor;
                if (fontColorInput) fontColorInput.value = defaults.fontColor;
                if (fontColorHexInput) fontColorHexInput.value = defaults.fontColor;
                if (heroBoxColorInput) heroBoxColorInput.value = defaults.heroBoxColor;
                if (heroBoxColorHexInput) heroBoxColorHexInput.value = defaults.heroBoxColor;
            });
        }
    }

    function ensureNavLinks() {
        const menu = document.getElementById("mainmenu");
        if (!menu) return;
        if (menu.querySelector('a[href="contacts.html"]') || menu.querySelector('a[href="/contacts.html"]')) return;

        const contactsLi = document.createElement("li");
        contactsLi.innerHTML = '<a class="menu-item" href="contacts.html"><i class="fa fa-address-book me-2"></i>Contacts</a>';

        const groupsLi = document.createElement("li");
        groupsLi.innerHTML = '<a class="menu-item" href="groups.html"><i class="fa fa-users me-2"></i>Groups</a>';

        const settingsLi = menu.querySelector('a[href="settings.html"]')?.closest("li");
        if (settingsLi && settingsLi.parentNode) {
            settingsLi.parentNode.insertBefore(contactsLi, settingsLi);
            settingsLi.parentNode.insertBefore(groupsLi, settingsLi);
        } else {
            menu.appendChild(contactsLi);
            menu.appendChild(groupsLi);
        }
    }

    function normalizeFavorite(item) {
        if (!item || typeof item !== "object") return null;
        const query = String(item.query || item.value || "").trim();
        const label = String(item.label || query).trim();
        if (!query || !label) return null;
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        return {
            id: String(item.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
            type: item.type === "city" ? "city" : "zip",
            query,
            label,
            lat: Number.isFinite(lat) ? lat : null,
            lon: Number.isFinite(lon) ? lon : null,
            updatedAt: Number(item.updatedAt) || Date.now()
        };
    }

    function loadFavorites() {
        try {
            const raw = localStorage.getItem(FAVORITES_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed.map(normalizeFavorite).filter(Boolean).slice(0, FAVORITES_MAX);
        } catch (_err) {
            return [];
        }
    }

    function saveFavorites(items) {
        const next = (Array.isArray(items) ? items : []).map(normalizeFavorite).filter(Boolean).slice(0, FAVORITES_MAX);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        try {
            window.dispatchEvent(new CustomEvent("fw:favorites", { detail: { favorites: next } }));
        } catch (_err) {
            // no-op
        }
        return next;
    }

    async function geocodeFavorite(type, query) {
        const cleaned = String(query || "").trim();
        if (!cleaned) throw new Error("Enter a ZIP or city first.");
        const search = type === "zip" ? cleaned.replace(/[^0-9]/g, "").slice(0, 10) : cleaned;
        if (!search) throw new Error("Enter a valid ZIP.");
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(search)}&count=1&language=en&format=json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Location lookup failed.");
        const json = await res.json();
        const first = json && json.results && json.results[0];
        if (!first) throw new Error("Location not found.");
        return {
            lat: Number(first.latitude),
            lon: Number(first.longitude),
            label: first.name ? `${first.name}${first.admin1 ? `, ${first.admin1}` : ""}` : search
        };
    }

    function renderFavoritesList() {
        const listEl = document.getElementById("fw-favorites-list");
        if (!listEl) return;
        const items = loadFavorites();
        if (!items.length) {
            listEl.innerHTML = '<div class="small text-muted">No favorites saved yet.</div>';
            return;
        }
        listEl.innerHTML = items.map((item, index) => `
            <div class="d-flex align-items-center justify-content-between gap-2 p-3 mb-2 bg-dark rounded-1">
                <div>
                    <div>${item.label}</div>
                    <div class="small text-muted">${item.type === "zip" ? "ZIP" : "City"}: ${item.query}</div>
                </div>
                <div class="d-flex gap-2">
                    <button type="button" class="btn-main btn-line" data-fav-edit="${item.id}" aria-label="Edit favorite">Edit</button>
                    <button type="button" class="btn-main btn-line" data-fav-up="${item.id}" ${index === 0 ? "disabled" : ""} aria-label="Move up">Up</button>
                    <button type="button" class="btn-main btn-line" data-fav-down="${item.id}" ${index === items.length - 1 ? "disabled" : ""} aria-label="Move down">Down</button>
                    <button type="button" class="btn-main btn-line" data-fav-remove="${item.id}" aria-label="Remove favorite">Remove</button>
                </div>
            </div>
        `).join("");
    }

    function setFavoritesFeedback(message, isError) {
        const el = document.getElementById("fw-favorites-feedback");
        if (!el) return;
        el.textContent = message || "";
        el.classList.toggle("text-danger", !!isError);
        el.classList.toggle("text-muted", !isError);
    }

    function initFavoritesManager() {
        const form = document.getElementById("fw-favorites-form");
        const typeEl = document.getElementById("fw-favorite-type");
        const inputEl = document.getElementById("fw-favorite-input");
        const listEl = document.getElementById("fw-favorites-list");
        if (!form || !typeEl || !inputEl || !listEl) return;

        renderFavoritesList();

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const current = loadFavorites();
            if (current.length >= FAVORITES_MAX) {
                setFavoritesFeedback("Maximum 5 favorites allowed.", true);
                return;
            }
            const type = typeEl.value === "city" ? "city" : "zip";
            const query = String(inputEl.value || "").trim();
            if (!query) {
                setFavoritesFeedback("Enter a ZIP or city.", true);
                return;
            }
            if (current.some((row) => row.query.toLowerCase() === query.toLowerCase())) {
                setFavoritesFeedback("That favorite already exists.", true);
                return;
            }
            setFavoritesFeedback("Saving favorite...", false);
            try {
                const geo = await geocodeFavorite(type, query);
                const next = [
                    ...current,
                    normalizeFavorite({
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        type,
                        query,
                        label: geo.label,
                        lat: geo.lat,
                        lon: geo.lon,
                        updatedAt: Date.now()
                    })
                ];
                saveFavorites(next);
                inputEl.value = "";
                renderFavoritesList();
                setFavoritesFeedback("Favorite saved.", false);
            } catch (err) {
                setFavoritesFeedback(String(err && err.message ? err.message : "Could not save favorite."), true);
            }
        });

        listEl.addEventListener("click", (event) => {
            const target = event.target;
            if (!target || !(target instanceof HTMLElement)) return;
            const removeId = target.getAttribute("data-fav-remove");
            const editId = target.getAttribute("data-fav-edit");
            const upId = target.getAttribute("data-fav-up");
            const downId = target.getAttribute("data-fav-down");
            let items = loadFavorites();
            if (editId) {
                const row = items.find((entry) => entry.id === editId);
                if (!row) return;
                typeEl.value = row.type === "city" ? "city" : "zip";
                inputEl.value = row.query;
                items = items.filter((entry) => entry.id !== editId);
                saveFavorites(items);
                renderFavoritesList();
                setFavoritesFeedback("Editing favorite: update the value and click Save Favorite.", false);
                inputEl.focus();
                return;
            }
            if (removeId) {
                items = items.filter((row) => row.id !== removeId);
                saveFavorites(items);
                renderFavoritesList();
                setFavoritesFeedback("Favorite removed.", false);
                return;
            }
            if (upId) {
                const idx = items.findIndex((row) => row.id === upId);
                if (idx > 0) {
                    const tmp = items[idx - 1];
                    items[idx - 1] = items[idx];
                    items[idx] = tmp;
                    saveFavorites(items);
                    renderFavoritesList();
                }
                return;
            }
            if (downId) {
                const idx = items.findIndex((row) => row.id === downId);
                if (idx > -1 && idx < items.length - 1) {
                    const tmp = items[idx + 1];
                    items[idx + 1] = items[idx];
                    items[idx] = tmp;
                    saveFavorites(items);
                    renderFavoritesList();
                }
            }
        });
    }

    const settings = loadSettings();
    applySettings(settings);
    document.addEventListener("DOMContentLoaded", async () => {
        const remote = await syncSettingsFromServer();
        if (remote) {
            applySettings(remote);
        }
        ensureNavLinks();
        initControls(loadSettings());
        initFavoritesManager();
    });
})();
