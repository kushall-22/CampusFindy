const API = "http://localhost:5000/api/claims";
const token = localStorage.getItem("token");

if (!token) window.location.replace("login.html");

const list = document.getElementById("requestList");

async function loadRequests() {
  try {
    const res = await fetch(`${API}/received`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const claims = await res.json();

    if (!res.ok) {
      list.textContent = claims.message || "Could not load requests.";
      return;
    }
    render(claims);
  } catch (err) {
    list.textContent = "Could not reach the server.";
  }
}

let claimsList = [];
let currentIndex = 0;

function render(claims) {
  claimsList = claims;
  if (currentIndex >= claimsList.length) {
    currentIndex = Math.max(0, claimsList.length - 1);
  }
  showCurrent();
}

function showCurrent() {
  list.innerHTML = "";

  if (claimsList.length === 0) {
    list.textContent = "No requests on your items yet.";
    return;
  }

  const slider = document.createElement("div");
  slider.className = "req-slider";

  const prev = document.createElement("button");
  prev.className = "req-arrow";
  prev.textContent = "‹";
  prev.disabled = currentIndex === 0;
  prev.addEventListener("click", () => {
    currentIndex--;
    showCurrent();
  });

  const next = document.createElement("button");
  next.className = "req-arrow";
  next.textContent = "›";
  next.disabled = currentIndex === claimsList.length - 1;
  next.addEventListener("click", () => {
    currentIndex++;
    showCurrent();
  });

  slider.appendChild(prev);
  slider.appendChild(makeRow(claimsList[currentIndex]));
  slider.appendChild(next);

  const counter = document.createElement("p");
  counter.className = "req-counter";
  counter.textContent = (currentIndex + 1) + " of " + claimsList.length;

  list.appendChild(slider);
  list.appendChild(counter);
}

function line(text) {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function makeButton(label, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

function makeRow(c) {
  const card = document.createElement("article");
  card.className = "req-card";
  card.classList.add("st-" + c.status);

  const top = document.createElement("div");
  top.className = "req-top";

  const title = document.createElement("h3");
  title.textContent = c.item ? c.item.title : "Item removed";

  const badge = document.createElement("span");
  badge.className = "req-badge " + c.status;
  badge.textContent = c.status;

  top.appendChild(title);
  top.appendChild(badge);
  card.appendChild(top);

  const who = line("👤 " + (c.claimant ? c.claimant.name : "Unknown") +
    (c.claimant && c.claimant.email ? " (" + c.claimant.email + ")" : ""));
  who.className = "req-meta";
  card.appendChild(who);

  const proof = line("📝 " + c.proof);
  proof.className = "req-meta";
  card.appendChild(proof);

  const when = line("🗓 " + new Date(c.createdAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  }));
  when.className = "req-meta";
  card.appendChild(when);

  const actions = document.createElement("div");
  actions.className = "req-actions";

  if (c.status === "pending") {
    const approve = makeButton("Approve", () => send(c._id, "review", { decision: "approved" }));
    approve.className = "req-btn approve";
    const reject = makeButton("Reject", () => send(c._id, "review", { decision: "rejected" }));
    reject.className = "req-btn reject";
    actions.appendChild(approve);
    actions.appendChild(reject);
  } else if (c.status === "approved") {
    const ret = makeButton("Mark as returned", () => send(c._id, "return", {}));
    ret.className = "req-btn approve";
    actions.appendChild(ret);
  }

  card.appendChild(actions);
  return card;
}

async function send(id, action, body) {
  try {
    const res = await fetch(`${API}/${id}/${action}`, {
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