// ---------- State ----------
let state = {
  token: localStorage.getItem("token") || null,
  user: null,
  properties: [],
  selectedProperty: null,
  tab: "tickets",
  ticketFilter: null, // status filter
};

const CATEGORY_LABELS = {
  sanitaer: "Sanitär",
  elektrik: "Elektrik",
  moebel: "Möbel",
  heizung_klima: "Heizung/Klima",
  sonstiges: "Sonstiges",
};
const STATUS_LABELS = { offen: "Offen", in_arbeit: "In Arbeit", erledigt: "Erledigt" };

// ---------- API helper ----------
async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Fehler bei der Anfrage.");
  return data;
}

// ---------- Init ----------
async function init() {
  if (!state.token) return showLogin();
  try {
    const { user } = await api("/auth/me");
    state.user = user;
    await afterLogin();
  } catch {
    localStorage.removeItem("token");
    state.token = null;
    showLogin();
  }
}

function showLogin() {
  document.getElementById("login-screen").hidden = false;
  document.getElementById("app-screen").hidden = true;
}

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  errEl.hidden = true;
  try {
    const { token, user } = await api("/auth/login", { method: "POST", body: { username, password } });
    state.token = token;
    state.user = user;
    localStorage.setItem("token", token);
    await afterLogin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch {}
  localStorage.removeItem("token");
  state = { ...state, token: null, user: null };
  showLogin();
});

async function afterLogin() {
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app-screen").hidden = false;
  document.getElementById("user-name").textContent = state.user.name;
  document.getElementById("user-role").textContent = state.user.role === "admin" ? "Admin" : "Hausmeister";

  state.properties = await api("/properties");
  state.selectedProperty = state.properties[0]?.code || null;
  renderPropertyPills();
  renderTabBar();
  renderTab();
}

// ---------- Header: property pills ----------
function renderPropertyPills() {
  const container = document.getElementById("property-pills");
  container.innerHTML = "";
  state.properties.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "pill" + (p.code === state.selectedProperty ? " active" : "");
    btn.textContent = p.code;
    btn.title = p.name;
    btn.onclick = () => { state.selectedProperty = p.code; renderPropertyPills(); renderTab(); };
    container.appendChild(btn);
  });
}

// ---------- Tab bar ----------
function renderTabBar() {
  const tabs = state.user.role === "admin"
    ? [["tickets", "Aufträge"], ["ooo", "Außer Betrieb"], ["stats", "Statistik"], ["users", "Benutzer"]]
    : [["tickets", "Aufträge"], ["ooo", "Außer Betrieb"]];

  const bar = document.getElementById("tab-bar");
  bar.innerHTML = "";
  tabs.forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.className = "tab-btn" + (state.tab === key ? " active" : "");
    btn.textContent = label;
    btn.onclick = () => { state.tab = key; renderTabBar(); renderTab(); };
    bar.appendChild(btn);
  });
}

function renderTab() {
  const main = document.getElementById("main-content");
  main.innerHTML = "";
  if (state.tab === "tickets") return renderTicketsTab(main);
  if (state.tab === "ooo") return renderOooTab(main);
  if (state.tab === "stats") return renderStatsTab(main);
  if (state.tab === "users") return renderUsersTab(main);
}

