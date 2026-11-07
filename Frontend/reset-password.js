const resetPasswordForm = document.getElementById("resetPasswordForm");
const resetPasswordButton = document.getElementById("resetPasswordButton");
const resetStatusMessage = document.getElementById("statusMessage");
const resetToken = new URLSearchParams(window.location.search).get("token");

if (!resetToken) {
  resetStatusMessage.textContent =
    "This password reset link is invalid or missing. Request a new one.";
  resetPasswordForm.hidden = true;
} else {
  resetPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    resetPasswordButton.disabled = true;
    resetStatusMessage.textContent = "Resetting password…";

    try {
      const response = await fetch(
        `${window.CAMPUSFINDY_API_BASE}/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: resetToken,
            password: document.getElementById("newPassword").value,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not reset your password.");
      }

      resetStatusMessage.textContent = data.message;
      resetPasswordForm.hidden = true;
    } catch (error) {
      console.error("Password reset failed:", error);
      resetStatusMessage.textContent =
        error.message || "Could not reach the server. Please try again.";
    } finally {
      resetPasswordButton.disabled = false;
    }
  });
}
