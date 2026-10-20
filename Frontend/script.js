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

  const photoHtml = `<div class="note-photo"></div>`;
  const claimedBadge = item.claimed
    ? `<span class="claimed-badge">✔ Claimed</span>`
    : "";

  card.innerHTML = `
    ${photoHtml}
    <div class="note-body">
      <span class="note-tag">${item.status === "lost" ? "Lost" : "Found"}</span>
      ${claimedBadge}
      <h3 class="note-title">${item.title}</h3>
      <p class="note-meta">${item.description}</p>
      <p class="note-meta">📍 ${item.location}</p>
      <p class="note-meta">🗓 ${formatDate(item.createdAt)}</p>
    </div>
  `;

  // Only found items can be clicked to claim
  if (item.claimed) {
    card.classList.add("claimed");
    card.style.cursor = "pointer";
    card.addEventListener("click", () => showClaimedContact(item));
  } else if (item.status === "found") {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => openClaimModal(item));
  }

  return card;
}

async function showClaimedContact(item) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Please log in to see contact info.");
    return;
  }

  try {
    const response = await fetch(
      `https://campusfindy.onrender.com/api/items/${item._id}/contact`,
      { headers: { "Authorization": `Bearer ${token}` } }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      alert("This item has already been claimed.");
      return;
    }

    alert("Contact info: " + data.contactInfo);
  } catch (err) {
    alert("Could not connect to the backend.");
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

  board.innerHTML = "";

  if (items.length === 0) {
    board.innerHTML = `
      <div class="empty-state">
        No items found. Try a different keyword.
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    board.appendChild(createCard(item));
  });
}

function applyFilters() {
  const filtered = allItems.filter((item) => {
    const matchesStatus =
      currentStatus === "all" ||
      item.status === currentStatus;

    const haystack = `
      ${item.title}
      ${item.location}
      ${item.description}
    `.toLowerCase();

    const matchesQuery =
      haystack.includes(currentQuery.toLowerCase());

    return matchesStatus && matchesQuery;
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

// ---------- Claim modal ----------

const claimModal = document.getElementById("claimModal");
const claimItemTitle = document.getElementById("claimItemTitle");
const claimQuestionText = document.getElementById("claimQuestionText");
const claimAnswerField = document.getElementById("claimAnswerField");
const claimAnswerInput = document.getElementById("claimAnswerInput");
const claimResultText = document.getElementById("claimResultText");
const claimCancelBtn = document.getElementById("claimCancelBtn");
const claimSubmitBtn = document.getElementById("claimSubmitBtn");

let activeClaimItem = null;

function openClaimModal(item) {
  if (item.claimed) {
    alert("This item has already been claimed.");
    return;
  }

  activeClaimItem = item;

  claimItemTitle.textContent = item.title;
  claimAnswerInput.value = "";

  claimResultText.style.display = "none";
  claimAnswerField.style.display = "block";
  claimSubmitBtn.style.display = "inline-block";

  if (item.verificationQuestion) {
    claimQuestionText.textContent = item.verificationQuestion;
  } else {
    claimQuestionText.textContent =
      "No verification question was set for this item. You can claim it directly.";
  }

  claimModal.style.display = "flex";
}

if (claimCancelBtn) {
  claimCancelBtn.addEventListener("click", () => {
    claimModal.style.display = "none";
    activeClaimItem = null;
  });
}

if (claimSubmitBtn) {
  claimSubmitBtn.addEventListener("click", async () => {
    if (!activeClaimItem) return;

    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please log in to claim an item.");
      return;
    }

    const answer = claimAnswerInput.value.trim();

    if (
      activeClaimItem.verificationQuestion &&
      !answer
    ) {
      alert("Please enter an answer.");
      return;
    }

    claimSubmitBtn.disabled = true;
    claimSubmitBtn.textContent = "Checking…";

    try {
      const response = await fetch(
        `https://campusfindy.onrender.com/api/items/${activeClaimItem._id}/claim`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ answer })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        claimResultText.style.display = "block";
        claimResultText.textContent =
          data.message ||
          data.error ||
          "Something went wrong.";

        claimResultText.style.color = "#c0392b";
      } else {
        claimAnswerField.style.display = "none";
        claimSubmitBtn.style.display = "none";

        claimResultText.style.display = "block";
        claimResultText.style.color = "#1a7a3c";

        claimResultText.innerHTML =
          `Item claimed successfully! Contact info: ` +
          `<strong>${data.item.contactInfo}</strong>`;

        activeClaimItem.claimed = true;
        activeClaimItem.claimedBy = data.item.claimedBy;

        applyFilters();
      }

    } catch (err) {
      console.error("Claim failed:", err);

      claimResultText.style.display = "block";
      claimResultText.textContent =
        "Could not connect to the backend. Please try again.";

      claimResultText.style.color = "#c0392b";

    } finally {
      claimSubmitBtn.disabled = false;
      claimSubmitBtn.textContent = "Submit Answer";
    }
  });
}