// ---------- Tickets ----------
async function renderTicketsTab(main) {
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<h2>Aufträge</h2>`;
  const addBtn = document.createElement("button");
  addBtn.className = "fab-add";
  addBtn.textContent = "+ Neuer Auftrag";
  addBtn.onclick = openTicketForm;
  header.appendChild(addBtn);
  main.appendChild(header);

  const filterRow = document.createElement("div");
  filterRow.className = "filter-row";
  [["all", "Alle"], ["offen", "Offen"], ["in_arbeit", "In Arbeit"], ["erledigt", "Erledigt"]].forEach(([key, label]) => {
    const chip = document.createElement("button");
    chip.className = "chip" + ((state.ticketFilter || "all") === key ? " active" : "");
    chip.textContent = label;
    chip.onclick = () => { state.ticketFilter = key === "all" ? null : key; renderTab(); };
    filterRow.appendChild(chip);
  });
  main.appendChild(filterRow);

  const list = document.createElement("div");
  list.className = "card-list";
  main.appendChild(list);

  const query = state.selectedProperty ? `?property=${state.selectedProperty}` + (state.ticketFilter ? `&status=${state.ticketFilter}` : "") : (state.ticketFilter ? `?status=${state.ticketFilter}` : "");
  const tickets = await api(`/tickets${query}`);

  if (tickets.length === 0) {
    list.innerHTML = `<div class="empty-state">Keine Aufträge gefunden.</div>`;
    return;
  }

  tickets.forEach((t) => list.appendChild(renderTicketCard(t)));
}

function renderTicketCard(t) {
  const card = document.createElement("div");
  card.className = `ticket-card status-${t.status}`;
  card.onclick = () => openTicketDetail(t);
  card.innerHTML = `
    <div class="card-top">
      <div>
        <div class="card-room">${t.propertyCode} · ${escapeHtml(t.room)}</div>
        <div class="card-meta">${formatDate(t.createdAt)} · gemeldet von ${escapeHtml(t.reportedBy.name)}</div>
      </div>
      ${t.status === "in_arbeit" ? '<span class="pulse-dot"></span>' : ""}
    </div>
    <div class="card-desc">${escapeHtml(t.description)}</div>
    <div class="badge-row">
      <span class="badge badge-status-${t.status}">${STATUS_LABELS[t.status]}</span>
      <span class="badge badge-cat">${CATEGORY_LABELS[t.category]}</span>
      ${t.priority === "dringend" ? '<span class="badge badge-urgent">Dringend</span>' : ""}
    </div>
  `;
  return card;
}

function openTicketForm() {
  const propsOptions = state.properties.map((p) => `<option value="${p.code}" ${p.code === state.selectedProperty ? "selected" : ""}>${p.code} – ${p.name}</option>`).join("");
  openModal(`
    <button class="close-x" data-close>&times;</button>
    <h3>Neuer Auftrag</h3>
    <form id="ticket-form">
      <label>Objekt
        <select name="propertyCode">${propsOptions}</select>
      </label>
      <label>Zimmer / Bereich
        <input type="text" name="room" placeholder="z.B. 204 oder Lobby" required />
      </label>
      <label>Kategorie
        <select name="category">
          ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
        </select>
      </label>
      <label>Beschreibung
        <textarea name="description" placeholder="Was ist los?" required></textarea>
      </label>
      <label>Foto (optional)
        <input type="file" name="photo" accept="image/*" />
      </label>
      <div class="toggle-row">
        <label><input type="radio" name="priority" value="normal" checked /><span>Normal</span></label>
        <label><input type="radio" name="priority" value="dringend" /><span>Dringend</span></label>
      </div>
      <p id="ticket-form-error" class="error-text" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Abbrechen</button>
        <button type="submit" class="btn-primary">Anlegen</button>
      </div>
    </form>
  `);

  document.getElementById("ticket-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = document.getElementById("ticket-form-error");
    const fd = new FormData(form);
    const photoFile = fd.get("photo");
    let photo = null;
    if (photoFile && photoFile.size > 0) {
      photo = await fileToDataUrl(photoFile);
    }
    const body = {
      propertyCode: fd.get("propertyCode"),
      room: fd.get("room"),
      category: fd.get("category"),
      description: fd.get("description"),
      priority: fd.get("priority"),
      photo,
    };
    try {
      await api("/tickets", { method: "POST", body });
      closeModal();
      renderTab();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

function openTicketDetail(t) {
  openModal(`
    <button class="close-x" data-close>&times;</button>
    <h3>${t.propertyCode} · ${escapeHtml(t.room)}</h3>
    <div class="badge-row" style="margin-bottom:10px;">
      <span class="badge badge-status-${t.status}">${STATUS_LABELS[t.status]}</span>
      <span class="badge badge-cat">${CATEGORY_LABELS[t.category]}</span>
      ${t.priority === "dringend" ? '<span class="badge badge-urgent">Dringend</span>' : ""}
    </div>
    <p>${escapeHtml(t.description)}</p>
    ${t.photo ? `<img src="${t.photo}" style="width:100%;border-radius:8px;margin-bottom:10px;" />` : ""}
    <p class="card-meta">Gemeldet von ${escapeHtml(t.reportedBy.name)} am ${formatDate(t.createdAt)}</p>
    ${t.startedAt ? `<p class="card-meta">Begonnen: ${formatDate(t.startedAt)}</p>` : ""}
    ${t.completedAt ? `<p class="card-meta">Erledigt: ${formatDate(t.completedAt)}</p>` : ""}
    ${t.completionNote ? `<p class="card-desc">Notiz: ${escapeHtml(t.completionNote)}</p>` : ""}
    <div id="ticket-actions" style="margin-top:14px; display:flex; flex-direction:column; gap:8px;"></div>
  `);

  const actions = document.getElementById("ticket-actions");
  if (t.status === "offen") {
    actions.appendChild(actionButton("Als 'In Arbeit' markieren", "btn-primary", async () => {
      await api(`/tickets/${t.id}/status`, { method: "PATCH", body: { status: "in_arbeit" } });
      closeModal(); renderTab();
    }));
  }
  if (t.status === "in_arbeit") {
    actions.appendChild(actionButton("Als erledigt markieren", "btn-primary", async () => {
      const note = prompt("Kurze Notiz zur Erledigung (optional):") || undefined;
      await api(`/tickets/${t.id}/status`, { method: "PATCH", body: { status: "erledigt", completionNote: note } });
      closeModal(); renderTab();
    }));
  }
  if (state.user.role === "admin") {
    actions.appendChild(actionButton("Auftrag löschen", "btn-secondary", async () => {
      if (!confirm("Auftrag wirklich löschen?")) return;
      await api(`/tickets/${t.id}`, { method: "DELETE" });
      closeModal(); renderTab();
    }));
  }
}

// ---------- Außer Betrieb (intern, keine Apaleo-Anbindung) ----------
async function renderOooTab(main) {
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<h2>Außer Betrieb</h2>`;
  const addBtn = document.createElement("button");
  addBtn.className = "fab-add";
  addBtn.textContent = "+ Melden";
  addBtn.onclick = openOooForm;
  header.appendChild(addBtn);
  main.appendChild(header);

  const note = document.createElement("p");
  note.className = "card-meta";
  note.style.marginBottom = "12px";
  note.textContent = "Nur interne Markierung – sperrt das Zimmer nicht in Apaleo.";
  main.appendChild(note);

  const list = document.createElement("div");
  list.className = "card-list";
  main.appendChild(list);

  const query = state.selectedProperty ? `?property=${state.selectedProperty}&active=true` : "?active=true";
  const entries = await api(`/outoforder${query}`);

  if (entries.length === 0) {
    list.innerHTML = `<div class="empty-state">Keine offenen Meldungen.</div>`;
    return;
  }

  entries.forEach((e) => {
    const card = document.createElement("div");
    card.className = "ooo-card";
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-room">${e.propertyCode} · ${escapeHtml(e.room)}</div>
          <div class="card-meta">gemeldet von ${escapeHtml(e.createdBy.name)} am ${formatDate(e.createdAt)}</div>
        </div>
      </div>
      <div class="card-desc">${escapeHtml(e.reason)}</div>
      ${e.expectedEnd ? `<div class="card-meta">Voraussichtlich bis: ${escapeHtml(e.expectedEnd)}</div>` : ""}
    `;
    const resolveBtn = actionButton("Aufheben", "btn-secondary", async () => {
      await api(`/outoforder/${e.id}/resolve`, { method: "PATCH" });
      renderTab();
    });
    resolveBtn.style.marginTop = "10px";
    card.appendChild(resolveBtn);
    list.appendChild(card);
  });
}

function openOooForm() {
  const propsOptions = state.properties.map((p) => `<option value="${p.code}" ${p.code === state.selectedProperty ? "selected" : ""}>${p.code} – ${p.name}</option>`).join("");
  openModal(`
    <button class="close-x" data-close>&times;</button>
    <h3>Technisches Problem melden</h3>
    <form id="ooo-form">
      <label>Objekt
        <select name="propertyCode">${propsOptions}</select>
      </label>
      <label>Zimmer / Bereich
        <input type="text" name="room" required />
      </label>
      <label>Grund
        <textarea name="reason" placeholder="z.B. Wasserschaden, Renovierung" required></textarea>
      </label>
      <label>Voraussichtliches Ende (optional)
        <input type="date" name="expectedEnd" />
      </label>
      <p id="ooo-form-error" class="error-text" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Abbrechen</button>
        <button type="submit" class="btn-primary">Melden</button>
      </div>
    </form>
  `);

  document.getElementById("ooo-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = document.getElementById("ooo-form-error");
    try {
      await api("/outoforder", {
        method: "POST",
        body: {
          propertyCode: fd.get("propertyCode"),
          room: fd.get("room"),
          reason: fd.get("reason"),
          expectedEnd: fd.get("expectedEnd") || null,
        },
      });
      closeModal();
      renderTab();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

// ---------- Statistik (Admin) ----------
async function renderStatsTab(main) {
  main.innerHTML = `<div class="section-header"><h2>Statistik</h2></div>`;
  const tickets = await api("/tickets");
  const relevant = state.selectedProperty ? tickets.filter((t) => t.propertyCode === state.selectedProperty) : tickets;

  const open = relevant.filter((t) => t.status === "offen").length;
  const inProgress = relevant.filter((t) => t.status === "in_arbeit").length;
  const done = relevant.filter((t) => t.status === "erledigt");
  const avgMinutes = done.length
    ? Math.round(done.reduce((sum, t) => {
        if (!t.startedAt || !t.completedAt) return sum;
        return sum + (new Date(t.completedAt) - new Date(t.startedAt)) / 60000;
      }, 0) / done.length)
    : null;

  const grid = document.createElement("div");
  grid.className = "stat-grid";
  grid.innerHTML = `
    <div class="stat-box"><div class="stat-num">${open}</div><div class="stat-label">Offen</div></div>
    <div class="stat-box"><div class="stat-num">${inProgress}</div><div class="stat-label">In Arbeit</div></div>
    <div class="stat-box"><div class="stat-num">${done.length}</div><div class="stat-label">Erledigt (gesamt)</div></div>
    <div class="stat-box"><div class="stat-num">${avgMinutes !== null ? avgMinutes + " min" : "–"}</div><div class="stat-label">Ø Bearbeitungszeit</div></div>
  `;
  main.appendChild(grid);

  const byCategory = {};
  relevant.forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + 1; });
  const catList = document.createElement("div");
  catList.className = "card-list";
  catList.innerHTML = `<h3 style="font-size:15px;color:var(--petrol);margin-bottom:6px;">Nach Kategorie</h3>`;
  Object.entries(byCategory).forEach(([cat, count]) => {
    const row = document.createElement("div");
    row.className = "ticket-card";
    row.style.cursor = "default";
    row.innerHTML = `<div class="card-top"><span>${CATEGORY_LABELS[cat]}</span><strong>${count}</strong></div>`;
    catList.appendChild(row);
  });
  main.appendChild(catList);
}

// ---------- Benutzer (Admin) ----------
async function renderUsersTab(main) {
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<h2>Benutzer</h2>`;
  const addBtn = document.createElement("button");
  addBtn.className = "fab-add";
  addBtn.textContent = "+ Neuer Benutzer";
  addBtn.onclick = () => openUserForm();
  header.appendChild(addBtn);
  main.appendChild(header);

  const list = document.createElement("div");
  list.className = "card-list";
  main.appendChild(list);

  const users = await api("/users");
  users.forEach((u) => {
    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-room">${escapeHtml(u.name)} <span class="card-meta">(${escapeHtml(u.username)})</span></div>
          <div class="card-meta">${u.role === "admin" ? "Admin" : "Hausmeister"} · ${u.properties.join(", ") || "keine Objekte"}</div>
        </div>
      </div>
    `;
    card.onclick = () => openUserForm(u);
    list.appendChild(card);
  });
}

function openUserForm(existing) {
  const propsCheckboxes = state.properties.map((p) => `
    <label style="flex-direction:row; align-items:center; gap:8px;">
      <input type="checkbox" name="properties" value="${p.code}" ${existing?.properties?.includes(p.code) ? "checked" : ""} />
      <span style="font-weight:400;">${p.code} – ${p.name}</span>
    </label>
  `).join("");

  openModal(`
    <button class="close-x" data-close>&times;</button>
    <h3>${existing ? "Benutzer bearbeiten" : "Neuer Benutzer"}</h3>
    <form id="user-form">
      <label>Benutzername
        <input type="text" name="username" value="${existing?.username || ""}" ${existing ? "disabled" : ""} required />
      </label>
      <label>Name
        <input type="text" name="name" value="${existing?.name || ""}" required />
      </label>
      <label>Passwort ${existing ? "(leer lassen = unverändert)" : ""}
        <input type="password" name="password" ${existing ? "" : "required"} />
      </label>
      <label>Rolle
        <select name="role">
          <option value="hausmeister" ${existing?.role === "hausmeister" ? "selected" : ""}>Hausmeister</option>
          <option value="admin" ${existing?.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </label>
      <div>${propsCheckboxes}</div>
      <p id="user-form-error" class="error-text" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-close>Abbrechen</button>
        <button type="submit" class="btn-primary">${existing ? "Speichern" : "Anlegen"}</button>
      </div>
      ${existing ? `<button type="button" id="delete-user-btn" class="btn-secondary" style="margin-top:8px; border-color:var(--red-strong); color:var(--red-strong);">Benutzer löschen</button>` : ""}
    </form>
  `);

  document.getElementById("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const errEl = document.getElementById("user-form-error");
    const properties = fd.getAll("properties");
    try {
      if (existing) {
        const body = { name: fd.get("name"), role: fd.get("role"), properties };
        if (fd.get("password")) body.password = fd.get("password");
        await api(`/users/${existing.id}`, { method: "PUT", body });
      } else {
        await api("/users", {
          method: "POST",
          body: { username: fd.get("username"), password: fd.get("password"), name: fd.get("name"), role: fd.get("role"), properties },
        });
      }
      closeModal();
      renderTab();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });

  if (existing) {
    document.getElementById("delete-user-btn").addEventListener("click", async () => {
      const errEl = document.getElementById("user-form-error");
      if (!confirm(`Benutzer "${existing.name}" wirklich löschen?`)) return;
      try {
        await api(`/users/${existing.id}`, { method: "DELETE" });
        closeModal();
        renderTab();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    });
  }
}

// ---------- Modal helpers ----------
function openModal(html) {
  const backdrop = document.getElementById("modal-backdrop");
  const modal = document.getElementById("modal");
  modal.style.position = "relative";
  modal.innerHTML = html;
  backdrop.hidden = false;
  modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeModal));
}
function closeModal() {
  document.getElementById("modal-backdrop").hidden = true;
}
document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});

function actionButton(label, cls, onClick) {
  const btn = document.createElement("button");
  btn.className = cls;
  btn.textContent = label;
  btn.onclick = onClick;
  return btn;
}

// ---------- Utils ----------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

init();
