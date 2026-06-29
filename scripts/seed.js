// Legt zwei Standardbenutzer an, falls noch keine Benutzer existieren.
// Passwörter unbedingt nach dem ersten Login ändern!
// Lokal: schreibt nach data/users.json. Auf Vercel (KV_REST_API_URL gesetzt):
// schreibt in Vercel KV – dafür "vercel env pull" + lokales Ausführen, oder
// einmalig über eine eigene admin-Route, falls gewünscht.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { readData, writeData } = require("../lib/store");

async function main() {
  // Objektliste (data/properties.json) in den jeweiligen Speicher übernehmen,
  // falls dort noch keine Einträge stehen (relevant vor allem für Vercel KV).
  const existingProperties = await readData("properties");
  if (existingProperties.length === 0) {
    const raw = fs.readFileSync(path.join(__dirname, "..", "data", "properties.json"), "utf-8");
    await writeData("properties", JSON.parse(raw));
    console.log("Objektliste aus data/properties.json übernommen.");
  }

  const users = await readData("users");

  if (users.length > 0) {
    console.log("Es existieren bereits Benutzer – Seed wird übersprungen.");
    return;
  }

  const defaults = [
    {
      username: "admin",
      password: "admin123",
      name: "Admin",
      role: "admin",
      properties: ["STGR", "SPHMK"],
    },
    {
      username: "hausmeister",
      password: "hausmeister123",
      name: "Hausmeister",
      role: "hausmeister",
      properties: ["STGR", "SPHMK"],
    },
  ];

  const seeded = defaults.map((u, i) => ({
    id: i + 1,
    username: u.username,
    passwordHash: bcrypt.hashSync(u.password, 10),
    name: u.name,
    role: u.role,
    properties: u.properties,
  }));

  await writeData("users", seeded);
  console.log("Standardbenutzer angelegt:");
  defaults.forEach((u) => console.log(`  ${u.username} / ${u.password} (${u.role})`));
  console.log("Bitte Passwörter nach dem ersten Login ändern.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
