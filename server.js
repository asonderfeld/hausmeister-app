const express = require("express");
const path = require("path");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const propertyRoutes = require("./routes/properties");
const ticketRoutes = require("./routes/tickets");
const outOfOrderRoutes = require("./routes/outoforder");

const app = express();
app.use(express.json({ limit: "5mb" })); // limit erhöht wegen Foto-Uploads (base64)

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/outoforder", outOfOrderRoutes);

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => res.json({ ok: true }));

// zentrale Fehlerbehandlung für async Routen
app.use((err, req, res, next) => {
  console.error(err);
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  res.status(500).json({ error: "Serverfehler." });
});

// Nur lokal einen echten Server starten – auf Vercel übernimmt
// api/index.js die exportierte App als serverlose Funktion.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Hausmeister-App läuft auf http://localhost:${PORT}`);
  });
}

module.exports = app;
