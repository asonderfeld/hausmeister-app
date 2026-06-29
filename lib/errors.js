// Einfache HTTP-Fehlerklasse, damit mutateData()-Callbacks (siehe lib/store.js)
// kontrollierte Fehler mit Statuscode werfen können (z.B. 404, 409), statt
// res.status(...) direkt aufzurufen – das geht innerhalb der atomaren
// Schreib-Transaktion nicht, da dort kein res-Objekt vorhanden ist.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = { HttpError };
