document.querySelectorAll("[data-toggle-password]").forEach((toggle) => {
  const passwordInput = document.getElementById(toggle.getAttribute("aria-controls"));

  if (!(passwordInput instanceof HTMLInputElement)) {
    throw new Error("Password toggle must reference an input field.");
  }

  toggle.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    toggle.textContent = showPassword ? "Hide" : "Show";
    toggle.setAttribute("aria-label", `${showPassword ? "Hide" : "Show"} password`);
    toggle.setAttribute("aria-pressed", String(showPassword));
  });
});
