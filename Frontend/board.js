const board = document.getElementById("board");
const searchInput = document.getElementById("searchInput");
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
  const filteredItems = allItems.filter((item) => {
    if (boardMode === "lost" && item.status !== "found") return false;
    if (boardMode === "found" && item.status !== "lost") return false;
    if (!boardMode && item.status !== "found") return false;

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

  if (filteredItems.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No matching items found. Try a different keyword.";
    board.appendChild(emptyState);
    return;
  }

  filteredItems.forEach((item) => board.appendChild(createCard(item)));
}

function openRequest(itemId) {
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
      `Finder contact: ${data.contactInfo || "Contact information is unavailable."}`;
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
requestSendBtn.addEventListener("click", submitRequest);
requestCancelBtn.addEventListener("click", closeRequest);

requestModal.addEventListener("click", (event) => {
  if (event.target === requestModal) closeRequest();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !requestModal.hidden) closeRequest();
});

loadItems();
