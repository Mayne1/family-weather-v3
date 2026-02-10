(function () {
    const SETTINGS_KEY = "fw_settings";
    const defaults = {
        theme: "dark",
        scheme: "scheme-01",
        background: "default",
        font: "system"
    };

    function safeParse(raw) {
        try {
            const data = JSON.parse(raw);
            if (!data || typeof data !== "object") return { ...defaults };
            return {
                theme: data.theme || defaults.theme,
                scheme: data.scheme || defaults.scheme,
                background: data.background || defaults.background,
                font: data.font || defaults.font
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
        if (!body) return;

        body.classList.remove("dark-scheme", "light-scheme");
        body.classList.add(settings.theme === "light" ? "light-scheme" : "dark-scheme");

        body.classList.remove("fw-bg-default", "fw-bg-gradient", "fw-bg-pattern");
        body.classList.add(`fw-bg-${settings.background}`);

        body.classList.remove("fw-font-system", "fw-font-serif", "fw-font-mono");
        body.classList.add(`fw-font-${settings.font}`);

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

        form.addEventListener("change", () => {
            const next = {
                theme: themeLight && themeLight.checked ? "light" : "dark",
                scheme: schemeSelect ? schemeSelect.value : defaults.scheme,
                background: bgSelect ? bgSelect.value : defaults.background,
                font: fontSelect ? fontSelect.value : defaults.font
            };
            saveSettings(next);
            applySettings(next);
        });

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
            });
        }
    }

    const settings = loadSettings();
    applySettings(settings);
    document.addEventListener("DOMContentLoaded", () => {
        initControls(loadSettings());
    });
})();
