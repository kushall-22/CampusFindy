const savedTheme = localStorage.getItem("theme");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

document.documentElement.dataset.theme = initialTheme;

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
const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");

function setMenu(open) {
  if (!menuBtn || !menuDropdown) return;
  menuDropdown.hidden = !open;
  menuBtn.setAttribute("aria-expanded", String(open));
}

if (menuBtn && menuDropdown) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(menuDropdown.hidden);
  });

  // Close when clicking anywhere else
  document.addEventListener("click", (e) => {
    if (!menuDropdown.contains(e.target)) setMenu(false);
  });

  // Close with the Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setMenu(false);
      menuBtn.focus();
    }
  });
}