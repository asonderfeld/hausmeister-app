const express = require("express");
const bcrypt = require("bcryptjs");
const { readData } = require("../lib/store");
const { createSession, requireAuth } = require("../lib/auth");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.post("/login", wrap(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Benutzername und Passwort erforderlich." });
  }
  const users = await readData("users");
  const user = users.find((u) => u.username.toLowerCase() === String(username).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: "Benutzername oder Passwort falsch." });
  }
  const token = createSession(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      properties: user.properties,
    },
  });
}));

router.post("/logout", requireAuth, (req, res) => {
  // Stateless JWT – Logout erfolgt clientseitig durch Löschen des Tokens.
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
