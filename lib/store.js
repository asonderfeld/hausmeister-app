const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");

// Auf Vercel ist das Dateisystem nicht dauerhaft beschreibbar, daher nutzt
// die App dort Upstash Redis (über die Vercel-Marketplace-Redis-Integration,
// vormals "Vercel KV"). Lokal (keine Redis-Env-Variablen gesetzt) wird
// weiterhin einfach in data/*.json gelesen/geschrieben – praktisch für die
// Entwicklung, ohne dass man eine Redis-Instanz aufsetzen muss.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_REDIS = !!(REDIS_URL && REDIS_TOKEN);

let redisClient;
function getRedis() {
  if (!redisClient) {
    const { Redis } = require("@upstash/redis");
    redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
  return redisClient;
}

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

async function readData(name) {
  if (USE_REDIS) {
    const data = await getRedis().get(name);
    return data || [];
  }
  const raw = fs.readFileSync(filePath(name), "utf-8");
  return JSON.parse(raw || "[]");
}

async function writeData(name, data) {
  if (USE_REDIS) {
    await getRedis().set(name, data);
    return;
  }
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

module.exports = { readData, writeData, nextId };
