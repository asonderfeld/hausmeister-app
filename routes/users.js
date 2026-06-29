const express = require("express");
const bcrypt = require("bcryptjs");
const { readData, writeData, nextId } = require("../lib/store");
const { requireAuth, requireAdmin } = require("../lib/auth");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

router.get("/", requireAuth, requireAdmin, wrap(async (req, res) => {
  const users = await readData("users");
  res.json(users.map(publicUser));
}));

router.post("/", requireAuth, requireAdmin, wrap(async (req, res) => {
  const { username, password, name, role, properties } = req.body;
  if (!username || !password || !name || !role) {
    return res.status(400).json({ error: "username, password, name und role sind erforderlich." });
  }
  if (!["admin", "hausmeister", "frontoffice"].includes(role)) {
    return res.status(400).json({ error: "role muss admin, hausmeister oder frontoffice sein." });
  }
  const users = await readData("users");
  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: "Benutzername bereits vergeben." });
  }
  const user = {
    id: nextId(users),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    name,
    role,
    properties: properties || [],
  };
  users.push(user);
  await writeData("users", users);
  res.status(201).json(publicUser(user));
}));

router.put("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  const users = await readData("users");
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Benutzer nicht gefunden." });

  const { name, role, properties, password } = req.body;
  if (name) user.name = name;
  if (role) {
    if (!["admin", "hausmeister", "frontoffice"].includes(role)) {
      return res.status(400).json({ error: "role muss admin, hausmeister oder frontoffice sein." });
    }
    user.role = role;
  }
  if (properties) user.properties = properties;
  if (password) user.passwordHash = bcrypt.hashSync(password, 10);

  await writeData("users", users);
  res.json(publicUser(user));
}));

router.delete("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  const users = await readData("users");
  const idx = users.findIndex((u) => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Benutzer nicht gefunden." });
  if (users[idx].id === req.user.userId) {
    return res.status(400).json({ error: "Du kannst dich nicht selbst löschen." });
  }
  users.splice(idx, 1);
  await writeData("users", users);
  res.json({ ok: true });
}));

module.exports = router;
