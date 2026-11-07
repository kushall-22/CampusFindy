// ==========================================================================
// CampusFindy — myposts.js  (myposts.html)
// Lists the logged-in user's lost and found posts.
// ==========================================================================

const token = localStorage.getItem("token");

if (!token) window.location.replace("login.html");

const box = document.getElementById("myPosts");

async function loadMyPosts() {
  try {
    const res = await fetch(`${window.CAMPUSFINDY_API_BASE}/my-items`, {
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
  card.className = "req-card " + (item.claimed ? "is-claimed" : `is-${item.status}`);

  const top = document.createElement("div");
  top.className = "req-top";

  const title = document.createElement("h3");
  title.textContent = item.title;

  // Reuses the request badge colors: red = lost, green = found
  const tag = document.createElement("span");
  tag.className = "req-badge " + (item.status === "lost" ? "rejected" : "approved");
  tag.textContent = item.status;

  top.append(title, tag);
  card.appendChild(top);

  addLine(card, "📝 " + item.description);
  addLine(card, "📍 " + item.location);
  addLine(card, "🗓 " + new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }));

  if (item.claimed) {
    addLine(card, "✔ This item has been claimed");
  } else if (item.status === "lost") {
    const link = document.createElement("a");
    link.className = "btn btn-outline req-btn";
    link.textContent = "See matching items";
    link.href = "board.html?mode=lost&q=" + encodeURIComponent(item.title);
    card.appendChild(link);
  }

  return card;
}

function makeSection(titleText, items, emptyText) {
  const section = document.createElement("section");
  section.className = "my-section";

  const heading = document.createElement("h3");
  heading.className = "my-section-title";
  heading.textContent = `${titleText} (${items.length})`;
  section.appendChild(heading);

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "my-empty";
    empty.textContent = emptyText;
    section.appendChild(empty);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "my-grid";
  items.forEach((item) => grid.appendChild(makeCard(item)));
  section.appendChild(grid);

  return section;
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