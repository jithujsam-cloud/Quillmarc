(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  // Theme toggle
  var toggle = document.querySelector(".theme-toggle");
  function currentTheme() {
    var set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("qm-theme", next); } catch (e) {}
    });
  }

  // Nav hairline once scrolled
  var nav = document.querySelector(".nav");
  function onScroll() { nav.classList.toggle("is-scrolled", window.scrollY > 8); }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Gentle reveal
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  // Waitlist form
  var form = document.querySelector(".form");
  if (!form) return;

  var formPane = document.querySelector('[data-state="form"]');
  var successPane = document.querySelector('[data-state="success"]');
  var submit = form.querySelector('button[type="submit"]');
  var submitLabel = submit.querySelector(".btn__label");
  var status = form.querySelector(".form__status");
  var config = window.QUILLMARK_CONFIG || {};

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var messages = {
    email: "Enter a work email, like you@company.com.",
    company: "Enter your company name.",
    investor_count: "Choose how many investors you have.",
    current_method: "Choose how you send updates today."
  };

  function setError(name, message) {
    var el = document.getElementById(name + "-error");
    var target = form.elements[name];
    var host = target && target.length && !target.tagName
      ? target[0].closest("fieldset")
      : target;
    if (message) {
      el.textContent = message;
      el.hidden = false;
      if (host) {
        host.setAttribute("aria-invalid", "true");
        host.setAttribute("aria-describedby", el.id);
      }
    } else {
      el.textContent = "";
      el.hidden = true;
      if (host) {
        host.removeAttribute("aria-invalid");
        host.removeAttribute("aria-describedby");
      }
    }
  }

  function read() {
    return {
      email: form.elements.email.value.trim().toLowerCase(),
      company: form.elements.company.value.trim(),
      investor_count: form.elements.investor_count.value,
      current_method: form.elements.current_method.value
    };
  }

  function validate(data) {
    var errors = {};
    if (!EMAIL_RE.test(data.email)) errors.email = messages.email;
    if (!data.company) errors.company = messages.company;
    if (!data.investor_count) errors.investor_count = messages.investor_count;
    if (!data.current_method) errors.current_method = messages.current_method;
    Object.keys(messages).forEach(function (k) { setError(k, errors[k]); });
    return errors;
  }

  // Clear an error as soon as the field is fixed. Text fields use "input" so the
  // layout settles while typing, not on blur in the middle of the next click.
  function recheck(e) {
    var name = e.target.name;
    if (messages[name] && !document.getElementById(name + "-error").hidden) {
      var errs = {};
      var data = read();
      if (name === "email" && !EMAIL_RE.test(data.email)) errs.email = messages.email;
      if (name === "company" && !data.company) errs.company = messages.company;
      setError(name, errs[name]);
    }
  }
  form.addEventListener("input", recheck);
  form.addEventListener("change", recheck);

  function setBusy(busy) {
    submit.disabled = busy;
    submitLabel.textContent = busy ? "Sending" : "Request an invite";
  }

  function showSuccess(email) {
    successPane.querySelector(".success__email").textContent = email;
    formPane.hidden = true;
    successPane.hidden = false;
    successPane.classList.add("is-entering");
    successPane.querySelector(".form-card__title").focus({ preventScroll: true });
  }

  function save(data) {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      return Promise.reject(new Error("not_configured"));
    }
    var body = Object.assign({}, data, {
      referrer: document.referrer ? document.referrer.slice(0, 500) : null
    });
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
      if (res.ok) return;
      // 409 is a duplicate email: they are already on the list, which is a success.
      if (res.status === 409) return;
      return res.text().then(function (t) {
        if (/23505|duplicate key/i.test(t)) return;
        throw new Error("http_" + res.status);
      });
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.textContent = "";

    // Honeypot: quietly accept and drop.
    if (form.elements.website.value) {
      showSuccess(read().email);
      return;
    }

    var data = read();
    var errors = validate(data);
    var first = Object.keys(errors)[0];
    if (first) {
      var el = form.elements[first];
      (el.length && !el.tagName ? el[0] : el).focus();
      return;
    }

    setBusy(true);
    save(data).then(function () {
      showSuccess(data.email);
    }).catch(function (err) {
      if (err && err.message === "not_configured") {
        console.warn("Quillmark: set supabaseUrl and supabaseAnonKey in config.js to store submissions.");
      }
      status.textContent = "That did not go through. Please check your connection and try again.";
      setBusy(false);
    });
  });
})();
