const express = require("express");
const { readData, writeData, nextId } = require("../lib/store");
const { requireAuth, requireAdmin } = require("../lib/auth");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Rein interne Markierung "technisches Problem gemeldet" – wirkt sich NICHT
// auf Apaleo aus und sperrt kein Zimmer. Dient nur der Übersicht innerhalb
// dieser App. Eine tatsächliche Zimmersperrung läuft weiterhin über die
// bestehenden, separaten Abläufe.
function canAccessProperty(user, propertyCode) {
  return user.role === "admin" || user.properties.includes(propertyCode);
}

router.get("/", requireAuth, wrap(async (req, res) => {
  let entries = await readData("outoforder");
  if (req.user.role !== "admin") {
    entries = entries.filter((e) => req.user.properties.includes(e.propertyCode));
  }
  if (req.query.property) {
    entries = entries.filter((e) => e.propertyCode === req.query.property);
  }
  if (req.query.active === "true") {
    entries = entries.filter((e) => !e.resolvedAt);
  }
  entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(entries);
}));

router.post("/", requireAuth, wrap(async (req, res) => {
  const { propertyCode, room, reason, expectedEnd } = req.body;
  if (!propertyCode || !room || !reason) {
    return res.status(400).json({ error: "propertyCode, room und reason sind erforderlich." });
  }
  if (!canAccessProperty(req.user, propertyCode)) {
    return res.status(403).json({ error: "Kein Zugriff auf dieses Objekt." });
  }
  const entries = await readData("outoforder");
  const entry = {
    id: nextId(entries),
    propertyCode,
    room,
    reason,
    expectedEnd: expectedEnd || null,
    createdBy: { userId: req.user.userId, name: req.user.name },
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  entries.push(entry);
  await writeData("outoforder", entries);
  res.status(201).json(entry);
}));

router.patch("/:id/resolve", requireAuth, wrap(async (req, res) => {
  const entries = await readData("outoforder");
  const entry = entries.find((e) => e.id === Number(req.params.id));
  if (!entry) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  if (!canAccessProperty(req.user, entry.propertyCode)) {
    return res.status(403).json({ error: "Kein Zugriff auf dieses Objekt." });
  }
  entry.resolvedAt = new Date().toISOString();
  await writeData("outoforder", entries);
  res.json(entry);
}));

router.delete("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  const entries = await readData("outoforder");
  const idx = entries.findIndex((e) => e.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Eintrag nicht gefunden." });
  entries.splice(idx, 1);
  await writeData("outoforder", entries);
  res.json({ ok: true });
}));

module.exports = router;
