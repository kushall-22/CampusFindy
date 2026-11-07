const verifyEmailForm = document.getElementById("verifyEmailForm");
const emailInputFallback = document.getElementById("emailInput");
const emailFallback = document.getElementById("emailFallback");
const codeInputs = Array.from(
  document.querySelectorAll("#codeInputs input")
);
const verifyButton = document.getElementById("verifyButton");
const resendCodeBtn = document.getElementById("resendCodeBtn");
const signupEmail = new URLSearchParams(window.location.search).get("email");

function getEmail() {
  return signupEmail
    ? signupEmail.trim()
    : emailInputFallback.value.trim();
}

if (signupEmail) {
  emailFallback.hidden = true;
} else {
  emailFallback.hidden = false;
  emailInputFallback.required = true;
}

function setCode(code) {
  const digits = code.replace(/\D/g, "").slice(0, codeInputs.length);
  codeInputs.forEach((input, index) => {
    input.value = digits[index] || "";
  });
  const nextEmpty = codeInputs.find((input) => !input.value);
  (nextEmpty || codeInputs[codeInputs.length - 1]).focus();
}

codeInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    if (input.value.length > 1) {
      setCode(input.value);
      return;
    }

    input.value = input.value.replace(/\D/g, "");
    if (input.value && index < codeInputs.length - 1) {
      codeInputs[index + 1].focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && index > 0) {
      codeInputs[index - 1].focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      codeInputs[index - 1].focus();
    } else if (event.key === "ArrowRight" && index < codeInputs.length - 1) {
      codeInputs[index + 1].focus();
    }
  });

  input.addEventListener("paste", (event) => {
    const pastedCode = event.clipboardData?.getData("text");
    if (pastedCode && /\d/.test(pastedCode)) {
      event.preventDefault();
      setCode(pastedCode);
    }
  });
});

verifyEmailForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = getEmail();
  const code = codeInputs.map((input) => input.value).join("");
  if (!email) {
    window.alert("Enter your email address.");
    emailInputFallback.focus();
    return;
  }
  if (!/^\d{6}$/.test(code)) {
    window.alert("Enter the 6-digit verification code.");
    codeInputs.find((input) => !input.value)?.focus();
    return;
  }

  verifyButton.disabled = true;
  resendCodeBtn.disabled = true;
  verifyButton.textContent = "Verifying…";

  try {
    const response = await fetch(`${window.CAMPUSFINDY_API_BASE}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
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
    window.alert(error.message || "Could not reach the server. Please try again.");
  } finally {
    verifyButton.disabled = false;
    verifyButton.textContent = "Verify";
    resendCodeBtn.disabled = false;
  }
});

resendCodeBtn.addEventListener("click", async () => {
  const email = getEmail();
  if (!email) {
    window.alert("Enter your email address first.");
    emailInputFallback.focus();
    return;
  }

  verifyButton.disabled = true;
  resendCodeBtn.disabled = true;
  resendCodeBtn.textContent = "Sending…";

  try {
    const response = await fetch(
      `${window.CAMPUSFINDY_API_BASE}/auth/resend-verification`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Could not resend the verification code.");
    }

    codeInputs.forEach((input) => {
      input.value = "";
    });
    codeInputs[0].focus();
    window.alert(data.message);
  } catch (error) {
    console.error("Verification code resend failed:", error);
    window.alert(error.message || "Could not reach the server. Please try again.");
  } finally {
    verifyButton.disabled = false;
    resendCodeBtn.disabled = false;
    resendCodeBtn.textContent = "Resend code";
  }
});

codeInputs[0].focus();
