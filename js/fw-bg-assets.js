(function () {
  "use strict";

  // Asset map (normalized):
  // clear: bg_clear_01.mp4, bg_clear_02.mp4
  // cloudy: bg_cloudy_01.png
  // rain: bg_rain_01.png
  // snow: bg_snow_01.png
  // thunder: bg_thunder_01.png
  // mixed: bg_mixed_01.webp ... bg_mixed_10.mp4
  const base = "assets/backgrounds/";

  const assets = {
    clear: [
      { type: "video", src: base + "bg_clear_01.mp4" },
      { type: "video", src: base + "bg_clear_02.mp4" }
    ],
    partly_cloudy: [
      { type: "video", src: base + "bg_clear_01.mp4" },
      { type: "image", src: base + "bg_cloudy_01.png" }
    ],
    cloudy: [
      { type: "image", src: base + "bg_cloudy_01.png" },
      { type: "image", src: base + "bg_mixed_02.webp" }
    ],
    fog: [
      { type: "image", src: base + "bg_mixed_06.webp" },
      { type: "image", src: base + "bg_mixed_03.webp" }
    ],
    rain: [
      { type: "image", src: base + "bg_rain_01.png" },
      { type: "image", src: base + "bg_mixed_04.webp" }
    ],
    drizzle: [
      { type: "image", src: base + "bg_mixed_07.webp" },
      { type: "image", src: base + "bg_mixed_04.webp" }
    ],
    thunder: [
      { type: "image", src: base + "bg_thunder_01.png" },
      { type: "video", src: base + "bg_mixed_10.mp4" }
    ],
    snow: [
      { type: "image", src: base + "bg_snow_01.png" },
      { type: "image", src: base + "bg_mixed_08.webp" }
    ],
    sleet: [
      { type: "video", src: base + "bg_mixed_09.mp4" },
      { type: "image", src: base + "bg_mixed_08.webp" }
    ],
    hail: [
      { type: "video", src: base + "bg_mixed_09.mp4" },
      { type: "image", src: base + "bg_mixed_07.webp" }
    ],
    wind: [
      { type: "video", src: base + "bg_mixed_10.mp4" },
      { type: "image", src: base + "bg_mixed_05.webp" }
    ],
    mixed: [
      { type: "image", src: base + "bg_mixed_01.webp" },
      { type: "image", src: base + "bg_mixed_02.webp" },
      { type: "image", src: base + "bg_mixed_03.webp" },
      { type: "image", src: base + "bg_mixed_04.webp" },
      { type: "image", src: base + "bg_mixed_05.webp" },
      { type: "image", src: base + "bg_mixed_06.webp" },
      { type: "image", src: base + "bg_mixed_07.webp" },
      { type: "image", src: base + "bg_mixed_08.webp" },
      { type: "video", src: base + "bg_mixed_09.mp4" },
      { type: "video", src: base + "bg_mixed_10.mp4" }
    ]
  };

  window.FW_BG_ASSETS = assets;
})();

