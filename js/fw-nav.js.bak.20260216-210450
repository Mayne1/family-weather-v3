(function () {
  var MOBILE_BREAKPOINT = 1100;

  function initNavBehavior() {
    var header = document.querySelector("header");
    var menu = document.getElementById("mainmenu");
    var menuBtn = document.getElementById("menu-btn");
    if (!header || !menu || !menuBtn) return;

    function closeMenu() {
      header.classList.remove("fw-nav-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }

    function toggleMenu(event) {
      if (window.innerWidth > MOBILE_BREAKPOINT) return;
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      var nextOpen = !header.classList.contains("fw-nav-open");
      if (nextOpen) {
        header.classList.add("fw-nav-open");
        menuBtn.setAttribute("aria-expanded", "true");
      } else {
        closeMenu();
      }
    }

    menuBtn.setAttribute("role", "button");
    menuBtn.setAttribute("aria-label", "Toggle navigation");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.addEventListener("click", toggleMenu);

    menu.addEventListener("click", function (event) {
      var target = event.target;
      if (!target || !(target instanceof HTMLElement)) return;
      if (target.closest("a") && window.innerWidth <= 800) closeMenu();
    });

    document.addEventListener("click", function (event) {
      if (window.innerWidth > MOBILE_BREAKPOINT) return;
      var target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.closest("header")) closeMenu();
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > MOBILE_BREAKPOINT) closeMenu();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNavBehavior);
  } else {
    initNavBehavior();
  }
})();
