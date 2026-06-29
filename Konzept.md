# Hausmeister-App – Konzept

Eigenständige App für die Haustechnik der mk | hotels, analog zur Housekeeping-App aufgebaut, aber als separates Projekt mit eigener Datenhaltung.

## Design
Gleiche Bildsprache wie Housekeeping-App, damit beide als "Familie" erkennbar sind: Petrol/Teal (`#36505d`) für Header/Akzente, Creme (`#f8f3e9`) als Hintergrund, Gold/Bernstein (`#c8882a`) als Highlight – hier z.B. für die Rolle "Hausmeister". Playfair Display für Überschriften, Lato für Fließtext. Mobile-first, max. 480px, zentriert.

## Struktur
Fixer Header: App-Name, eingeloggter User, Rollen-Badge (Admin/Hausmeister), Objekt-Auswahl (gleiche Property-Pills: STGR, SPHMK etc.).

Tabs nach Rolle:
- **Hausmeister:** Aufträge, Außer Betrieb
- **Admin:** Aufträge, Außer Betrieb, Statistik, Team, Benutzer

## Kernlogik: Aufträge (Tickets)
Tickets als Liste/Karten, farbcodiert nach Status:
- Offen (rot)
- In Arbeit (gelb/orange, mit Timer-Punkt wie bei laufender Reinigung)
- Erledigt (grün)

Jedes Ticket enthält:
- Objekt + Zimmer/Bereich (z.B. "STGR – Zimmer 204" oder "SPHMK – Lobby")
- Kategorie: Sanitär, Elektrik, Möbel/Einrichtung, Heizung/Klima, Sonstiges
- Beschreibung (Freitext)
- Optional: Foto
- Priorität: normal / dringend
- Gemeldet von (Name + Rolle) – Housekeeper, Admin, oder Hausmeister selbst
- Zugewiesen an (falls mehrere Hausmeister im Team)
- Zeitstempel: erstellt, gestartet, abgeschlossen → Bearbeitungsdauer (analog `completions.json` im Housekeeping-System)

Hausmeister kann Tickets sowohl **abarbeiten** (Status ändern, Notiz/Foto bei Erledigung) als auch **selbst anlegen** (z.B. bei eigenen Kontrollgängen).

## Außer-Betrieb-Verwaltung
Keine Verknüpfung zu Apaleo – die Hausmeister-App darf Zimmer nicht selbst sperren oder den Apaleo-Status verändern. Stattdessen rein interne Markierung: "technisches Problem gemeldet" als eigener Status innerhalb der Hausmeister-App, unabhängig vom Apaleo-Zimmerstatus.

Erfassung: Zimmer auswählen, Grund (Freitext oder Kategorie wie "Wasserschaden", "Renovierung"), optional voraussichtliches Ende. Aufhebung durch Hausmeister/Admin, sobald behoben. Wenn das Housekeeping-Team informiert werden soll, dass ein Zimmer tatsächlich blockiert werden muss, geschieht das weiterhin manuell über die bestehenden Abläufe (z.B. Admin setzt es in Apaleo) – nicht automatisiert aus dieser App heraus.

## Datenhaltung
Eigenes, von der Housekeeping-App unabhängiges Set, komplett ohne Apaleo-Zugriff:
- `users.json` – eigene Benutzerliste (Username/Passwort, Rolle, Objektzugriff)
- `tickets.json` – alle Wartungsaufträge mit Verlauf
- `outoforder.json` – interne "technisches Problem"-Markierungen pro Zimmer (rein informativ, kein Apaleo-Schreibzugriff)
- `api/users.js`, `api/tickets.js`, `api/outoforder.js` – eigene Endpunkte

Objekt- und Zimmerlisten (STGR, SPHMK etc. + Zimmernummern) werden als statische Konfiguration gepflegt, nicht live aus Apaleo gezogen – damit die App komplett unabhängig läuft.

## Auth
Gleiches einfaches Muster wie Housekeeping-App: Login gegen lokale `USERS`-Liste, keine OAuth-Kopplung. Rolle und Objektzugriff pro User hinterlegt.

## Offene Punkte für später
- Statistik-Tab: z.B. durchschnittliche Bearbeitungsdauer pro Kategorie, offene Tickets pro Objekt
- Team-Tab: Hausmeister-Verwaltung, evtl. Zuweisungslogik bei mehreren Technikern
- Push-Benachrichtigung bei "dringend"-Tickets (später, optional)
