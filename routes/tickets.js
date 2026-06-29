const express = require("express");
const { readData, writeData, nextId } = require("../lib/store");
const { requireAuth, requireAdmin } = require("../lib/auth");

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
  res.json(tickets);
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

  const tickets = await readData("tickets");
  const ticket = {
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
  };
  tickets.push(ticket);
  await writeData("tickets", tickets);
  res.status(201).json(ticket);
}));

router.patch("/:id/status", requireAuth, wrap(async (req, res) => {
  const { status, completionNote } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status muss eine von: ${STATUSES.join(", ")}` });
  }
  const tickets = await readData("tickets");
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Auftrag nicht gefunden." });
  if (!canAccessProperty(req.user, ticket.propertyCode)) {
    return res.status(403).json({ error: "Kein Zugriff auf dieses Objekt." });
  }

  ticket.status = status;
  if (status === "in_arbeit" && !ticket.startedAt) {
    ticket.startedAt = new Date().toISOString();
  }
  if (status === "erledigt") {
    ticket.completedAt = new Date().toISOString();
    if (completionNote) ticket.completionNote = completionNote;
  }

  await writeData("tickets", tickets);
  res.json(ticket);
}));

router.patch("/:id", requireAuth, wrap(async (req, res) => {
  const tickets = await readData("tickets");
  const ticket = tickets.find((t) => t.id === Number(req.params.id));
  if (!ticket) return res.status(404).json({ error: "Auftrag nicht gefunden." });
  if (!canAccessProperty(req.user, ticket.propertyCode)) {
    return res.status(403).json({ error: "Kein Zugriff auf dieses Objekt." });
  }

  const { assignedTo, priority, description } = req.body;
  if (assignedTo !== undefined) ticket.assignedTo = assignedTo;
  if (priority && PRIORITIES.includes(priority)) ticket.priority = priority;
  if (description) ticket.description = description;

  await writeData("tickets", tickets);
  res.json(ticket);
}));

router.delete("/:id", requireAuth, requireAdmin, wrap(async (req, res) => {
  const tickets = await readData("tickets");
  const idx = tickets.findIndex((t) => t.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Auftrag nicht gefunden." });
  tickets.splice(idx, 1);
  await writeData("tickets", tickets);
  res.json({ ok: true });
}));

module.exports = router;
