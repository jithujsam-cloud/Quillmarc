// GET /config.js (rewritten to /api/config): public, non-secret settings for the browser,
// read from environment variables so they can change without a code edit.
const { env } = require("./_lib");

module.exports = function handler(req, res) {
  const cfg = {
    siteUrl: env("SITE_URL", "https://quillmarc.vercel.app").replace(/\/$/, ""),
    bookingUrl: env("BOOKING_URL"),
    contactEmail: env("CONTACT_EMAIL"),
    founderPhoto: env("FOUNDER_PHOTO_URL"),
    headlineTest: env("HEADLINE_TEST", "on") !== "off",
    plausibleDomain: env("PLAUSIBLE_DOMAIN"),
    plausibleSrc: env("PLAUSIBLE_SRC", "https://plausible.io/js/script.tagged-events.js")
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
  res.end("window.QUILLMARC_CONFIG = " + JSON.stringify(cfg) + ";\n");
};
