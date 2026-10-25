const token = localStorage.getItem("token");
if (!token) window.location.replace("login.html");

const box = document.getElementById("myPosts");

async function loadMyPosts() {
  try {
    const res = await fetch("http://localhost:5000/api/my-items", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const items = await res.json();

    if (!res.ok) {
      box.textContent = items.message || "Could not load your posts.";
      return;
    }
    render(items);
  } catch (err) {
    box.textContent = "Could not reach the server.";
  }
}

function addLine(parent, text) {
  const p = document.createElement("p");
  p.className = "req-meta";
  p.textContent = text;
  parent.appendChild(p);
}

function makeCard(item) {
  const card = document.createElement("article");
  card.className = "req-card";
if (item.claimed) {
  card.classList.add("is-claimed");
} else {
  card.classList.add(item.status === "lost" ? "is-lost" : "is-found");
}

  const top = document.createElement("div");
  top.className = "req-top";

  const title = document.createElement("h3");
  title.textContent = item.title;

  const tag = document.createElement("span");
  tag.className = "req-badge " + (item.status === "lost" ? "rejected" : "approved");
  tag.textContent = item.status;

  top.appendChild(title);
  top.appendChild(tag);
  card.appendChild(top);

  addLine(card, "📝 " + item.description);
  addLine(card, "📍 " + item.location);
  addLine(card, "🗓 " + new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric"
  }));

  if (item.claimed) {
    addLine(card, "✔ This item has been claimed");
  } else if (item.status === "lost") {
    const link = document.createElement("a");
    link.className = "req-btn approve";
    link.style.display = "inline-block";
    link.style.textDecoration = "none";
    link.style.marginTop = "10px";
    link.textContent = "See matching items";
    link.href = "board.html?mode=lost&q=" + encodeURIComponent(item.title);
    card.appendChild(link);
  }

  return card;
}

function makeSection(titleText, items, emptyText) {
  const wrap = document.createElement("section");
  wrap.className = "my-section";

  const heading = document.createElement("h3");
  heading.className = "my-section-title";
  heading.textContent = titleText + " (" + items.length + ")";
  wrap.appendChild(heading);

  if (items.length === 0) {
    const p = document.createElement("p");
    p.className = "my-empty";
    p.textContent = emptyText;
    wrap.appendChild(p);
    return wrap;
  }

  const grid = document.createElement("div");
  grid.className = "my-grid";
  items.forEach((item) => grid.appendChild(makeCard(item)));
  wrap.appendChild(grid);

  return wrap;
}

function render(items) {
  box.innerHTML = "";

  if (items.length === 0) {
    box.textContent = "You haven't posted anything yet.";
    return;
  }

  const lost = items.filter((i) => i.status === "lost");
  const found = items.filter((i) => i.status === "found");

  box.appendChild(makeSection("Lost items", lost, "You haven't posted any lost items."));
  box.appendChild(makeSection("Found items", found, "You haven't posted any found items."));
}

loadMyPosts();