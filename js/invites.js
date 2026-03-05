const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const DB_PATH = "/home/mayne/apps/family-weather-api/data/invites.sqlite";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS invites (
      token TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      inviter TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      opened_at TEXT,
      accepted_at TEXT,
      accepted_label TEXT
    );
  `);
  db.run(`CREATE INDEX IF NOT EXISTS invites_event_idx ON invites(event_id);`);
});

function nowISO(){ return new Date().toISOString(); }
function inHours(h){ return new Date(Date.now() + h*3600*1000).toISOString(); }
function token(){ return crypto.randomBytes(24).toString("base64url"); }

router.get("/health", (_req, res) => res.json({ ok:true }));

// POST /invites/create  body: { eventId, inviterLabel, expiresHours? }
router.post("/create", (req, res) => {
  const { eventId, inviterLabel, expiresHours } = req.body || {};
  if(!eventId) return res.status(400).json({ ok:false, error:"missing_eventId" });

  const t = token();
  const created = nowISO();
  const expires = inHours(Number(expiresHours || 72));

  db.run(
    `INSERT INTO invites(token,event_id,inviter,created_at,expires_at) VALUES(?,?,?,?,?)`,
    [t, String(eventId), String(inviterLabel || "unknown"), created, expires],
    (err) => {
      if(err) return res.status(500).json({ ok:false, error: err.message });
      res.json({ ok:true, token: t, eventId: String(eventId), expiresAt: expires });
    }
  );
});

// GET /invites/resolve?token=...
router.get("/resolve", (req, res) => {
  const t = String(req.query.token || "").trim();
  if(!t) return res.status(400).json({ ok:false, error:"missing_token" });

  db.get(
    `SELECT token,event_id,inviter,created_at,expires_at FROM invites WHERE token=?`,
    [t],
    (err, row) => {
      if(err) return res.status(500).json({ ok:false, error: err.message });
      if(!row) return res.status(404).json({ ok:false, error:"token_not_found" });
      if(new Date(row.expires_at).getTime() < Date.now()){
        return res.status(410).json({ ok:false, error:"token_expired", expiresAt: row.expires_at });
      }
      // stamp opened_at (best-effort)
      db.run(`UPDATE invites SET opened_at = COALESCE(opened_at, ?) WHERE token=?`, [nowISO(), t], () => {});
      res.json({
        ok:true,
        token: row.token,
        eventId: row.event_id,
        inviter: row.inviter,
        createdAt: row.created_at,
        expiresAt: row.expires_at
      });
    }
  );
});

module.exports = router;
