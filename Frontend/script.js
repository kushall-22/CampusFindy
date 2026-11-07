// ==========================================================================
// CampusFindy — script.js
// Handles: rendering item cards, search/filter,
// posting new reports, and claiming found items.
// ==========================================================================

let allItems = [];
let currentStatus = "all";
let currentQuery = "";

// ---------- Rendering ----------

function createCard(item) {
  const card = document.createElement("article");
  card.className = "note-card";
  card.dataset.status = item.status;
  card.dataset.id = item._id;

  const photo = document.createElement("div");
  photo.className = "note-photo";

  const body = document.createElement("div");
  body.className = "note-body";

  const tag = document.createElement("span");
  tag.className = "note-tag";
  tag.textContent = item.status === "lost" ? "Lost" : "Found";
  body.appendChild(tag);

  if (item.claimed) {
    const claimedBadge = document.createElement("span");
    claimedBadge.className = "claimed-badge";
    claimedBadge.textContent = "✔ Claimed";
    body.appendChild(claimedBadge);
  }

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = item.title;

  const description = document.createElement("p");
  description.className = "note-meta";
  description.textContent = item.description;

  const location = document.createElement("p");
  location.className = "note-meta";
  location.textContent = `📍 ${item.location}`;

  const date = document.createElement("p");
  date.className = "note-meta";
  date.textContent = `🗓 ${formatDate(item.createdAt)}`;

  body.append(title, description, location, date);
  card.append(photo, body);

  // Only found items can be clicked to claim
  if (item.claimed) {
    card.classList.add("claimed", "clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `View contact for ${item.title}`);
    card.addEventListener("click", () => showClaimedContact(item));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showClaimedContact(item);
      }
    });
  } else if (item.status === "found") {
    card.classList.add("clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Request ${item.title}`);
    card.addEventListener("click", () => openRequestModal(item._id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openRequestModal(item._id);
      }
    });
  }

  return card;
}

async function showClaimedContact(item) {
  const token = localStorage.getItem("token");

  if (!token) {
    showPopup({
      title: "Login required",
      text: "Please log in to see contact info.",
      kind: "info"
    });
    return;
  }

  try {
    const response = await fetch(
      `${window.CAMPUSFINDY_API_BASE}/items/${item._id}/contact`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      showPopup({
        title: "Not allowed to view contact info, its confidential",
        text: data.message || "You can't see the contact details for this item.",
        kind: "error"
      });
      return;
    }

    showPopup({
      title: "Contact details",
      text: data.contactInfo,
      kind: "success",
      copyText: data.contactInfo
    });
  } catch (err) {
    showPopup({
      title: "Connection problem",
      text: "Could not connect to the backend. Make sure the server is running.",
      kind: "error"
    });
  }
}

function formatDate(isoDate) {
  if (!isoDate) return "";

  const d = new Date(isoDate);

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function renderBoard(items) {
  const board = document.getElementById("board");

  if (!board) return;

  board.replaceChildren();

  if (items.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "No items found. Try a different keyword.";
    board.appendChild(emptyState);
    return;
  }

  items.forEach((item) => {
    board.appendChild(createCard(item));
  });
}

// How did the visitor arrive at the board?
const params = new URLSearchParams(window.location.search);
const boardMode = params.get("mode"); // "lost", "found", or nothing
const boardWords = (params.get("q") || "")
  .toLowerCase()
  .split(/\s+/)
  .filter((w) => w.length > 2);

function applyFilters() {
  const typed = currentQuery.trim().toLowerCase();
  const typedWords = typed ? typed.split(/\s+/) : [];

  // Reported found -> show lost items. Otherwise -> show found items.
  const filtered = allItems.filter((item) => {
    if (!boardMode) {
      // Direct visit: only claimed items
      if (!item.claimed) return false;
    } else {
      // After reporting: lost -> show found items, found -> show lost items
      const wantedStatus = boardMode === "found" ? "lost" : "found";
      if (item.status !== wantedStatus) return false;
    }

    const haystack =
      `${item.title} ${item.location} ${item.description}`.toLowerCase();

    // Similar to the item they just reported
    if (boardWords.length > 0 && !boardWords.some((w) => haystack.includes(w))) {
      return false;
    }

    // Whatever they type in the search bar
    return typedWords.every((w) => haystack.includes(w));
  });

  renderBoard(filtered);
}

// ---------- Browse page ----------

const searchInput = document.getElementById("searchInput");

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    currentQuery = e.target.value;
    applyFilters();
  });
}

const statusButtons = document.querySelectorAll(".status-toggle button");

statusButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    statusButtons.forEach((b) => b.classList.remove("active"));

    btn.classList.add("active");

    currentStatus = btn.dataset.status;

    applyFilters();
  });
});

// ---------- Report / Post form ----------

