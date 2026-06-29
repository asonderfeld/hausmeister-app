# mk Technik – Hausmeister-App

Eigenständige App für Wartungstickets und interne Außer-Betrieb-Meldungen. Keine Apaleo-Anbindung.

## Lokal starten

```
npm install
npm run seed     # legt einmalig admin/admin123 und hausmeister/hausmeister123 an
npm start
```

Dann im Browser: http://localhost:3000

Bitte die Standard-Passwörter nach dem ersten Login über den Tab "Benutzer" ändern.

Lokal werden die Daten einfach in `data/*.json` gespeichert – kein Setup nötig.

## Deployment auf Vercel

Auf Vercel ist das Dateisystem nicht dauerhaft beschreibbar. Die App nutzt
dort stattdessen Redis (über eine Vercel-Marketplace-Integration) für
`users`, `tickets`, `outoforder`, `properties`.

1. Repo auf [vercel.com](https://vercel.com) importieren (siehe Schritte unten für GitHub).
2. Im Vercel-Projekt unter **Storage** eine **Redis**-Datenbank hinzufügen (Marketplace → Redis) und mit dem Projekt verbinden. Vercel setzt dadurch automatisch die Env-Variable `REDIS_URL` (Connection-String).
3. Unter **Settings → Environment Variables** zusätzlich `JWT_SECRET` setzen (langer, zufälliger String – z.B. `openssl rand -hex 32`).
4. Deployen.
5. Einmalig Benutzer/Objekte anlegen: lokal `vercel link` (Projekt verknüpfen) und `vercel env pull .env.local --environment=production` ausführen, damit `REDIS_URL` lokal verfügbar ist, dann `npm run seed` – das Skript schreibt dann direkt in die produktive Redis-Instanz statt in die lokalen JSON-Dateien.

## GitHub-Repo erstellen & pushen

Das Git-Repo ist im Projektordner schon angelegt (ein Commit, Branch `master`).

Auf [github.com/new](https://github.com/new) ein **leeres** Repo anlegen (ohne README/.gitignore – die gibt es hier schon). Danach im Projektordner (Terminal auf deinem Mac, nicht hier im Chat):

```
cd "Hausm,eitser APP"
git branch -M main
git remote add origin <URL deines neuen Repos>
git push -u origin main
```

## Objekte konfigurieren

Die Liste der Objekte (z.B. STGR, SPHMK) steht in `data/properties.json` (lokal) bzw. unter dem Redis-Key `properties` (Produktion) und wird manuell gepflegt – es gibt keine Live-Anbindung an Apaleo.

## Datenhaltung

Lokal: JSON-Dateien in `data/`. Produktion (Vercel): Redis, ein Key pro Datensatztyp (`users`, `tickets`, `outoforder`, `properties`). Kein externer Login-Provider, Auth läuft über JWT.
