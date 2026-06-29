const jwt = require("jsonwebtoken");

// Stateless JWT statt In-Memory-Sessions: Vercel-Funktionen laufen auf
// mehreren/wechselnden Instanzen, ein serverseitiger Sessionspeicher würde
// dort nicht zuverlässig funktionieren. Logout heißt hier: Client löscht
// das Token; es gibt keine serverseitige Sperrliste.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-bitte-in-vercel-env-setzen";
const EXPIRES_IN = "30d";

function createSession(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      properties: user.properties,
    },
    JWT_SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

function requireAuth(req, res, next) {
  const token = req.headers["authorization"]?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Nicht eingeloggt." });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Sitzung abgelaufen oder ungültig." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Nur für Admins." });
  }
  next();
}

module.exports = { createSession, requireAuth, requireAdmin };
