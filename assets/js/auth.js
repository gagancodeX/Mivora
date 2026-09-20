const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userChip = document.getElementById("userChip");
const userName = document.getElementById("userName");
const userPhoto = document.getElementById("userPhoto");

async function loadCurrentUser() {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    const data = await response.json();

    if (data.authenticated && data.user) {
      if (loginBtn) loginBtn.style.display = "none";
      if (userChip) userChip.style.display = "flex";
      if (userName) userName.textContent = data.user.name?.split(" ")[0] || "You";
      if (userPhoto) {
        if (data.user.avatarUrl) {
          userPhoto.src = data.user.avatarUrl;
          userPhoto.style.display = "block";
        } else {
          userPhoto.style.display = "none";
        }
      }
    } else {
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (userChip) userChip.style.display = "none";
    }
  } catch (error) {
    console.error("Could not load Mivora session:", error);
  }
}

loginBtn?.addEventListener("click", () => {
  window.location.href = "/auth/google";
});

logoutBtn?.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST", credentials: "same-origin" });
  window.location.reload();
});

loadCurrentUser();

window.MivoraAuth = {
  async saveScore(game, score) {
    try {
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ game, score })
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};
