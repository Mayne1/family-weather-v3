const express = require("express");
const router = express.Router();
const { verifySignature } = require("@vonage/jwt");
const { Vonage } = require("@vonage/server-sdk");

const SIG_SECRET = process.env.VONAGE_API_SIGNATURE_SECRET || "";

function getBearer(req) {
  const h = req.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

function requireVonageSignature(req) {
  if (!SIG_SECRET) return { ok: false, code: 500, msg: "sig_secret_not_configured" };

  const token = getBearer(req);
  if (!token) return { ok: false, code: 401, msg: "missing_bearer" };

  const ok = verifySignature(token, SIG_SECRET);
  if (!ok) return { ok: false, code: 401, msg: "bad_signature" };

  return { ok: true };
}

const VONAGE_API_KEY = process.env.VONAGE_API_KEY || "";
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || "";
const VONAGE_FROM = process.env.VONAGE_FROM || process.env.VONAGE_BRAND_NAME || "FamilyWeather";

const vonage = new Vonage({
  apiKey: VONAGE_API_KEY,
  apiSecret: VONAGE_API_SECRET
});

/**
 * Vonage Inbound SMS (POST-JSON)
 * Configure Vonage Inbound webhook URL:
 *   https://thefamilyweather.com/api/vonage/inbound
 */
router.post("/inbound", (req, res) => {
  const v = requireVonageSignature(req);
  if (!v.ok) return res.status(v.code).send(v.msg);

  console.log("VONAGE INBOUND:", JSON.stringify(req.body, null, 2));
  return res.status(200).send("ok");
});

/**
 * Vonage Delivery Receipts (DLR) (POST-JSON)
 * Configure Vonage DLR webhook URL:
 *   https://thefamilyweather.com/api/vonage/dlr
 */
router.post("/dlr", (req, res) => {
  const v = requireVonageSignature(req);
  if (!v.ok) return res.status(v.code).send(v.msg);

  console.log("VONAGE DLR:", JSON.stringify(req.body, null, 2));
  return res.status(200).send("ok");
});

/**
 * Website SMS transport bridge (POST-JSON)
 * Endpoint expected by frontend:
 *   POST /api/invites/send-sms
 */
router.post("/invites/send-sms", async (req, res) => {
  try {
    const { eventId, eventTitle, message, invites } = req.body || {};
    if (!Array.isArray(invites) || invites.length === 0) {
      return res.status(400).json({ ok: false, error: "invites_required" });
    }
    if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
      return res.status(500).json({ ok: false, error: "vonage_credentials_missing" });
    }

    const results = [];
    for (const row of invites) {
      const phone = row?.phone ? String(row.phone).trim() : "";
      const token = row?.token ? String(row.token).trim() : "";
      const link = row?.link ? String(row.link).trim() : "";
      if (!phone || !token || !link) {
        results.push({ phone, token, ok: false, error: "invalid_invite_row" });
        continue;
      }

      const text = String(message || "").trim() ||
        `You're invited to ${eventTitle || "an event"} on Family Weather. RSVP: ${link}`;

      try {
        const response = await vonage.sms.send({
          to: phone,
          from: VONAGE_FROM,
          text
        });
        results.push({ phone, token, ok: true, response });
      } catch (err) {
        results.push({
          phone,
          token,
          ok: false,
          error: err?.message || "send_failed"
        });
      }
    }

    const sent = results.filter((x) => x.ok).length;
    const failed = results.length - sent;
    return res.status(200).json({
      ok: true,
      eventId: eventId || null,
      total: results.length,
      sent,
      failed,
      results
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "server_error"
    });
  }
});

// Optional GET endpoints (kept open for quick manual testing)
router.get("/inbound", (req, res) => res.status(200).send("ok"));
router.get("/dlr", (req, res) => res.status(200).send("ok"));

module.exports = router;
