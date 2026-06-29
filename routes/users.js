const express = require("express");
const bcrypt = require("bcryptjs");
const { readData, mutateData, nextId } = require("../lib/store");
const { requireAuth, requireAdmin } = require("../lib/auth");
const { HttpError } = require("../lib/errors");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const ROLES = ["admin", "hausmeister", "frontoffice"];

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

router.get("/", requireAuth, requireAdmin, wrap(async (req, res) => {
  const users = await readData("users");
  res.json(users.map(publicUser));
}));

// Minimaler, nicht-admin-Endpoint: liefert nur id+name der Hausmeister, die
// einem Objekt zugeordnet sind – für das Zuweisen-Dropdown bei Aufträgen.
// Bewusst kein voller Benutzerdatensatz, damit Nicht-Admins nicht die
// komplette Benutzerliste (inkl. Rollen, Objekte) sehen.
router.get("/assignable", requireAuth, wrap(async (req, res) => {
  const users = await readData("users");
  const property = req.query.property;
  let candidates = users.filter((u) => u.role === "hausmeister");
  if (property) {
    candidates = candidates.filter((u) => u.properties.includes(property));
  }
  res.json(candidates.map((u) => ({ id: u.id, name: u.name })));
}));

router.post("/", requireAuth, requireAdmin, wrap(async (req, res) => {
  const { username, password, name, role, properties } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: "username, password, name und role sind erforderlich." });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: "role muss admin, hausmeister oder frontoffice sein." });
  }

  // Prüfung auf doppelten Benutzernamen + Anlegen müssen atomar in einer
  // mutateData()-Transaktion passieren, sonst können zwei fast gleichzeitige
  // Anfragen sich gegenseitig überschreiben (siehe Kommentar in lib/store.js).
  const user = await mutateData("users", (users) => {
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw new HttpError(409, "Benutzername bereits vergeben.");
    }
    const newUser = {
      id: nextId(users),
      username,
      passwordHash: bcrypt.hashSync(password, 10),
      name,
      role,
      properties: properties || [],
    };
    users.push(newUser);
    return newUser;
  });

  res.status(201).json(publicUser(user));
}));

router.put("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  const { name, role, properties, password } = req.body;
  if (role && !ROLES.includes(role)) {
    return res.status(400).json({ error: "role muss admin, hausmeister oder frontoffice sein." });
  }
  const passwordHash = password ? bcrypt.hashSync(password, 10) : null;

  const user = await mutateData("users", (users) => {
    const u = users.find((u) => u.id === Number(req.params.id));
    if (!u) throw new HttpError(404, "Benutzer nicht gefunden.");
    if (name) u.name = name;
    if (role) u.role = role;
    if (properties) u.properties = properties;
    if (passwordHash) u.passwordHash = passwordHash;
    return u;
  });

  res.json(publicUser(user));
}));

router.delete("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  await mutateData("users", (users) => {
    const idx = users.findIndex((u) => u.id === Number(req.params.id));
    if (idx === -1) throw new HttpError(404, "Benutzer nicht gefunden.");
    if (users[idx].id === req.user.userId) {
      throw new HttpError(400, "Du kannst dich nicht selbst löschen.");
    }
    users.splice(idx, 1);
  });
  res.json({ ok: true });
}));

module.exports = router;
