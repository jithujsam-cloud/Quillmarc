// Welcome email, sent through Resend when RESEND_API_KEY and RESEND_FROM are set.
const { env } = require("./_lib");

const NAVY = "#102542", INK = "#102542", MUTED = "#4A5A72", IVORY = "#FAF8F5", LINE = "#E8DFD0", GOLD = "#DDB040", TINT = "#F4EEE4";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function welcome({ founding }) {
  const site = env("SITE_URL", "https://quillmarc.vercel.app").replace(/\/$/, "");
  const appUrl = (env("APP_URL") || "").replace(/\/$/, "");
  const signIn = appUrl ? appUrl + "/login" : "";
  const offer = founding
    ? "You are one of the first 100 founders to sign up, so your price is locked: $29 a month for as long as you stay subscribed."
    : "The first 100 founders to sign up keep $29 a month for as long as they stay subscribed. The planned price for everyone else is $29 a month too, and we will confirm it before anyone is charged.";
  const subject = "Your Quillmarc 14-day free trial";
  const trial = "Your 14-day free trial is ready. No card needed. Your 14 days start when you first sign in.";

  const text = [
    "Your Quillmarc free trial is ready.",
    "",
    trial,
    signIn ? "Sign in: " + signIn : "Reply to this email and I will send your sign-in link.",
    "",
    "Quillmarc writes your monthly investor update from live Stripe data. You type five rough bullets. It adds your numbers, writes the update, sends it from your own domain and shows who opened it.",
    "",
    offer,
    "",
    "Here is what an update looks like (sample data, fictional company):",
    "",
    "Subject: Ledgerlane, September update",
    "Hi all,",
    "September was a strong month. MRR grew 6.1% to $48,200, adding $2,780 in net new MRR, and we ended with 412 customers.",
    "Highlights: we closed two annual plans, both through referrals. Team workspaces shipped. A senior engineer joins on November 3.",
    "Lowlights: churn rose to 1.9% after one agency cancelled over budget cuts.",
    "How you can help: introductions to operations leads at agencies with 20 to 200 people.",
    "",
    "One question: what is the most annoying part of your investor update today? Just reply to this email. I read every reply.",
    "",
    "Jithu",
    "Quillmarc",
    site
  ].join("\n");

  const kpi = (label, value, delta) =>
    `<td style="padding:10px 12px;background:${TINT};border-radius:8px;font-family:Helvetica,Arial,sans-serif;">
       <div style="font-size:12px;color:${MUTED};">${label}</div>
       <div style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:18px;color:${INK};">${value}</div>
       <div style="font-size:12px;color:${MUTED};">${delta}</div></td>`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${IVORY};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="padding:0 4px 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:${INK};">Quillmarc<span style="color:${GOLD};">.</span></td></tr>
  <tr><td style="background:#FFFFFF;border:1px solid ${LINE};border-radius:14px;padding:28px;font-family:Helvetica,Arial,sans-serif;color:${INK};font-size:16px;line-height:1.6;">
    <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-weight:normal;font-size:26px;line-height:1.2;">Your free trial is ready.</h1>
    <p style="margin:0 0 16px;">${esc(trial)}</p>
    ${signIn ? `<p style="margin:0 0 20px;"><a href="${esc(signIn)}" style="display:inline-block;background:${NAVY};color:${IVORY};padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Open Quillmarc</a></p>` : `<p style="margin:0 0 20px;">Reply to this email and I will send your sign-in link.</p>`}
    <p style="margin:0 0 16px;">Quillmarc writes your monthly investor update from live Stripe data. You type five rough bullets. It adds your numbers, writes the update, sends it from your own domain and shows who opened it.</p>
    <p style="margin:0 0 20px;padding:14px 16px;background:${TINT};border-left:3px solid ${GOLD};border-radius:6px;">${esc(offer)}</p>
    <p style="margin:0 0 10px;font-size:13px;color:${MUTED};">Here is what an update looks like. Sample data, fictional company.</p>
    <div style="border:1px solid ${LINE};border-radius:10px;padding:18px;">
      <div style="font-size:13px;color:${MUTED};margin-bottom:10px;">Subject: Ledgerlane, September update</div>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;">
        <p style="margin:0 0 10px;">Hi all,</p>
        <p style="margin:0 0 12px;">September was a strong month. MRR grew 6.1% to $48,200, adding $2,780 in net new MRR, and we ended with 412 customers.</p>
      </div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>${kpi("MRR", "$48,200", "+6.1%")}${kpi("Customers", "412", "+19")}${kpi("Revenue churn", "1.9%", "Aug 1.4%")}</tr></table>
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;margin-top:8px;">
        <p style="margin:0 0 6px;"><strong style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};">Highlights</strong><br>We closed two annual plans, both through referrals. Team workspaces shipped. A senior engineer joins on November 3.</p>
        <p style="margin:0 0 6px;"><strong style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};">Lowlights</strong><br>Churn rose to 1.9% after one agency cancelled over budget cuts.</p>
        <p style="margin:0;"><strong style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:${MUTED};">How you can help</strong><br>Introductions to operations leads at agencies with 20 to 200 people.</p>
      </div>
    </div>
    <p style="margin:22px 0 0;"><strong>One question:</strong> what is the most annoying part of your investor update today? Just reply to this email. I read every reply.</p>
    <p style="margin:16px 0 0;">Jithu<br><span style="color:${MUTED};">Quillmarc</span></p>
  </td></tr>
  <tr><td style="padding:18px 4px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:${MUTED};line-height:1.5;">You are getting this because you signed up for a free trial at <a href="${site}" style="color:${NAVY};">${site.replace(/^https?:\/\//, "")}</a>. Reply "remove" and we will delete your details. <a href="${site}/privacy" style="color:${NAVY};">Privacy</a></td></tr>
</table></td></tr></table></body></html>`;

  return { subject, text, html };
}

// Returns true when sent, false when skipped or failed. Never throws: email must not break signup.
async function sendWelcome(to, opts) {
  const key = env("RESEND_API_KEY"), from = env("RESEND_FROM");
  if (!key || !from) return false;
  const { subject, text, html } = welcome(opts);
  const payload = { from, to: [to], subject, text, html };
  const replyTo = env("CONTACT_EMAIL");
  if (replyTo) payload.reply_to = replyTo;
  try {
    const res = await fetch(env("RESEND_API_URL", "https://api.resend.com").replace(/\/$/, "") + "/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

module.exports = { sendWelcome, welcome };
