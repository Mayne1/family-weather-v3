const express = require("express"); const { Client } = require("pg"); const router = express.Router(); router.get("/locations", async (req, res) => { const client = new 
  Client({
    connectionString: process.env.DATABASE_URL,
  });
  try { await client.connect(); const result = await client.query(` SELECT id, label, city, state, zip, latitude, longitude, is_active FROM locations WHERE 
      COALESCE(is_active, true) = true ORDER BY id ASC
    `); return res.json({ ok: true, locations: result.rows,
    });
  } catch (err) {
    console.error("[locations] fetch failed:", err.message); return res.status(500).json({ ok: false, error: "locations_fetch_failed",
    });
  } finally {
    await client.end().catch(() => {});
  }
});
module.exports = router;
