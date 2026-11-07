const board = document.getElementById("board");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const categoryFilter = document.getElementById("categoryFilter");
const locationFilter = document.getElementById("locationFilter");
const dateFromFilter = document.getElementById("dateFromFilter");
const dateToFilter = document.getElementById("dateToFilter");
const resultsSummary = document.getElementById("resultsSummary");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const requestModal = document.getElementById("requestModal");
const requestItemId = document.getElementById("requestItemId");
const requestProof = document.getElementById("requestProof");
const requestMsg = document.getElementById("requestMsg");
const requestSendBtn = document.getElementById("requestSendBtn");
const requestCancelBtn = document.getElementById("requestCancelBtn");

const params = new URLSearchParams(window.location.search);
const boardMode = params.get("mode");
const boardWords = (params.get("q") || "")
  .toLowerCase()
  .split(/\s+/)
  .filter((word) => word.length > 2);

let allItems = [];
let requestSubmitted = false;
let requestTrigger = null;

const defaultStatusFilter =
  boardMode === "lost" ? "found" : boardMode === "found" ? "lost" : "found";
statusFilter.value = defaultStatusFilter;

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "note-card";
  card.dataset.status = item.status;

  const body = document.createElement("div");
  body.className = "note-body";

  const tag = document.createElement("span");
  tag.className = "note-tag";
  tag.textContent = item.status === "lost" ? "Lost" : "Found";

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = item.title;

  const description = document.createElement("p");
  description.className = "note-meta";
  description.textContent = item.description;

  const location = document.createElement("p");
  location.className = "note-meta";
  location.textContent = `Location: ${item.location}`;

  body.append(tag, title, description, location);

  const date = formatDate(item.createdAt);
  if (date) {
    const postedDate = document.createElement("p");
    postedDate.className = "note-meta";
    postedDate.textContent = `Posted: ${date}`;
    body.appendChild(postedDate);
  }

  card.appendChild(body);

  if (item.status === "found") {
    card.classList.add("clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Request ${item.title}`);
    card.addEventListener("click", () => openRequest(item._id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRequest(item._id);
      }
    });
  }

  return card;
}

function renderItems() {
  const queryWords = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const locationQuery = locationFilter.value.trim().toLowerCase();
  const fromDate = dateFromFilter.value
    ? new Date(`${dateFromFilter.value}T00:00:00`)
    : null;
  const toDate = dateToFilter.value
    ? new Date(`${dateToFilter.value}T23:59:59.999`)
    : null;
  const filteredItems = allItems.filter((item) => {
    if (statusFilter.value !== "all" && item.status !== statusFilter.value) {
      return false;
    }

    if (
      categoryFilter.value !== "all" &&
      (item.category || "other").toLowerCase() !== categoryFilter.value
    ) {
      return false;
    }

    if (
      locationQuery &&
      !String(item.location || "").toLowerCase().includes(locationQuery)
    ) {
      return false;
    }

    const postedAt = new Date(item.createdAt);
    if (fromDate && (!Number.isFinite(postedAt.getTime()) || postedAt < fromDate)) {
      return false;
    }
    if (toDate && (!Number.isFinite(postedAt.getTime()) || postedAt > toDate)) {
      return false;
    }

    const searchableText =
      `${item.title} ${item.location} ${item.description}`.toLowerCase();

    if (
      boardWords.length > 0 &&
      !boardWords.some((word) => searchableText.includes(word))
    ) {
      return false;
    }

    return queryWords.every((word) => searchableText.includes(word));
  });

  board.replaceChildren();
  resultsSummary.textContent =
    `${filteredItems.length} ${filteredItems.length === 1 ? "item" : "items"} found`;

  if (filteredItems.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const message = document.createElement("p");
    message.textContent = allItems.length
      ? "No items match these filters. Try changing or clearing them."
      : "There are no items posted yet. Be the first to report one.";
    emptyState.appendChild(message);

    if (allItems.length) {
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "btn btn-outline";
      clearButton.textContent = "Clear filters";
      clearButton.addEventListener("click", clearFilters);
      emptyState.appendChild(clearButton);
    } else {
      const reportLink = document.createElement("a");
      reportLink.className = "btn btn-primary";
      reportLink.href = "post.html";
      reportLink.textContent = "Report an item";
      emptyState.appendChild(reportLink);
    }

    board.appendChild(emptyState);
    return;
  }

  filteredItems.forEach((item) => board.appendChild(createCard(item)));
}

function clearFilters() {
  searchInput.value = "";
  statusFilter.value = defaultStatusFilter;
  categoryFilter.value = "all";
  locationFilter.value = "";
  dateFromFilter.value = "";
  dateToFilter.value = "";
  renderItems();
}

function openRequest(itemId) {
  requestTrigger = document.activeElement;
  requestItemId.value = itemId;
  requestProof.value = "";
  requestMsg.textContent = "";
  requestSubmitted = false;
  requestSendBtn.disabled = false;
  requestSendBtn.textContent = "Send Request";
  requestModal.hidden = false;
  requestProof.focus();
}

function closeRequest() {
  requestModal.hidden = true;
  if (requestTrigger instanceof HTMLElement) {
    requestTrigger.focus();
  }
}

async function loadItems() {
  board.textContent = "Loading items...";

  try {
    const response = await fetch(`${window.CAMPUSFINDY_API_BASE}/items`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Could not load items.");
    }

    allItems = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(allItems)) {
      throw new Error("The server returned an invalid items response.");
    }

    renderItems();
  } catch (error) {
    console.error("Failed to load items:", error);
    board.textContent = error.message || "Could not reach the server.";
  }
}

async function submitRequest() {
  if (requestSubmitted) return;

  const proof = requestProof.value.trim();
  if (proof.length < 5 || proof.length > 1000) {
    requestMsg.textContent = "Please enter a description between 5 and 1000 characters.";
    requestProof.focus();
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    window.location.replace("login.html");
    return;
  }

  requestSendBtn.disabled = true;
  requestMsg.textContent = "Sending request...";

  try {
    const response = await fetch(
      `${window.CAMPUSFINDY_API_BASE}/claims/${encodeURIComponent(requestItemId.value)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ proof })
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      requestMsg.textContent = data.message || "Could not send your request.";
      return;
    }

    requestSubmitted = true;
    requestMsg.textContent =
      `${data.message || "Request sent to the finder."} ` +
      "The finder will review your request. Contact details are available after approval.";
    requestProof.value = "";
    requestSendBtn.textContent = "Request sent";
  } catch (error) {
    console.error("Failed to send claim request:", error);
    requestMsg.textContent = "Could not reach the server. Please try again.";
  } finally {
    requestSendBtn.disabled = requestSubmitted;
  }
}

searchInput.addEventListener("input", renderItems);
[statusFilter, categoryFilter, dateFromFilter, dateToFilter].forEach((filter) => {
  filter.addEventListener("change", renderItems);
});
locationFilter.addEventListener("input", renderItems);
clearFiltersBtn.addEventListener("click", clearFilters);
requestSendBtn.addEventListener("click", submitRequest);
requestCancelBtn.addEventListener("click", closeRequest);

requestModal.addEventListener("click", (event) => {
  if (event.target === requestModal) closeRequest();
});

document.addEventListener("keydown", (event) => {
  if (requestModal.hidden) return;

  if (event.key === "Escape") {
    closeRequest();
    return;
  }

  if (event.key === "Tab") {
    const focusable = requestModal.querySelectorAll(
      'button:not([disabled]), textarea:not([disabled]), input:not([type="hidden"]):not([disabled])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

loadItems();
