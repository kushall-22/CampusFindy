const profileStatus = document.getElementById("profileStatus");
const profileDetails = document.getElementById("profileDetails");
const token = localStorage.getItem("token");

async function loadProfile() {
  try {
    const response = await fetch(`${window.CAMPUSFINDY_API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("token");
        window.location.replace("login.html");
        return;
      }

      profileStatus.textContent = data.message || "Could not load your profile.";
      return;
    }

    if (!data.user || typeof data.user.name !== "string" ||
        typeof data.user.email !== "string" || typeof data.user.role !== "string") {
      profileStatus.textContent = "Could not load your profile: invalid server response.";
      return;
    }

    document.getElementById("profileName").value = data.user.name;
    document.getElementById("profileEmail").value = data.user.email;
    document.getElementById("profileRole").value =
      data.user.role.charAt(0).toUpperCase() + data.user.role.slice(1);
    profileDetails.hidden = false;
    profileStatus.hidden = true;
  } catch (error) {
    console.error("CampusFindy profile error:", error);
    profileStatus.textContent = error instanceof TypeError
      ? "Could not reach the server. Check that the backend is running."
      : "Could not load your profile. Please try again.";
  }
}

if (!token) {
  window.location.replace("login.html");
} else {
  loadProfile();
}
