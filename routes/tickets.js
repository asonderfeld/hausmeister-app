const express = require("express");
const { readData, mutateData, nextId } = require("../lib/store");
const { requireAuth, requireAdmin } = require("../lib/auth");
const { HttpError } = require("../lib/errors");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const CATEGORIES = ["sanitaer", "elektrik", "moebel", "heizung_klima", "sonstiges"];
const PRIORITIES = ["normal", "dringend"];
const STATUSES = ["offen", "in_arbeit", "erledigt"];

function canAccessProperty(user, propertyCode) {
  return user.role === "admin" || user.properties.includes(propertyCode);
}

router.get("/", requireAuth, wrap(async (req, res) => {
  let tickets = await readData("tickets");
  if (req.user.role !== "admin") {
    tickets = tickets.filter((t) => req.user.properties.includes(t.propertyCode));
  }
  if (req.query.property) {
    tickets = tickets.filter((t) => t.propertyCode === req.query.property);
  }
  if (req.query.status) {
    tickets = tickets.filter((t) => t.status === req.query.status);
  }
  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Fotos werden in der Listenansicht NICHT mitgeschickt (nur in der
  // Detailansicht über GET /tickets/:id gebraucht). Sonst wird jede
  // Listenabfrage mit jedem zusätzlichen Foto-Auftrag langsamer, weil alle
  // Base64-Bilder jedes Mal mit übertragen würden. Gleiches gilt für Fotos
  // in den Zwischen-Notizen (notes).
  const withoutPhotos = tickets.map(({ photo, notes, ...rest }) => ({
    ...rest,
    hasPhoto: !!photo,
    notesCount: (notes || []).length,
  }));
  res.json(withoutPhotos);
}));

router.get("/:id", requireAuth, wrap(async (req, res) => {
  const tickets = await readData("tickets");
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) throw new HttpError(404, "Auftrag nicht gefunden.");
  if (!canAccessProperty(req.user, ticket.propertyCode)) {
    throw new HttpError(403, "Kein Zugriff auf dieses Objekt.");
  }
  res.json(ticket);
}));

router.post("/", requireAuth, wrap(async (req, res) => {
  const { propertyCode, room, category, description, priority, photo } = req.body;
  if (!propertyCode || !room || !category || !description) {
    return res.status(400).json({ error: "propertyCode, room, category und description sind erforderlich." });
  }
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category muss eine von: ${CATEGORIES.join(", ")}` });
  }
  const prio = priority && PRIORITIES.includes(priority) ? priority : "normal";
  if (!canAccessProperty(req.user, propertyCode)) {
    return res.status(403).json({ error: "Kein Zugriff auf dieses Objekt." });
  }

  const ticket = await mutateData("tickets", (tickets) => {
    const newTicket = {
      id: nextId(tickets),
      propertyCode,
      room,
      category,
      description,
      priority: prio,
      photo: photo || null,
      status: "offen",
      reportedBy: { userId: req.user.userId, name: req.user.name, role: req.user.role },
      assignedTo: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      completionNote: null,
      notes: [],
    };
    tickets.push(newTicket);
    return newTicket;
  });

  res.status(201).json(ticket);
}));

// Zwischenstand während der Bearbeitung: Foto und/oder Kommentar nachtragen,
// ohne den Auftrag abzuschließen. Nur möglich, während der Auftrag "in
// Arbeit" ist.
router.post("/:id/notes", requireAuth, wrap(async (req, res) => {
  const { text, photo } = req.body;
  if (!text && !photo) {
    return res.status(400).json({ error: "text oder photo ist erforderlich." });
  }

  const ticket = await mutateData("tickets", (tickets) => {
    const t = tickets.find((t) => t.id === Number(req.params.id));
    if (!t) throw new HttpError(404, "Auftrag nicht gefunden.");
    if (!canAccessProperty(req.user, t.propertyCode)) {
      throw new HttpError(403, "Kein Zugriff auf dieses Objekt.");
    }
    if (t.status !== "in_arbeit") {
      throw new HttpError(400, "Foto/Kommentar können nur hinzugefügt werden, während der Auftrag in Arbeit ist.");
    }
    if (!t.notes) t.notes = [];
    const note = {
      id: t.notes.length + 1,
      text: text || null,
      photo: photo || null,
      by: { userId: req.user.userId, name: req.user.name },
      createdAt: new Date().toISOString(),
    };
    t.notes.push(note);
    return t;
  });

  res.status(201).json(ticket);
}));

router.patch("/:id/status", requireAuth, wrap(async (req, res) => {
  const { status, completionNote } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status muss eine von: ${STATUSES.join(", ")}` });
  }

  const ticket = await mutateData("tickets", (tickets) => {
    const t = tickets.find((t) => t.id === Number(req.params.id));
    if (!t) throw new HttpError(404, "Auftrag nicht gefunden.");
    if (!canAccessProperty(req.user, t.propertyCode)) {
      throw new HttpError(403, "Kein Zugriff auf dieses Objekt.");
    }

    t.status = status;
    if (status === "in_arbeit" && !t.startedAt) {
      t.startedAt = new Date().toISOString();
    }
    if (status === "erledigt") {
      t.completedAt = new Date().toISOString();
      if (completionNote) t.completionNote = completionNote;
    }
    return t;
  });

  res.json(ticket);
}));

router.patch("/:id", requireAuth, wrap(async (req, res) => {
  const { assignedTo, priority, description } = req.body;

  const ticket = await mutateData("tickets", (tickets) => {
    const t = tickets.find((t) => t.id === Number(req.params.id));
    if (!t) throw new HttpError(404, "Auftrag nicht gefunden.");
    if (!canAccessProperty(req.user, t.propertyCode)) {
      throw new HttpError(403, "Kein Zugriff auf dieses Objekt.");
    }

    if (assignedTo !== undefined) t.assignedTo = assignedTo;
    if (priority && PRIORITIES.includes(priority)) t.priority = priority;
    if (description) t.description = description;
    return t;
  });

  res.json(ticket);
}));

router.delete("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  await mutateData("tickets", (tickets) => {
    const idx = tickets.findIndex((t) => t.id === Number(req.params.id));
    if (idx === -1) throw new HttpError(404, "Auftrag nicht gefunden.");
    tickets.splice(idx, 1);
  });
  res.json({ ok: true });
}));

module.exports = router;
