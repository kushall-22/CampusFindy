// ==========================================================================
// CampusFindy — requests.js  (requests.html)
// Claim requests on the user's found items: approve, reject, mark returned.
// ==========================================================================

const token = localStorage.getItem("token");

if (!token) window.location.replace("login.html");

const list = document.getElementById("requestList");

let claimsList = [];
let currentIndex = 0;

async function loadRequests() {
  try {
    const res = await fetch(`${window.CAMPUSFINDY_API_BASE}/claims/received`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const claims = await res.json();

    if (!res.ok) {
      list.textContent = claims.message || "Could not load requests.";
      return;
    }

    claimsList = claims;
    currentIndex = Math.min(currentIndex, Math.max(0, claimsList.length - 1));
    showCurrent();
  } catch (err) {
    list.textContent = "Could not reach the server.";
  }
}

function makeArrow(label, disabled, onClick) {
  const btn = document.createElement("button");
  btn.className = "btn btn-primary req-arrow";
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener("click", onClick);
  return btn;
}

function showCurrent() {
  list.innerHTML = "";

  if (claimsList.length === 0) {
    list.textContent = "No requests on your items yet.";
    return;
  }

  const slider = document.createElement("div");
  slider.className = "req-slider";
  slider.append(
    makeArrow("<", currentIndex === 0, () => { currentIndex--; showCurrent(); }),
    makeRow(claimsList[currentIndex]),
    makeArrow(">", currentIndex === claimsList.length - 1, () => { currentIndex++; showCurrent(); })
  );

  const counter = document.createElement("p");
  counter.className = "req-counter";
  counter.textContent = `${currentIndex + 1} of ${claimsList.length}`;

  list.append(slider, counter);
}

function metaLine(text) {
  const p = document.createElement("p");
  p.className = "req-meta";
  p.textContent = text;
  return p;
}

function makeButton(label, className, onClick) {
  const btn = document.createElement("button");
  const variant = className.split(/\s+/).includes("reject")
    ? "btn-danger"
    : "btn-outline";
  btn.className = `btn ${variant} ${className}`;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function makeRow(claim) {
  const card = document.createElement("article");
  card.className = "req-card st-" + claim.status;

  const top = document.createElement("div");
  top.className = "req-top";

  const title = document.createElement("h3");
  title.textContent = claim.item ? claim.item.title : "Item removed";

  const badge = document.createElement("span");
  badge.className = "req-badge " + claim.status;
  badge.textContent = claim.status;

  top.append(title, badge);

  const claimant = claim.claimant;
  const who = "👤 " + (claimant ? claimant.name : "Unknown") +
    (claimant && claimant.email ? ` (${claimant.email})` : "");
  const when = new Date(claim.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  const actions = document.createElement("div");
  actions.className = "req-actions";

  if (claim.status === "pending") {
    actions.append(
      makeButton("Approve", "req-btn", () => send(claim._id, "review", { decision: "approved" })),
      makeButton("Reject", "req-btn reject", () => send(claim._id, "review", { decision: "rejected" }))
    );
  } else if (claim.status === "approved") {
    actions.append(makeButton("Mark as returned", "req-btn", () => send(claim._id, "return", {})));
  }

  card.append(top, metaLine(who), metaLine("📝 " + claim.proof), metaLine("🗓 " + when), actions);
  return card;
}

async function send(id, action, body) {
  try {
    const res = await fetch(`${window.CAMPUSFINDY_API_BASE}/claims/${id}/${action}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.message || "Something went wrong.");
  } catch (err) {
    alert("Could not reach the server.");
  }
  loadRequests();
}

loadRequests();