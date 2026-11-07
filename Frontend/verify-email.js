const verifyEmailForm = document.getElementById("verifyEmailForm");
const verificationStatus = document.getElementById("statusMessage");
const emailInput = document.getElementById("email");
const codeInput = document.getElementById("code");
const signupEmail = new URLSearchParams(window.location.search).get("email");

if (signupEmail) {
  emailInput.value = signupEmail;
}

verifyEmailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = event.submitter ? event.submitter.value : "verify";
  const buttons = verifyEmailForm.querySelectorAll('button[type="submit"]');
  buttons.forEach((button) => {
    button.disabled = true;
  });

  try {
    if (action === "resend") {
      verificationStatus.textContent = "Sending a new code…";
      const response = await fetch(
        `${window.CAMPUSFINDY_API_BASE}/auth/resend-verification`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailInput.value.trim() }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Could not resend the verification code.");
      }

      codeInput.value = "";
      verificationStatus.textContent = data.message;
      return;
    }

    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
      throw new Error("Enter the 6-digit verification code from your email.");
    }

    verificationStatus.textContent = "Verifying your code…";
    const response = await fetch(
      `${window.CAMPUSFINDY_API_BASE}/auth/verify-email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.value.trim(), code }),
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Could not verify your email.");
    }

    if (typeof data.token !== "string" || !data.token) {
      throw new Error("Email verified, but the server did not create a login session. Please log in.");
    }

    localStorage.setItem("token", data.token);
    if (typeof data.name === "string") {
      localStorage.setItem("userName", data.name);
    }
    if (typeof data.email === "string") {
      localStorage.setItem("userEmail", data.email);
    }
    window.location.replace("dashboard.html");
  } catch (error) {
    console.error("Email verification failed:", error);
    verificationStatus.textContent =
      error.message || "Could not reach the server. Please try again.";
  } finally {
    buttons.forEach((button) => {
      button.disabled = false;
    });
  }
});
