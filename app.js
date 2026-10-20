(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.classList.add("motion");

  // Theme toggle
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

  // Entrances: parts of each section rise in reading order, once
  document.querySelectorAll("section, footer").forEach(function (section) {
    section.querySelectorAll("[data-rise]").forEach(function (el, i) { el.style.setProperty("--i", i); });
  });
  var rising = document.querySelectorAll("[data-rise]");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    rising.forEach(function (el) { io.observe(el); });
  } else {
    rising.forEach(function (el) { el.classList.add("is-in"); });
  }

  // Hero: the pictures crossfade slowly, like light shifting in a room
  var pics = Array.prototype.slice.call(document.querySelectorAll(".hero__pictures img"));
  var capTitle = document.querySelector(".hero__caption-title");
  var capBy = document.querySelector(".hero__caption-by");
  var current = 0, timer = null;
  function showPicture(n) {
    pics[current].classList.remove("is-on");
    current = n;
    pics[current].classList.add("is-on");
    capTitle.textContent = pics[current].dataset.title;
    capBy.textContent = pics[current].dataset.by;
  }
  function startCycle() {
    if (reduced || pics.length < 2 || timer) return;
    timer = setInterval(function () { showPicture((current + 1) % pics.length); }, 5600);
  }
  function stopCycle() { clearInterval(timer); timer = null; }
  document.addEventListener("visibilitychange", function () { document.hidden ? stopCycle() : startCycle(); });
  startCycle();

  // How it works: the statement nearest the middle of the screen drives the fragment's state
  var steps = Array.prototype.slice.call(document.querySelectorAll(".how__step"));
  var app = document.querySelector(".app");
  // On phones the pinned stage would cover the words, so each statement carries its own copy
  steps.forEach(function (s) {
    var wrap = document.createElement("div");
    wrap.className = "how__clone";
    wrap.setAttribute("aria-hidden", "true");
    var copy = document.createElement("div");
    copy.className = "app";
    copy.setAttribute("data-ui", "");
    copy.dataset.state = s.dataset.step;
    copy.appendChild(app.querySelector('[data-pane="' + s.dataset.step + '"]').cloneNode(true));
    wrap.appendChild(copy);
    s.appendChild(wrap);
  });
  function pickStep() {
    var mid = window.innerHeight * 0.55, best = steps[0], bestD = Infinity;
    steps.forEach(function (s) {
      var r = s.getBoundingClientRect();
      var d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = s; }
    });
    steps.forEach(function (s) { s.classList.toggle("is-active", s === best); });
    if (app.dataset.state !== best.dataset.step) app.dataset.state = best.dataset.step;
  }
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { pickStep(); ticking = false; }); }
  }, { passive: true });
  pickStep();

  // Sample updates: Ledgerlane's last three months, and the visitor's own numbers
  var months = {
    jul: {
      name: "July", prev: "June", mrr: 43060, last: 41500, cust: 371, custLast: 359, churn: 1.6, churnLast: 1.8, netLast: 1210,
      wins: ["We launched the referral program on July 8.", "Support response time is down to under four hours after Ana joined as support lead."],
      misses: ["Two larger pilots stalled in procurement and will slip to September."],
      asks: ["Advice from anyone who has sold to agency procurement teams."]
    },
    aug: {
      name: "August", prev: "July", mrr: 45420, last: 43060, cust: 393, custLast: 371, churn: 1.4, churnLast: 1.6, netLast: 1560,
      wins: ["Referrals brought in 9 of our 22 new customers.", "One of the stalled pilots converted to an annual plan."],
      misses: ["Team workspaces slipped two weeks while we rebuilt permissions."],
      asks: ["Intros to engineering leads who have hired senior engineers in the last year."]
    },
    sep: {
      name: "September", prev: "August", mrr: 48200, last: 45420, cust: 412, custLast: 393, churn: 1.9, churnLast: 1.4, netLast: 2360,
      wins: ["We closed two annual plans, both through referrals, which is now our most efficient channel.", "Team workspaces shipped, and the first accounts using them are positive.", "A senior engineer joins on November 3."],
      misses: ["Churn rose after one agency account cancelled because of budget cuts."],
      asks: ["Introductions to operations leads at agencies with 20 to 200 people."]
    }
  };

  var letter = document.querySelector(".letter");
  var yours = document.querySelector(".yours");
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".sample__names button"));
  function k(key) { return letter.querySelector('[data-k="' + key + '"]'); }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; }
  function pct(a, b) { return b ? ((a - b) / b) * 100 : 0; }
  function signed(n, digits) { var s = Math.abs(n).toFixed(digits); return (n < 0 ? "−" : "+") + s; }
  function list(key, items) {
    var ul = k(key); ul.innerHTML = "";
    items.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); });
  }
  function opening(m) {
    var g = pct(m.mrr, m.last), net = m.mrr - m.last;
    var mood = g >= 5 ? "a strong month" : g >= 2 ? "a steady month" : g >= 0 ? "a quiet month" : "a difficult month";
    if (net < 0) {
      return m.name + " was " + mood + ". MRR fell " + Math.abs(g).toFixed(1) + "% to " + money(m.mrr) + ", down " + money(-net) + ", and we ended with " + m.cust.toLocaleString("en-US") + " customers.";
    }
    return m.name + " was " + mood + ". MRR grew " + g.toFixed(1) + "% to " + money(m.mrr) + ", adding " + money(net) + " in net new MRR, and we ended with " + m.cust.toLocaleString("en-US") + " customers.";
  }
  function render(m, isYours) {
    k("from").textContent = isYours ? "You <you@yourcompany.com>" : "Maya Okafor <maya@ledgerlane.example>";
    k("to").textContent = isYours ? "Your investors" : "Ledgerlane investors";
    k("subject").textContent = (isYours ? "Your company" : "Ledgerlane") + ", " + m.name + " update";
    k("open").textContent = opening(m);
    k("mrr").textContent = money(m.mrr);
    k("mrr-d").textContent = signed(pct(m.mrr, m.last), 1) + "%";
    k("net").textContent = money(m.mrr - m.last);
    k("net-d").textContent = m.netLast != null ? m.prev.slice(0, 3) + " " + money(m.netLast) : "From Stripe";
    k("cust").textContent = m.cust.toLocaleString("en-US");
    k("cust-d").textContent = m.custLast != null ? signed(m.cust - m.custLast, 0) : "From Stripe";
    k("churn").textContent = m.churn != null ? m.churn.toFixed(1) + "%" : "From Stripe";
    k("churn-d").textContent = m.churnLast != null ? m.prev.slice(0, 3) + " " + m.churnLast.toFixed(1) + "%" : "";
    list("wins", m.wins); list("misses", m.misses); list("asks", m.asks);
    k("sign").textContent = isYours ? "You" : "Maya";
  }
  function yourMonth() {
    var now = new Date();
    var name = now.toLocaleString("en-US", { month: "long" });
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "long" });
    return {
      name: name, prev: prev,
      mrr: num(document.getElementById("y-now").value),
      last: num(document.getElementById("y-last").value),
      cust: Math.round(num(document.getElementById("y-cust").value)),
      custLast: null, churn: null, churnLast: null, netLast: null,
      wins: ["Your first bullet, written as a finished sentence."],
      misses: ["What did not go to plan, said plainly."],
      asks: ["The one thing an investor could help with this month."]
    };
  }
  function select(tab) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); t.tabIndex = t === tab ? 0 : -1; });
    var key = tab.dataset.month, isYours = key === "you";
    yours.hidden = !isYours;
    var draw = function () { render(isYours ? yourMonth() : months[key], isYours); };
    if (reduced) { draw(); return; }
    letter.classList.add("is-swapping");
    setTimeout(function () { draw(); letter.classList.remove("is-swapping"); }, 200);
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); select(next);
    });
  });
  tabs.forEach(function (t) { t.tabIndex = t.getAttribute("aria-selected") === "true" ? 0 : -1; });
  yours.addEventListener("input", function () { render(yourMonth(), true); });

  // Links to the form put the cursor in the email field
  document.querySelectorAll("[data-focus]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var field = document.getElementById(a.dataset.focus);
      if (!field || field.offsetParent === null) return;
      e.preventDefault();
      document.getElementById("waitlist").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      setTimeout(function () { field.focus({ preventScroll: true }); }, reduced ? 0 : 600);
    });
  });

  // Waitlist form
  var form = document.querySelector(".form");
  var success = document.querySelector('[data-state="success"]');
  var submit = form.querySelector('button[type="submit"]');
  var submitLabel = submit.querySelector(".button__label");
  var status = form.querySelector(".form__status");
  var config = window.QUILLMARK_CONFIG || {};
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var messages = {
    email: "Enter a work email, like you@company.com.",
    company: "Enter your company name.",
    investor_count: "Choose how many investors you have.",
    current_method: "Choose how you send updates today."
  };

  function host(name) {
    var target = form.elements[name];
    return target && target.length && !target.tagName ? target[0].closest("fieldset") : target;
  }
  function setError(name, message) {
    var el = document.getElementById(name + "-error"), h = host(name);
    el.textContent = message || "";
    el.hidden = !message;
    if (message) { h.setAttribute("aria-invalid", "true"); h.setAttribute("aria-describedby", el.id); }
    else { h.removeAttribute("aria-invalid"); h.removeAttribute("aria-describedby"); }
  }
  function read() {
    return {
      email: form.elements.email.value.trim().toLowerCase(),
      company: form.elements.company.value.trim(),
      investor_count: form.elements.investor_count.value,
      current_method: form.elements.current_method.value
    };
  }
  function check(data, only) {
    var errors = {};
    if (!EMAIL_RE.test(data.email)) errors.email = messages.email;
    if (!data.company) errors.company = messages.company;
    if (!data.investor_count) errors.investor_count = messages.investor_count;
    if (!data.current_method) errors.current_method = messages.current_method;
    Object.keys(messages).forEach(function (n) { if (!only || only === n) setError(n, errors[n]); });
    return errors;
  }
  // Clear an error as soon as the field is fixed. Text fields use "input" so the layout
  // settles while typing, not on blur in the middle of the next click.
  function recheck(e) {
    var n = e.target.name;
    if (messages[n] && !document.getElementById(n + "-error").hidden) check(read(), n);
  }
  form.addEventListener("input", recheck);
  form.addEventListener("change", recheck);

  function busy(on) { submit.disabled = on; submitLabel.textContent = on ? "Sending" : "Join the waitlist"; }
  function done(email) {
    success.querySelector(".joined__email").textContent = email;
    form.hidden = true;
    success.hidden = false;
    success.classList.add("is-entering");
    success.querySelector(".joined__title").focus({ preventScroll: true });
  }
  function save(data) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) return Promise.reject(new Error("not_configured"));
    var body = Object.assign({}, data, { referrer: document.referrer ? document.referrer.slice(0, 500) : null });
    return fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.supabaseAnonKey,
        "Authorization": "Bearer " + config.supabaseAnonKey,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      // 409 is a repeat email: they are already on the list, which counts as success.
      if (res.ok || res.status === 409) return;
      return res.text().then(function (t) {
        if (/23505|duplicate key/i.test(t)) return;
        throw new Error("http_" + res.status);
      });
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.textContent = "";
    if (form.elements.website.value) { done(read().email); return; } // honeypot
    var data = read(), errors = check(data), first = Object.keys(errors)[0];
    if (first) { var el = form.elements[first]; (el.length && !el.tagName ? el[0] : el).focus(); return; }
    busy(true);
    save(data).then(function () { done(data.email); }).catch(function (err) {
      if (err && err.message === "not_configured") console.warn("Quillmark: set supabaseUrl and supabaseAnonKey in config.js to store submissions.");
      status.textContent = "That did not go through. Please check your connection and try again.";
      busy(false);
    });
  });
})();
