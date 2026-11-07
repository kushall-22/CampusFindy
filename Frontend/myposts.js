// ==========================================================================
// CampusFindy — myposts.js  (myposts.html)
// Lists the logged-in user's posts and submitted claim requests.
// ==========================================================================

const token = localStorage.getItem("token");

if (!token) window.location.replace("login.html");

const box = document.getElementById("myPosts");

async function loadMyPosts() {
  try {
    const headers = { Authorization: `Bearer ${token}` };
    const [items, claims] = await Promise.all([
      fetchList(`${window.CAMPUSFINDY_API_BASE}/my-items`, headers),
      fetchList(`${window.CAMPUSFINDY_API_BASE}/claims/sent`, headers)
    ]);

    render(items, claims);
  } catch (error) {
    console.error("Failed to load your posts:", error);
    box.textContent = error.message || "Could not reach the server.";
  }
}

async function fetchList(url, headers) {
  const response = await fetch(url, { headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Could not load data (${response.status}).`);
  }
  if (!Array.isArray(data)) {
    throw new Error("The server returned an invalid list response.");
  }

  return data;
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

function makeClaimCard(claim) {
  const card = document.createElement("article");
  card.className = `req-card st-${claim.status}`;

  const top = document.createElement("div");
  top.className = "req-top";

  const title = document.createElement("h3");
  title.textContent = claim.item?.title || "Item removed";

  const badge = document.createElement("span");
  badge.className = `req-badge ${claim.status}`;
  badge.textContent = claim.status;
  top.append(title, badge);

  card.append(
    top,
    addClaimLine("Your proof: " + claim.proof),
    addClaimLine(
      claim.finder?.name
        ? `Finder: ${claim.finder.name}`
        : "Finder: unavailable"
    )
  );
  if (claim.reviewMessage) {
    card.appendChild(addClaimLine(claim.reviewMessage));
  }

  if (claim.status === "approved" || claim.status === "returned") {
    const contactStatus = document.createElement("p");
    contactStatus.className = "req-meta req-action-status";
    contactStatus.setAttribute("role", "status");
    contactStatus.setAttribute("aria-live", "polite");

    const contactButton = document.createElement("button");
    contactButton.type = "button";
    contactButton.className = "btn btn-outline req-btn";
    contactButton.textContent = "Show finder contact";
    contactButton.addEventListener("click", async () => {
      contactButton.disabled = true;
      contactStatus.textContent = "Loading contact details...";

      try {
        const response = await fetch(
          `${window.CAMPUSFINDY_API_BASE}/items/${encodeURIComponent(claim.item._id)}/contact`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || "Could not load contact details.");
        }

        contactStatus.textContent = `Finder contact: ${data.contactInfo}`;
        contactButton.hidden = true;
      } catch (error) {
        console.error("Failed to load finder contact:", error);
        contactStatus.textContent =
          error.message || "Could not reach the server.";
        contactButton.disabled = false;
      }
    });

    if (claim.item?._id) {
      card.append(contactButton, contactStatus);
    } else {
      contactStatus.textContent = "The item is no longer available.";
      card.appendChild(contactStatus);
    }
  }

  return card;
}

function addClaimLine(text) {
  const line = document.createElement("p");
  line.className = "req-meta";
  line.textContent = text;
  return line;
}

function makeClaimsSection(claims) {
  const section = document.createElement("section");
  section.className = "my-section";

  const heading = document.createElement("h3");
  heading.className = "my-section-title";
  heading.textContent = `My claim requests (${claims.length})`;
  section.appendChild(heading);

  if (claims.length === 0) {
    const empty = document.createElement("p");
    empty.className = "my-empty";
    empty.textContent = "You haven't sent any claim requests.";
    section.appendChild(empty);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "my-grid";
  claims.forEach((claim) => grid.appendChild(makeClaimCard(claim)));
  section.appendChild(grid);
  return section;
}

function render(items, claims) {
  box.replaceChildren();

  if (items.length === 0 && claims.length === 0) {
    box.textContent = "You haven't posted anything or sent any claim requests yet.";
    return;
  }

  const lost = items.filter((i) => i.status === "lost");
  const found = items.filter((i) => i.status === "found");

  if (items.length > 0) {
    box.appendChild(makeSection("Lost items", lost, "You haven't posted any lost items."));
    box.appendChild(makeSection("Found items", found, "You haven't posted any found items."));
  }
  box.appendChild(makeClaimsSection(claims));
}

loadMyPosts();