const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

// Auf Vercel ist das Dateisystem nicht dauerhaft beschreibbar, daher nutzt
// die App dort Redis (über die Vercel-Marketplace-Redis-Integration, die
// einen klassischen Connection-String in REDIS_URL bereitstellt). Lokal
// (keine REDIS_URL gesetzt) wird weiterhin einfach in data/*.json
// gelesen/geschrieben – praktisch für die Entwicklung, ohne dass man eine
// Redis-Instanz aufsetzen muss.
const REDIS_URL = process.env.REDIS_URL;
const USE_REDIS = !!REDIS_URL;

let clientPromise;
function getRedis() {
  if (!clientPromise) {
    const { createClient } = require("redis");
    const client = createClient({ url: REDIS_URL });
    client.on("error", (err) => console.error("Redis-Fehler:", err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

async function readData(name) {
  if (USE_REDIS) {
    const client = await getRedis();
    const raw = await client.get(name);
    return raw ? JSON.parse(raw) : [];
  }
  const raw = fs.readFileSync(filePath(name), "utf-8");
  return JSON.parse(raw || "[]");
}

async function writeData(name, data) {
  if (USE_REDIS) {
    const client = await getRedis();
    await client.set(name, JSON.stringify(data));
    return;
  }
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

module.exports = { readData, writeData, nextId };