const itemForm = document.getElementById("itemForm");
if (itemForm && !localStorage.getItem("token")) {
  alert("Please log in to report an item.");
  window.location.href = "login.html";
}
async function submitItem(newItem, submitBtn) {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please log in before posting an item.");

      window.location.href = "login.html";

      return;
    }

    const response = await fetch(
      `${window.CAMPUSFINDY_API_BASE}/items`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newItem)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Backend error:", data);

      alert(
        data.message ||
        data.error ||
        `Posting failed. Server returned ${response.status}`
      );

      submitBtn.disabled = false;
      submitBtn.textContent = "Post to CampusFindy";

      return;
    }

    console.log("Item posted successfully:", data);

    alert("Posted successfully! Showing similar items...");

    window.location.href =
      `board.html?mode=${newItem.status}&q=${encodeURIComponent(newItem.title)}`;

  } catch (err) {
    console.error("Failed to submit item:", err);

    alert(
      "Could not connect to the backend.\n\n" +
      "Make sure your server is running on port 5000."
    );

    submitBtn.disabled = false;
    submitBtn.textContent = "Post to CampusFindy";
  }
}


if (itemForm) {
  itemForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const selectedStatus = document.querySelector(
      'input[name="status"]:checked'
    );

    if (!selectedStatus) {
      alert("Please select Lost or Found.");
      return;
    }

    const status = selectedStatus.value;

    const newItem = {
      status,
      title: document.getElementById("title").value.trim(),
      category: document.getElementById("category").value,
      description: document.getElementById("description").value.trim(),
      location: document.getElementById("location").value.trim(),
      contactInfo: document.getElementById("contactInfo").value.trim()
    };

    const submitBtn = itemForm.querySelector(".submit-btn");

    if (!submitBtn) {
      console.error('Post button with class ".submit-btn" was not found.');
      alert("Post button configuration error. Check the browser Console.");
      return;
    }

    if (!newItem.title || !newItem.description ||
        !newItem.location || !newItem.contactInfo) {
      alert("Please fill in all required fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting...";
    submitItem(newItem, submitBtn);
  });
}
// ---------- Load items from backend ----------

async function loadItems() {
  const board = document.getElementById("board");
  if (!board) return;

  try {
    const response = await fetch(`${window.CAMPUSFINDY_API_BASE}/items`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || `Could not load items (${response.status}).`);
    }

    allItems = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(allItems)) {
      throw new Error("The server returned an invalid items response.");
    }

    applyFilters();
  } catch (err) {
    console.error("Failed to load items:", err);
    board.textContent = err.message || "Could not load items.";
  }
}
loadItems();

function openRequestModal(itemId) {
  document.getElementById('requestItemId').value = itemId;
  document.getElementById('requestProof').value = '';
  document.getElementById('requestMsg').textContent = '';
  document.getElementById('requestModal').style.display = 'flex';
}

function closeRequestModal() {
  document.getElementById('requestModal').style.display = 'none';
}

async function submitRequest() {
  const itemId = document.getElementById('requestItemId').value;
  const proof = document.getElementById('requestProof').value;
  const msg = document.getElementById('requestMsg');

  try {
    const res = await fetch(`${window.CAMPUSFINDY_API_BASE}/claims/${itemId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + localStorage.getItem('token')
      },
      body: JSON.stringify({ proof })
    });
    const data = await res.json();

    if (res.ok) {
      msg.textContent = 'Request sent! The finder will review it.';
      setTimeout(closeRequestModal, 1500);
    } else {
      msg.textContent = data.message;
    }
  } catch (err) {
    msg.textContent = 'Could not reach the server.';
  }
}

const requestSendBtn = document.getElementById('requestSendBtn');
const requestCancelBtn = document.getElementById('requestCancelBtn');

if (requestSendBtn) requestSendBtn.addEventListener('click', submitRequest);
if (requestCancelBtn) requestCancelBtn.addEventListener('click', closeRequestModal);

// ---------- Popup window ----------

const infoPopup = document.getElementById("infoPopup");
const popupWindow = infoPopup ? infoPopup.querySelector(".popup-window") : null;
const popupIcon = document.getElementById("popupIcon");
const popupTitle = document.getElementById("popupTitle");
const popupText = document.getElementById("popupText");
const popupCopy = document.getElementById("popupCopy");
const popupOk = document.getElementById("popupOk");
const popupClose = document.getElementById("popupClose");

function showPopup({ title, text, kind = "info", copyText = "" }) {
  if (!infoPopup) {
    alert(text);
    return;
  }

  const icons = { info: "ℹ", success: "✔", error: "!" };

  popupWindow.className = "popup-window " + kind;
  popupIcon.textContent = icons[kind] || icons.info;
  popupTitle.textContent = title;
  popupText.textContent = text;

  popupCopy.textContent = "Copy";
  popupCopy.hidden = !copyText;
  popupCopy.onclick = () => {
    navigator.clipboard.writeText(copyText).then(() => {
      popupCopy.textContent = "Copied!";
    });
  };

  infoPopup.hidden = false;
}

function hidePopup() {
  if (infoPopup) infoPopup.hidden = true;
}

if (popupOk) popupOk.addEventListener("click", hidePopup);
if (popupClose) popupClose.addEventListener("click", hidePopup);

if (infoPopup) {
  infoPopup.addEventListener("click", (e) => {
    if (e.target === infoPopup) hidePopup();
  });
}

// Esc closes whichever popup is open
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  hidePopup();
  const rm = document.getElementById("requestModal");
  if (rm && rm.style.display !== "none") closeRequestModal();
});

// Clicking the dark area outside the request popup closes it too
const requestOverlay = document.getElementById("requestModal");
if (requestOverlay) {
  requestOverlay.addEventListener("click", (e) => {
    if (e.target === requestOverlay) closeRequestModal();
  });
}