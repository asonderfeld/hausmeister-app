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
    client.on("error", (err) => {
      console.error("Redis-Fehler:", err);
      // Bei einem Verbindungsfehler die zwischengespeicherte Verbindung
      // verwerfen, damit der nächste Aufruf eine neue Verbindung aufbaut,
      // statt dauerhaft mit einer toten Verbindung weiterzuarbeiten.
      clientPromise = null;
    });
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

// ---------- Atomare Lese-Änder-Schreib-Operation ----------
//
// readData()+writeData() nacheinander aufzurufen ist NICHT sicher, wenn zwei
// Anfragen (z.B. zwei Benutzer werden kurz nacheinander angelegt) gleichzeitig
// laufen: beide lesen denselben alten Stand, ändern ihn lokal, und die zweite
// writeData()-Aufruf überschreibt dann die Änderung der ersten ("lost update").
// Genau das konnte dazu führen, dass ein gerade angelegter Benutzer in der
// Liste kurz sichtbar war, aber beim Login nicht mehr gefunden wurde, weil
// sein Eintrag durch eine andere, fast gleichzeitige Schreibaktion wieder
// verloren ging.
//
// mutateData() behebt das: Bei Redis per WATCH/MULTI/EXEC (über
// executeIsolated, damit gleichzeitige Anfragen sich nicht die gemeinsame
// Verbindung "stehlen") inkl. Retry bei Konflikt. Lokal (Datei-Modus) per
// einfachem In-Process-Lock, da dort ohnehin nur ein Prozess läuft.
//
// mutateFn(data) bekommt das aktuelle Array, darf es in-place verändern
// (push/splice/Feld setzen) und gibt den Wert zurück, der an den Aufrufer
// von mutateData() zurückgegeben wird (z.B. das neu angelegte Objekt).
// Wirft mutateFn einen Fehler (z.B. HttpError aus lib/errors.js), wird NICHT
// geschrieben und der Fehler nach außen weitergereicht.
async function mutateData(name, mutateFn) {
  if (USE_REDIS) {
    const client = await getRedis();
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const outcome = await client.executeIsolated(async (isolatedClient) => {
        await isolatedClient.watch(name);
        const raw = await isolatedClient.get(name);
        const data = raw ? JSON.parse(raw) : [];

        let result;
        try {
          result = await mutateFn(data);
        } catch (err) {
          await isolatedClient.unwatch();
          throw err;
        }

        const multi = isolatedClient.multi();
        multi.set(name, JSON.stringify(data));
        const execResult = await multi.exec();
        return { committed: execResult !== null, result };
      });
      if (outcome.committed) return outcome.result;
      // Schlüssel wurde zwischen WATCH und EXEC von einer anderen Anfrage
      // verändert -> kurz retry mit frischem Stand.
    }
    throw new Error(`Konflikt beim Schreiben von "${name}" – bitte erneut versuchen.`);
  }
  return fileLock(name, async () => {
    const raw = fs.readFileSync(filePath(name), "utf-8");
    const data = JSON.parse(raw || "[]");
    const result = await mutateFn(data);
    fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2));
    return result;
  });
}

// Einfacher Lock pro Datenname, damit im lokalen Datei-Modus zwei
// "gleichzeitige" Requests (z.B. zwei parallele async-Handler im selben
// Node-Prozess) sich nicht gegenseitig überschreiben.
const fileLocks = {};
function fileLock(name, fn) {
  const previous = fileLocks[name] || Promise.resolve();
  const run = previous.then(fn, fn);
  fileLocks[name] = run.then(() => {}, () => {});
  return run;
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

module.exports = { readData, writeData, mutateData, nextId };
