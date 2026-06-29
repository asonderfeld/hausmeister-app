const express = require("express");
const { readData } = require("../lib/store");
const { requireAuth } = require("../lib/auth");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Objektliste ist statische Konfiguration (data/properties.json), bewusst
// ohne Apaleo-Anbindung. Zum Hinzufügen/Ändern von Objekten einfach die
// Datei bearbeiten (lokal) bzw. den entsprechenden KV-Eintrag aktualisieren
// (Produktion).
router.get("/", requireAuth, wrap(async (req, res) => {
  const all = await readData("properties");
  const allowed = req.user.role === "admin"
    ? all
    : all.filter((p) => req.user.properties.includes(p.code));
  res.json(allowed);
}));

module.exports = router;
