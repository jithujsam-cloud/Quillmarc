(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  // Theme
  $(".theme").addEventListener("click", function () {
    var set = root.getAttribute("data-theme");
    var dark = set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    var next = dark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("qm-theme", next); } catch (e) {}
  });

  // Nav hairline once scrolled
  var nav = $(".nav");
  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Hero entrance, in reading order
  $$(".rise").forEach(function (el, i) { el.style.setProperty("--i", i); });
  function loaded() { root.classList.add("is-loaded"); }
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 600); })]).then(loaded);
  } else { loaded(); }

  // Section reveals: the parts of each section arrive in order, once
  $$("section").forEach(function (s) { $$(".reveal", s).forEach(function (el, i) { el.style.setProperty("--i", i % 4); }); });
  var reveals = $$(".reveal");
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  // The product stage is drawn at 1088px and scaled to fit, like a screenshot that stays sharp
  var stage = $(".stage");
  function fitStage() {
    // On narrow screens, drop the sidebar out of frame so the composer and letter stay legible
    var crop = stage.clientWidth < 680;
    stage.classList.toggle("is-crop", crop);
    var cs = getComputedStyle(stage);
    var inner = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    stage.style.setProperty("--k", Math.min(1, inner / (crop ? 900 : 1088)).toFixed(4));
  }
  window.addEventListener("resize", fitStage);
  fitStage();

  // Charts: one series, a 2px line, a quiet grid, the latest value marked
  var series = [
    ["Oct", 29800], ["Nov", 31200], ["Dec", 32100], ["Jan", 33900], ["Feb", 35000], ["Mar", 36600],
    ["Apr", 38200], ["May", 39900], ["Jun", 41500], ["Jul", 43060], ["Aug", 45420], ["Sep", 48200]
  ];
  var NS = "http://www.w3.org/2000/svg";
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function drawChart(host, data, opts) {
    var w = host.clientWidth || 400, h = host.clientHeight || 120;
    var pad = opts.axis ? { t: 10, r: 8, b: 24, l: 8 } : { t: 6, r: 6, b: 6, l: 2 };
    var min = opts.min, max = opts.max;
    var x = function (i) { return pad.l + (i / (data.length - 1)) * (w - pad.l - pad.r); };
    var y = function (v) { return pad.t + (1 - (v - min) / (max - min)) * (h - pad.t - pad.b); };
    var pts = data.map(function (d, i) { return [x(i), y(d[1])]; });
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("");
    var svg = '<svg class="chart-svg" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" aria-hidden="true">';
    if (opts.axis) {
      [0.25, 0.5, 0.75, 1].forEach(function (f) { var gy = pad.t + f * (h - pad.t - pad.b); svg += '<line class="grid" x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + gy + '" y2="' + gy + '"/>'; });
      data.forEach(function (d, i) { if (i % 2 === 1 || i === data.length - 1) svg += '<text class="axis" x="' + x(i) + '" y="' + (h - 6) + '" text-anchor="middle">' + d[0] + "</text>"; });
    }
    svg += '<path class="area" d="' + line + "L" + x(data.length - 1) + " " + (h - pad.b) + "L" + x(0) + " " + (h - pad.b) + 'Z"/>';
    svg += '<path class="line" d="' + line + '"/>';
    var last = pts[pts.length - 1];
    svg += '<circle class="end" cx="' + last[0] + '" cy="' + last[1] + '" r="4"/>';
    if (opts.hover) svg += '<line class="cross" y1="' + pad.t + '" y2="' + (h - pad.b) + '"/><circle class="hot" r="5"/>';
    svg += "</svg>";
    host.innerHTML = svg + (opts.hover ? '<div class="chart__tip"></div>' : "");
    if (!opts.hover) return;
    var tip = $(".chart__tip", host), cross = $(".cross", host), hot = $(".hot", host);
    function show(i) {
      var p = pts[i];
      cross.setAttribute("x1", p[0]); cross.setAttribute("x2", p[0]);
      hot.setAttribute("cx", p[0]); hot.setAttribute("cy", p[1]);
      tip.style.left = (p[0] / w * 100) + "%"; tip.style.top = p[1] + "px";
      tip.innerHTML = data[i][0] + "<b>" + money(data[i][1]) + "</b>";
    }
    host.addEventListener("pointermove", function (e) {
      var r = host.getBoundingClientRect(), rel = (e.clientX - r.left) / r.width * w;
      var i = Math.round((rel - pad.l) / (w - pad.l - pad.r) * (data.length - 1));
      show(Math.max(0, Math.min(data.length - 1, i)));
    });
    show(data.length - 1);
  }
  var heroChart = $('[data-chart="hero"]');
  var featureChart = $('[data-chart="feature"] .chart__plot');
  function drawAll() {
    drawChart(heroChart, series.slice(-6), { min: 36000, max: 49500 });
    drawChart(featureChart, series, { min: 26000, max: 50000, axis: true, hover: true });
  }
  drawAll();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(drawAll, 150); });
  var tbody = $(".chart__table tbody");
  series.forEach(function (d) { var tr = document.createElement("tr"); tr.innerHTML = "<th>" + d[0] + "</th><td>" + money(d[1]) + "</td>"; tbody.appendChild(tr); });

  // Hero product: figures count up, bullets type in, then the letter writes itself
  var words = $$(".stage .w");
  var bullets = $$(".stage [data-type]");
  function finishStage() { words.forEach(function (w) { w.classList.add("on"); }); }
  if (reduced) { finishStage(); }
  else {
    var texts = bullets.map(function (b) { var t = b.textContent; b.textContent = ""; return t; });
    $$(".stage .num[data-count]").forEach(function (el) {
      var to = +el.dataset.count, pre = el.dataset.prefix || "", t0 = null;
      el.textContent = pre + "0";
      function tick(t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / 1400), e = 1 - Math.pow(1 - p, 4);
        el.textContent = pre + Math.round(to * e).toLocaleString("en-US");
        if (p < 1) requestAnimationFrame(tick);
      }
      setTimeout(function () { requestAnimationFrame(tick); }, 700);
    });
    var bi = 0;
    function typeNext() {
      if (bi >= bullets.length) { revealWords(0); return; }
      var el = bullets[bi], text = texts[bi], ci = 0;
      (function step() {
        ci += 2;
        el.textContent = text.slice(0, ci);
        if (ci < text.length) setTimeout(step, 18);
        else { bi++; setTimeout(typeNext, 140); }
      })();
    }
    function revealWords(i) {
      if (i >= words.length) return;
      words[i].classList.add("on");
      setTimeout(function () { revealWords(i + 1); }, 160);
    }
    setTimeout(typeNext, 1200);
  }

  // Sample updates: Ledgerlane's last three months, and the visitor's own numbers
  var months = {
    jul: { name: "July", prev: "June", mrr: 43060, last: 41500, cust: 371, custLast: 359, churn: 1.6, churnLast: 1.8, netLast: 1210,
      wins: ["We launched the referral program on July 8.", "Support replies now arrive in under four hours since Ana joined as support lead."],
      misses: ["Two larger pilots stalled in procurement and will slip to September."],
      asks: ["Advice from anyone who has sold to agency procurement teams."] },
    aug: { name: "August", prev: "July", mrr: 45420, last: 43060, cust: 393, custLast: 371, churn: 1.4, churnLast: 1.6, netLast: 1560,
      wins: ["Referrals brought in 9 of our 22 new customers.", "One of the stalled pilots converted to an annual plan."],
      misses: ["Team workspaces slipped two weeks while we rebuilt permissions."],
      asks: ["Intros to engineering leads who have hired senior engineers this year."] },
    sep: { name: "September", prev: "August", mrr: 48200, last: 45420, cust: 412, custLast: 393, churn: 1.9, churnLast: 1.4, netLast: 2360,
      wins: ["We closed two annual plans, both through referrals, which is now our most efficient channel.", "Team workspaces shipped, and the first accounts using them are positive.", "A senior engineer joins on November 3."],
      misses: ["Churn rose after one agency account cancelled because of budget cuts."],
      asks: ["Introductions to operations leads at agencies with 20 to 200 people."] }
  };
  var letter = $(".letter"), yours = $(".yours"), tabs = $$(".tabs button");
  function k(key) { return $('[data-k="' + key + '"]', letter); }
  function num(v) { var n = parseFloat(String(v).replace(/[^0-9.]/g, "")); return isFinite(n) ? n : 0; }
  function pct(a, b) { return b ? ((a - b) / b) * 100 : 0; }
  function signed(n, d) { return (n < 0 ? "−" : "+") + Math.abs(n).toFixed(d); }
  function list(key, items) { var ul = k(key); ul.innerHTML = ""; items.forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ul.appendChild(li); }); }
  function opening(m) {
    var g = pct(m.mrr, m.last), net = m.mrr - m.last, c = m.cust.toLocaleString("en-US");
    var mood = g >= 5 ? "a strong month" : g >= 2 ? "a steady month" : g >= 0 ? "a quiet month" : "a difficult month";
    if (net < 0) return m.name + " was " + mood + ". MRR fell " + Math.abs(g).toFixed(1) + "% to " + money(m.mrr) + ", down " + money(-net) + ", and we ended with " + c + " customers.";
    return m.name + " was " + mood + ". MRR grew " + g.toFixed(1) + "% to " + money(m.mrr) + ", adding " + money(net) + " in net new MRR, and we ended with " + c + " customers.";
  }
  function render(m, isYours) {
    k("from").textContent = isYours ? "You <you@yourcompany.com>" : "Maya Okafor <maya@ledgerlane.com>";
    k("to").textContent = isYours ? "Your investors" : "Ledgerlane investors (14)";
    k("subject").textContent = (isYours ? "Your company" : "Ledgerlane") + ", " + m.name + " update";
    k("open").textContent = opening(m);
    k("mrr").textContent = money(m.mrr);
    k("mrr-d").textContent = signed(pct(m.mrr, m.last), 1) + "%";
    k("net").textContent = money(m.mrr - m.last);
    k("net-d").textContent = m.netLast != null ? m.prev.slice(0, 3) + " " + money(m.netLast) : "From Stripe";
    k("cust").textContent = m.cust.toLocaleString("en-US");
    k("cust-d").textContent = m.custLast != null ? signed(m.cust - m.custLast, 0) : "From Stripe";
    k("churn").textContent = m.churn != null ? m.churn.toFixed(1) + "%" : "From Stripe";
    k("churn-d").textContent = m.churnLast != null ? m.prev.slice(0, 3) + " " + m.churnLast.toFixed(1) + "%" : "Pulled monthly";
    list("wins", m.wins); list("misses", m.misses); list("asks", m.asks);
    k("sign").textContent = isYours ? "You" : "Maya";
  }
  function yourMonth() {
    var now = new Date();
    return {
      name: now.toLocaleString("en-US", { month: "long" }),
      prev: new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en-US", { month: "long" }),
      mrr: num($("#y-now").value), last: num($("#y-last").value), cust: Math.round(num($("#y-cust").value)),
      custLast: null, churn: null, churnLast: null, netLast: null,
      wins: ["Your first bullet, written as a finished sentence."],
      misses: ["What did not go to plan, said plainly."],
      asks: ["The one thing an investor could help with this month."]
    };
  }
  function select(tab) {
    tabs.forEach(function (t) { var on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; });
    var key = tab.dataset.month, isYours = key === "you";
    yours.hidden = !isYours;
    var draw = function () { render(isYours ? yourMonth() : months[key], isYours); };
    if (reduced) return draw();
    letter.classList.add("is-swapping");
    setTimeout(function () { draw(); letter.classList.remove("is-swapping"); }, 200);
  }
  tabs.forEach(function (t, i) {
    t.tabIndex = t.getAttribute("aria-selected") === "true" ? 0 : -1;
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n);
    });
  });
  yours.addEventListener("input", function () { render(yourMonth(), true); });

  // Waitlist: email first, then three short questions, then one insert into Supabase
  var form = $(".join__form"), stepOne = $(".join__step--one"), stepTwo = $(".join__step--two");
  var joined = $(".joined"), status = $(".form__status"), submitTwo = $('[data-step="two"]');
  var config = window.QUILLMARK_CONFIG || {};
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var messages = {
    email: "Enter a work email, like you@company.com.",
    company: "Enter your company name.",
    investor_count: "Choose how many investors you have.",
    current_method: "Choose how you send updates today."
  };
  function host(name) { var t = form.elements[name]; return t && t.length && !t.tagName ? t[0].closest("fieldset") : t; }
  function setError(name, msg) {
    var el = document.getElementById(name + "-error"), h = name === "email" ? $(".join__row") : host(name);
    el.textContent = msg || ""; el.hidden = !msg;
    var target = name === "email" ? form.elements.email : h;
    if (msg) { target.setAttribute("aria-invalid", "true"); target.setAttribute("aria-describedby", el.id); }
    else { target.removeAttribute("aria-invalid"); target.removeAttribute("aria-describedby"); }
  }
  function read() {
    return {
      email: form.elements.email.value.trim().toLowerCase(),
      company: form.elements.company.value.trim(),
      investor_count: form.elements.investor_count.value,
      current_method: form.elements.current_method.value
    };
  }
  function check(names) {
    var d = read(), bad = null;
    names.forEach(function (n) {
      var ok = n === "email" ? EMAIL_RE.test(d.email) : !!d[n];
      setError(n, ok ? "" : messages[n]);
      if (!ok && !bad) bad = n;
    });
    return bad;
  }
  function focusField(n) { var el = form.elements[n]; (el.length && !el.tagName ? el[0] : el).focus(); }
  form.addEventListener("input", function (e) {
    var n = e.target.name;
    if (messages[n] && !document.getElementById(n + "-error").hidden) check([n]);
  });
  form.addEventListener("change", function (e) {
    var n = e.target.name;
    if (messages[n] && !document.getElementById(n + "-error").hidden) check([n]);
  });

  function openStepTwo() {
    stepTwo.hidden = false;
    stepTwo.style.animation = reduced ? "none" : "settle 600ms var(--ease-out) both";
    $(".join__row .btn").innerHTML = "Change email";
    $(".join__row .btn").classList.add("btn--quiet");
    form.elements.company.focus({ preventScroll: true });
  }
  function busy(on) { submitTwo.disabled = on; $(".btn__label", submitTwo).textContent = on ? "Sending" : "Request my invite"; }
  function done(email) {
    $(".joined__email").textContent = email;
    form.hidden = true; joined.hidden = false;
    $(".joined__title").focus({ preventScroll: true });
  }
  function save(data) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) return Promise.reject(new Error("not_configured"));
    var body = Object.assign({}, data, { referrer: document.referrer ? document.referrer.slice(0, 500) : null });
    return fetch(config.supabaseUrl.replace(/\/$/, "") + "/rest/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": config.supabaseAnonKey, "Authorization": "Bearer " + config.supabaseAnonKey, "Prefer": "return=minimal" },
      body: JSON.stringify(body)
    }).then(function (res) {
      // 409 is a repeat email: already on the list, which counts as success.
      if (res.ok || res.status === 409) return;
      return res.text().then(function (t) { if (/23505|duplicate key/i.test(t)) return; throw new Error("http_" + res.status); });
    });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var which = e.submitter && e.submitter.dataset.step;
    if (!which) which = stepTwo.hidden ? "one" : "two";
    if (which === "one") {
      if (!stepTwo.hidden) { form.elements.email.focus(); form.elements.email.select(); return; }
      if (check(["email"])) { form.elements.email.focus(); return; }
      openStepTwo();
      return;
    }
    status.textContent = "";
    if (form.elements.website.value) { done(read().email); return; } // honeypot
    var bad = check(["email", "company", "investor_count", "current_method"]);
    if (bad) { focusField(bad); return; }
    var data = read();
    busy(true);
    save(data).then(function () { done(data.email); }).catch(function (err) {
      if (err && err.message === "not_configured") console.warn("Quillmark: set supabaseUrl and supabaseAnonKey in config.js to store submissions.");
      status.textContent = "That did not go through. Please check your connection and try again.";
      busy(false);
    });
  });

  // Every "Join the waitlist" leads back to the one form at the top
  function goToForm(prefill) {
    $("#join").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    setTimeout(function () {
      if (!joined.hidden) return;
      if (prefill && EMAIL_RE.test(prefill.trim())) {
        form.elements.email.value = prefill.trim();
        setError("email", "");
        if (stepTwo.hidden) openStepTwo(); else form.elements.company.focus({ preventScroll: true });
      } else {
        (stepTwo.hidden ? form.elements.email : form.elements.company).focus({ preventScroll: true });
      }
    }, reduced ? 0 : 650);
  }
  $$("[data-focus]").forEach(function (a) { a.addEventListener("click", function (e) { e.preventDefault(); goToForm(); }); });
  $(".cta__form").addEventListener("submit", function (e) { e.preventDefault(); goToForm($("#cta-email").value); });
})();
