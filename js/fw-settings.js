(function () {
    const SETTINGS_KEY = "fw_settings";
    const defaults = {
        theme: "dark",
        scheme: "scheme-01",
        background: "default",
        font: "system",
        backgroundColor: ""
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
                backgroundColor: normalizeHexColor(data.backgroundColor)
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

        function saveFromControls() {
            const bgColor = normalizeHexColor(bgColorHexInput ? bgColorHexInput.value : (bgColorInput ? bgColorInput.value : ""));
            const next = {
                theme: themeLight && themeLight.checked ? "light" : "dark",
                scheme: schemeSelect ? schemeSelect.value : defaults.scheme,
                background: bgSelect ? bgSelect.value : defaults.background,
                font: fontSelect ? fontSelect.value : defaults.font,
                backgroundColor: bgColor
            };
            if (bgColorInput) bgColorInput.value = bgColor || "#0b1226";
            if (bgColorHexInput) bgColorHexInput.value = bgColor;
            saveSettings(next);
            applySettings(next);
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

        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                saveSettings({ ...defaults });
                applySettings({ ...defaults });
                if (themeLight && themeDark) {
                    themeDark.checked = true;
                }
                if (schemeSelect) schemeSelect.value = defaults.scheme;
                if (bgSelect) bgSelect.value = defaults.background;
                if (fontSelect) fontSelect.value = defaults.font;
                if (bgColorInput) bgColorInput.value = "#0b1226";
                if (bgColorHexInput) bgColorHexInput.value = "";
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

    const settings = loadSettings();
    applySettings(settings);
    document.addEventListener("DOMContentLoaded", () => {
        ensureNavLinks();
        initControls(loadSettings());
    });
})();
