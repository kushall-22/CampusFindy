// ==========================================================================
// CampusFindy — theme.js  (loaded on every page)
// Dark/light theme, the ⋮ header menu, and logout.
// ==========================================================================

// ---------- Theme ----------

const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

document.documentElement.dataset.theme = savedTheme || (prefersDark ? "dark" : "light");

const themeToggle = document.getElementById("themeToggle");

function updateThemeButton() {
  if (!themeToggle) return;

  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggle.textContent = isDark ? "☀ Light" : "☾ Dark";
  themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
}

updateThemeButton();

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
    updateThemeButton();
  });
}


// ---------- Header menu ----------

const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");

function setMenu(open) {
  menuDropdown.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
}

if (menuBtn && menuDropdown) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(menuDropdown.hidden);
  });

  // Click anywhere else, or press Escape, to close
  document.addEventListener("click", (e) => {
    if (!menuDropdown.contains(e.target)) setMenu(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setMenu(false);
      menuBtn.focus();
    }
  });
}


// ---------- Logout ----------

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    window.location.replace("login.html");
  });
}