// ---------- Report / Post form ----------

const itemForm = document.getElementById("itemForm");
const verifyModal = document.getElementById("verifyModal");
const verifyCancelBtn = document.getElementById("verifyCancelBtn");
const verifyConfirmBtn = document.getElementById("verifyConfirmBtn");

let pendingItemData = null;

async function submitItem(newItem, submitBtn) {
  try {
    const token = localStorage.getItem("token");

    if (!token) {
      alert("Please log in before posting an item.");

      window.location.href = "login.html";

      return;
    }

    const response = await fetch(
      "https://campusfindy.onrender.com/api/items",
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

    alert(
      "Posted successfully! Redirecting you to the Dashboard..."
    );

    window.location.href = "dashboard.html";

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

    const status =
      document.querySelector(
        'input[name="status"]:checked'
      ).value;

        const newItem = {
      status,
      title: document.getElementById("title").value,
      category: document.getElementById("category").value,
      description: document.getElementById("description").value,
      location: document.getElementById("location").value,
      contactInfo: document.getElementById("contactInfo").value
    };

    const submitBtn =
      itemForm.querySelector(".submit-btn");

    // Found items require a verification question
    if (status === "found") {
      pendingItemData = { newItem, submitBtn };
      verifyModal.style.display = "flex";
     } else {
      submitBtn.disabled = true;
      submitBtn.textContent = "Posting…";
      submitItem(newItem, submitBtn);
    }
  });
}

// ---------- Verification modal ----------

if (verifyCancelBtn) {
  verifyCancelBtn.addEventListener("click", () => {
    verifyModal.style.display = "none";
    pendingItemData = null;
  });
}

if (verifyConfirmBtn) {
  verifyConfirmBtn.addEventListener("click", () => {
    if (!pendingItemData) return;

    const question =
      document.getElementById("verifyQuestion").value.trim();

    const answer =
      document.getElementById("verifyAnswer").value.trim();

    if (!question || !answer) {
      alert("Please fill in both the question and answer.");
      return;
    }

    const { newItem, submitBtn } =
      pendingItemData;

    newItem.verificationQuestion = question;
    newItem.verificationAnswer = answer;

    verifyModal.style.display = "none";

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    submitItem(newItem, submitBtn);

    pendingItemData = null;
  });
}
// ---------- Load items from backend ----------

async function loadItems() {
  const board = document.getElementById("board");
  if (!board) return;

  try {
    const response = await fetch("https://campusfindy.onrender.com/api/items");
    const data = await response.json();

    allItems = Array.isArray(data) ? data : data.items || [];

    applyFilters();
  } catch (err) {
    console.error("Failed to load items:", err);
    board.innerHTML = `
      <div class="empty-state">
        Could not load items. Make sure your server is running.
      </div>
    `;
  }
}
loadItems();

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    window.location.replace("login.html");
  });
}