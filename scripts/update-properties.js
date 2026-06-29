// Überschreibt die Objektliste (lokal oder in Redis, falls REDIS_URL gesetzt
// und via .env.local geladen ist) mit dem Inhalt von data/properties.json.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const fs = require("fs");
const path = require("path");
const { writeData } = require("../lib/store");

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, "..", "data", "properties.json"), "utf-8");
  const properties = JSON.parse(raw);
  await writeData("properties", properties);
  console.log(`Objektliste aktualisiert: ${properties.length} Hotels.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
