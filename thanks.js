// Thank-you page: confirm the spot, ask two optional questions, offer a call and a share link.
(function () {
  "use strict";
  var cfg = window.QUILLMARC_CONFIG || {};
  var track = window.qmTrack || function () {};
  var $ = function (s) { return document.querySelector(s); };
  var part = function (k) { return document.querySelector('[data-t="' + k + '"]'); };

  var signup = null;
  try { signup = JSON.parse(sessionStorage.getItem("qm-signup") || "null"); } catch (e) {}

  var title = $("#thanks-title");
  if (!signup) {
    title.textContent = "Join the Quillmarc waitlist.";
    part("lede").innerHTML = 'This page confirms a signup. <a href="/#join">Join the waitlist</a> to save your spot.';
  } else if (signup.status === "exists") {
    title.textContent = "You are already on the list.";
    part("lede").textContent = "Good news: this email was already saved, so there is nothing more to do. We will write when your invite is ready.";
  }
  if (signup && signup.emailed && signup.email) {
    part("email").textContent = signup.email;
    part("emailed").hidden = false;
  }
  if (signup && signup.founding) part("founding").hidden = false;
  title.focus({ preventScroll: true });

  function postAnswers(body) {
    return fetch("/api/answers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ token: signup.token }, body)) })
      .then(function (r) { return r.json().catch(function () { return { status: "error" }; }); });
  }

  // The questions need the one-time token from a fresh signup.
  if (signup && signup.token) {
    part("questions").hidden = false;
    var form = $(".answers"), status = $(".answers .form__status"), btn = $(".answers .btn");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var mrr = (form.elements.mrr_range && form.elements.mrr_range.value) || "";
      var pain = form.elements.pain_point.value.trim();
      if (!mrr && !pain) { status.textContent = "Pick a range or write a line, or skip this. Both are optional."; return; }
      status.textContent = "";
      btn.disabled = true;
      postAnswers({ mrr_range: mrr || null, pain_point: pain || null }).then(function (r) {
        if (r.status === "ok") {
          track("Extra Answer", { mrr: mrr || "skipped", wrote: pain ? "yes" : "no" });
          form.hidden = true;
          $(".answers__done").hidden = false;
          return;
        }
        btn.disabled = false;
        status.textContent = "That did not save. Please try again.";
      }).catch(function () { btn.disabled = false; status.textContent = "We could not reach the server. Please try again."; });
    });
  }

  // The call block appears only when BOOKING_URL is set.
  if (cfg.bookingUrl) {
    var link = part("call-link");
    link.href = cfg.bookingUrl;
    part("call").hidden = false;
    link.addEventListener("click", function () {
      track("Call Click");
      if (signup && signup.token) postAnswers({ call_clicked: true }).catch(function () {});
    });
  }

  // Share link, with attribution so referrals show up in the signups table.
  var base = (cfg.siteUrl || location.origin).replace(/\/$/, "");
  var url = base + "/?utm_source=share&utm_medium=referral";
  var input = $(".share__url"), share = $(".share__btn");
  input.value = url;
  share.addEventListener("click", function () {
    var done = function () { share.textContent = "Copied"; setTimeout(function () { share.textContent = "Copy link"; }, 2000); };
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      navigator.share({ title: "Quillmarc", text: "Monthly investor updates, written from your Stripe numbers.", url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { input.select(); });
    else { input.select(); document.execCommand && document.execCommand("copy"); done(); }
  });
})();
