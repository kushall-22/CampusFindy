const forgotPasswordForm = document.getElementById("forgotPasswordForm");
const forgotPasswordButton = document.getElementById("forgotPasswordButton");
const statusMessage = document.getElementById("statusMessage");

forgotPasswordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  forgotPasswordButton.disabled = true;
  statusMessage.textContent = "Sending request…";

  try {
    const response = await fetch(
      `${window.CAMPUSFINDY_API_BASE}/auth/forgot-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: document.getElementById("email").value.trim(),
        }),
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Could not request a password reset.");
    }

    statusMessage.textContent = data.message;
  } catch (error) {
    console.error("Password reset request failed:", error);
    statusMessage.textContent =
      error.message || "Could not reach the server. Please try again.";
  } finally {
    forgotPasswordButton.disabled = false;
  }
});
