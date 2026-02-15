const express = require("express");
const crypto = require("crypto");

module.exports = function makeInvitesRouter(pool) {
  const router = express.Router();

  function inviteToken() {
    return crypto.randomBytes(24).toString("base64url");
  }

  function hoursFromNow(h) {
    return new Date(Date.now() + h * 3600 * 1000);
  }

  // Normalize DB snake_case -> API camelCase (frontend-friendly)
  function normalizeInvite(row) {
    if (!row) return row;
    return {
      token: row.token,
      eventId: row.event_id,
      inviterEmail: row.inviter_email,
      invitedEmail: row.invited_email,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      openedAt: row.opened_at,
      respondedAt: row.responded_at,
      response: row.response
    };
  }

  // GET /invites/health (PUBLIC)
  router.get("/health", (_req, res) => res.json({ ok: true }));

  // POST /invites/create (PROTECTED by global requireApiKey middleware)
  // body: { eventId, inviterEmail, invitedEmail?, expiresHours? }
  router.post("/create", async (req, res) => {
    try {
      const { eventId, inviterEmail, invitedEmail, expiresHours } = req.body || {};
      if (!eventId) return res.status(400).json({ ok: false, error: "missing_eventId" });
      if (!inviterEmail) return res.status(400).json({ ok: false, error: "missing_inviterEmail" });

      const token = inviteToken();
      const exp = hoursFromNow(Number(expiresHours || 72));

      await pool.query(
        `INSERT INTO invites(token,event_id,inviter_email,invited_email,expires_at)
         VALUES($1,$2,$3,$4,$5)`,
        [token, String(eventId), String(inviterEmail), invitedEmail ? String(invitedEmail) : null, exp]
      );

      const rsvpUrl = `https://thefamilyweather.com/demo2/events/rsvp.html?token=${token}`;
      res.json({ ok: true, token, eventId: String(eventId), expiresAt: exp.toISOString(), rsvpUrl });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // GET /invites/resolve?token=... (PUBLIC)
  router.get("/resolve", async (req, res) => {
    try {
      const token = String(req.query.token || "").trim();
      if (!token) return res.status(400).json({ ok: false, error: "missing_token" });

      const r = await pool.query(
        `SELECT token,event_id,inviter_email,invited_email,created_at,expires_at,opened_at,responded_at,response
         FROM invites WHERE token=$1`,
        [token]
      );

      if (r.rowCount === 0) return res.status(404).json({ ok: false, error: "token_not_found" });

      const row = r.rows[0];
      if (new Date(row.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ ok: false, error: "token_expired", expiresAt: row.expires_at });
      }

      await pool.query(`UPDATE invites SET opened_at = COALESCE(opened_at, now()) WHERE token=$1`, [token]);

      res.json({ ok: true, invite: normalizeInvite(row) });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // POST /invites/respond (PUBLIC)
  // body: { token, response: "yes"|"maybe"|"no", responderEmail? }
  router.post("/respond", async (req, res) => {
    try {
      const { token, response, responderEmail } = req.body || {};
      const t = String(token || "").trim();
      const resp = String(response || "").toLowerCase().trim();

      if (!t) return res.status(400).json({ ok: false, error: "missing_token" });
      if (!["yes", "maybe", "no"].includes(resp)) {
        return res.status(400).json({ ok: false, error: "bad_response" });
      }

      const r = await pool.query(`SELECT token,expires_at FROM invites WHERE token=$1`, [t]);
      if (r.rowCount === 0) return res.status(404).json({ ok: false, error: "token_not_found" });
      if (new Date(r.rows[0].expires_at).getTime() < Date.now()) {
        return res.status(410).json({ ok: false, error: "token_expired", expiresAt: r.rows[0].expires_at });
      }

      await pool.query(
        `UPDATE invites
           SET responded_at=now(),
               response=$2,
               invited_email=COALESCE(invited_email,$3)
         WHERE token=$1`,
        [t, resp, responderEmail ? String(responderEmail) : null]
      );

      res.json({ ok: true, token: t, response: resp });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // POST /invites/send-sms (SAFE STUB)
  // body: { eventId, eventTitle, message, invites: [{ phone, token, link }] }
  router.post("/send-sms", async (req, res) => {
    try {
      const { eventId, eventTitle, message, invites } = req.body || {};

      if (!Array.isArray(invites) || invites.length === 0) {
        return res.status(400).json({ ok: false, error: "invites_required" });
      }

      const results = [];

      for (const inv of invites) {
        const phone = String(inv?.phone || "").trim();
        const token = String(inv?.token || "").trim();
        const link = String(inv?.link || "").trim();

        if (!phone || !link) {
          results.push({ phone, token, ok: false, error: "invalid_invite_row" });
          continue;
        }

        const text =
          String(message || "").trim() ||
          `You're invited to ${eventTitle || "an event"} on Family Weather. RSVP: ${link}`;

        results.push({
          phone,
          token,
          ok: false,
          error: "sender_not_wired",
          preview: text
        });
      }

      const sent = results.filter((r) => r.ok).length;

      return res.status(200).json({
        ok: true,
        eventId: eventId || null,
        total: results.length,
        sent,
        failed: results.length - sent,
        results
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err?.message || "server_error" });
    }
  });

  return router;
};