const feedbackForm = document.getElementById("feedbackForm");
const feedbackStatus = document.getElementById("feedbackStatus");
const sendFeedbackBtn = document.getElementById("sendFeedbackBtn");

feedbackForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  sendFeedbackBtn.disabled = true;
  feedbackStatus.textContent = "Sending your feedback…";

  try {
    const response = await fetch(`${window.CAMPUSFINDY_API_BASE}/auth/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify({
        category: document.getElementById("feedbackCategory").value,
        message: document.getElementById("feedbackMessage").value.trim(),
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "Could not send your feedback.");
    }

    feedbackForm.reset();
    feedbackStatus.textContent = data.message;
  } catch (error) {
    console.error("Could not send feedback:", error);
    feedbackStatus.textContent =
      error.message || "Could not reach the server. Please try again.";
  } finally {
    sendFeedbackBtn.disabled = false;
  }
});
