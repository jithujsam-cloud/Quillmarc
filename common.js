// Shared by every page: theme toggle, privacy-friendly analytics, first-touch attribution.
(function () {
  "use strict";
  var root = document.documentElement;
  var cfg = window.QUILLMARC_CONFIG || {};

  var toggle = document.querySelector(".theme");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var set = root.getAttribute("data-theme");
      var dark = set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("qm-theme", next); } catch (e) {}
    });
  }

  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 80); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // "#top" is the sticky nav, which is already on screen, so a plain anchor barely moves. Scroll to the real top.
  Array.prototype.forEach.call(document.querySelectorAll('a[href="#top"]'), function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
      var logo = document.querySelector(".nav__logo");
      if (logo) logo.focus({ preventScroll: true });
    });
  });

  // Plausible loads only when PLAUSIBLE_DOMAIN is set. No cookies, no personal data.
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
  if (cfg.plausibleDomain) {
    var s = document.createElement("script");
    s.defer = true;
    s.src = cfg.plausibleSrc || "https://plausible.io/js/script.tagged-events.js";
    s.setAttribute("data-domain", cfg.plausibleDomain);
    document.head.appendChild(s);
  }
  window.qmTrack = function (name, props) {
    if (!cfg.plausibleDomain) return;
    try { window.plausible(name, props ? { props: props } : undefined); } catch (e) {}
  };

  // First-touch attribution, kept for the session so it survives in-page navigation.
  var KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  window.qmAttribution = function () {
    var stored = null;
    try { stored = JSON.parse(sessionStorage.getItem("qm-attr") || "null"); } catch (e) {}
    if (stored) return stored;
    var q = new URLSearchParams(location.search), a = {};
    KEYS.forEach(function (k) { var v = q.get(k); if (v) a[k] = v.slice(0, 120); });
    var ref = document.referrer && document.referrer.indexOf(location.origin) !== 0 ? document.referrer.slice(0, 500) : null;
    a.referrer = ref;
    a.landing_path = (location.pathname + location.search).slice(0, 300);
    try { sessionStorage.setItem("qm-attr", JSON.stringify(a)); } catch (e) {}
    return a;
  };
  window.qmAttribution();

  // Fill in contact links wherever the page asks for them.
  document.querySelectorAll("[data-contact]").forEach(function (el) {
    if (cfg.contactEmail) {
      el.textContent = cfg.contactEmail;
      if (el.tagName === "A") el.href = "mailto:" + cfg.contactEmail;
    } else if (el.tagName === "A") {
      el.replaceWith(document.createTextNode(el.textContent));
    }
  });
})();
