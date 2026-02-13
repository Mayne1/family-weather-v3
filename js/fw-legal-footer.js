(function () {
  function buildLegalHtml() {
    return (
      '<div class="fw-legal-links">' +
      '<a href="/privacy">Privacy</a>' +
      '<span aria-hidden="true">•</span>' +
      '<a href="/terms">Terms</a>' +
      '<span aria-hidden="true">•</span>' +
      '<a href="/sms-consent">SMS Consent</a>' +
      "</div>" +
      '<div class="fw-legal-copy">&#169; Family Weather</div>'
    );
  }

  function ensureFooter() {
    var textCenters = document.querySelectorAll(".subfooter .text-center");
    if (textCenters.length) {
      textCenters.forEach(function (el) {
        el.innerHTML = buildLegalHtml();
      });
      return;
    }

    var wrapper = document.getElementById("wrapper");
    if (!wrapper) return;
    var footer = document.createElement("footer");
    footer.className = "text-light section-dark";
    footer.innerHTML =
      '<div class="subfooter"><div class="container"><div class="row"><div class="col-md-12 text-center">' +
      buildLegalHtml() +
      "</div></div></div></div>";
    wrapper.insertAdjacentElement("afterend", footer);
  }

  document.addEventListener("DOMContentLoaded", ensureFooter);
})();
