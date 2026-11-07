const adminToken = localStorage.getItem("token");
const itemsContainer = document.getElementById("adminItems");
const usersContainer = document.getElementById("adminUsers");
const itemsStatus = document.getElementById("itemsStatus");
const usersStatus = document.getElementById("usersStatus");
const dashboardStatus = document.getElementById("dashboardStatus");
const activityContainer = document.getElementById("adminActivity");

async function adminRequest(path, options = {}) {
  const response = await fetch(`${window.CAMPUSFINDY_API_BASE}/admin${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const data = await response.json();

  if (response.status === 401) {
    localStorage.removeItem("token");
    window.location.replace("login.html");
    throw new Error("Your session has expired. Please log in again.");
  }

  if (response.status === 403) {
    throw new Error("Administrator access is required to use these tools.");
  }

  if (!response.ok) {
    throw new Error(data.message || "The request could not be completed.");
  }

  return data;
}

function addMeta(card, label, value) {
  const line = document.createElement("p");
  line.className = "req-meta";
  line.textContent = `${label}: ${value}`;
  card.appendChild(line);
}

function renderDashboard(dashboard) {
  document.getElementById("totalStudents").textContent =
    dashboard.totalStudents.toLocaleString();
  document.getElementById("totalLostReports").textContent =
    dashboard.totalLostReports.toLocaleString();
  document.getElementById("totalFoundReports").textContent =
    dashboard.totalFoundReports.toLocaleString();
  document.getElementById("pendingClaims").textContent =
    dashboard.pendingClaims.toLocaleString();
  document.getElementById("returnedItems").textContent =
    dashboard.returnedItems.toLocaleString();
  dashboardStatus.textContent =
    `${dashboard.totalReports.toLocaleString()} total lost and found reports.`;

  activityContainer.replaceChildren();
  if (dashboard.recentActivity.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No recent activity.";
    activityContainer.appendChild(empty);
    return;
  }

  dashboard.recentActivity.forEach((activity) => {
    const entry = document.createElement("li");
    const message = document.createElement("span");
    message.textContent = activity.message;
    const date = document.createElement("time");
    const timestamp = new Date(activity.at);
    if (Number.isNaN(timestamp.getTime())) {
      date.textContent = "Date unavailable";
    } else {
      date.dateTime = timestamp.toISOString();
      date.textContent = timestamp.toLocaleString();
    }
    entry.append(message, date);
    activityContainer.appendChild(entry);
  });
}

async function loadDashboard() {
  dashboardStatus.textContent = "Loading dashboard…";
  try {
    const dashboard = await adminRequest("/dashboard");
    if (
      typeof dashboard.totalStudents !== "number" ||
      typeof dashboard.totalLostReports !== "number" ||
      typeof dashboard.totalFoundReports !== "number" ||
      typeof dashboard.pendingClaims !== "number" ||
      typeof dashboard.returnedItems !== "number" ||
      !Array.isArray(dashboard.recentActivity)
    ) {
      throw new Error("The server returned invalid dashboard data.");
    }
    renderDashboard(dashboard);
  } catch (error) {
    dashboardStatus.textContent = error.message;
    activityContainer.replaceChildren();
  }
}

function makeActionButton(label, className, action) {
  const button = document.createElement("button");
  button.type = "button";
  const variant = className.includes("admin-danger") ? "btn-danger" : "btn-outline";
  button.className = `btn ${variant} req-btn admin-action ${className}`;
  button.textContent = label;
  button.addEventListener("click", action);
  return button;
}

async function updateItem(item, action, button) {
  if (
    action === "removed" &&
    !window.confirm(`Remove "${item.title}" from the public listings?`)
  ) {
    return;
  }

  button.disabled = true;
  try {
    const result = await adminRequest(
      `/items/${encodeURIComponent(item._id)}/state`,
      {
        method: "PATCH",
        body: JSON.stringify({ state: action })
      }
    );
    itemsStatus.textContent = result.message;
    await loadItems();
  } catch (error) {
    itemsStatus.textContent = error.message;
    button.disabled = false;
  }
}

function renderItems(items) {
  itemsContainer.replaceChildren();

  if (items.length === 0) {
    itemsStatus.textContent = "There are no listings to manage.";
    return;
  }

  itemsStatus.textContent = `${items.length} most recent listing${items.length === 1 ? "" : "s"} (maximum 200).`;

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `req-card ${item.state === "removed" ? "admin-removed" : ""}`;
    if (item.status === "lost") card.classList.add("is-lost");
    if (item.status === "found") card.classList.add("is-found");

    const title = document.createElement("h4");
    title.textContent = item.title;
    card.appendChild(title);
    addMeta(card, "Type", item.status);
    addMeta(card, "State", item.state);
    addMeta(card, "Posted by", item.postedBy?.name || "Unknown user");
    addMeta(card, "Location", item.location);

    const action = item.state === "removed" ? "restore" : "removed";
    card.appendChild(makeActionButton(
      action === "restore" ? "Restore listing" : "Remove listing",
      action === "removed" ? "admin-danger" : "",
      (event) => updateItem(item, action, event.currentTarget)
    ));
    itemsContainer.appendChild(card);
  });
}

async function loadItems() {
  itemsStatus.textContent = "Loading listings…";
  try {
    const items = await adminRequest("/items");
    if (!Array.isArray(items)) throw new Error("The server returned invalid listings.");
    renderItems(items);
  } catch (error) {
    itemsStatus.textContent = error.message;
  }
}

async function updateUserStatus(user, status, button) {
  if (
    status === "suspended" &&
    !window.confirm(`Suspend ${user.name}'s account?`)
  ) {
    return;
  }

  button.disabled = true;
  try {
    const result = await adminRequest(
      `/users/${encodeURIComponent(user._id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status })
      }
    );
    usersStatus.textContent = result.message;
    await loadUsers();
  } catch (error) {
    usersStatus.textContent = error.message;
    button.disabled = false;
  }
}

function renderUsers(users) {
  usersContainer.replaceChildren();

  if (users.length === 0) {
    usersStatus.textContent = "There are no accounts to manage.";
    return;
  }

  usersStatus.textContent = `${users.length} most recent account${users.length === 1 ? "" : "s"} (maximum 200).`;

  users.forEach((user) => {
    const card = document.createElement("article");
    card.className = "req-card";

    const title = document.createElement("h4");
    title.textContent = user.name;
    card.appendChild(title);
    addMeta(card, "Email", user.email);
    addMeta(card, "Role", user.role);
    addMeta(card, "Status", user.status);

    if (user.role !== "admin") {
      const nextStatus = user.status === "suspended" ? "active" : "suspended";
      card.appendChild(makeActionButton(
        nextStatus === "suspended" ? "Suspend account" : "Reactivate account",
        nextStatus === "suspended" ? "admin-danger" : "",
        (event) => updateUserStatus(user, nextStatus, event.currentTarget)
      ));
    } else {
      addMeta(card, "Access", "Administrator accounts are protected");
    }

    usersContainer.appendChild(card);
  });
}

async function loadUsers() {
  usersStatus.textContent = "Loading accounts…";
  try {
    const users = await adminRequest("/users");
    if (!Array.isArray(users)) throw new Error("The server returned invalid accounts.");
    renderUsers(users);
  } catch (error) {
    usersStatus.textContent = error.message;
  }
}

if (!adminToken) {
  window.location.replace("login.html");
} else {
  loadDashboard();
  loadItems();
  loadUsers();
}
