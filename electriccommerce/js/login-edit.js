/**
 * login-edit.js - FIXED VERSION
 * User login credentials editor
 * Requires authentication
 */

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ REQUIRE AUTHENTICATION
  try {
    await requireAuth();
  } catch (error) {
    return;
  }

  // Load account info
  await loadAccountInfo();
  setupSaveButtons();
});

async function loadAccountInfo() {
  try {
    const data = await authedApi("/account/me");

    document.getElementById("first-name-input").value = data.first_name || "";
    document.getElementById("last-name-input").value = data.last_name || "";
    document.getElementById("email-input").value = data.email || "";
    document.getElementById("phone-input").value = data.shipping_phone || "";
    document.getElementById("password-input").value = "";
  } catch (err) {
    console.error("Failed to load account info:", err);
    alert("Could not load account information.");
  }
}

function showSaved(fieldLabel) {
  alert(fieldLabel + " updated successfully.");
}

function setupSaveButtons() {
  const buttons = document.querySelectorAll(".save-changes");
  const firstNameBtn = buttons[0];
  const lastNameBtn = buttons[1];
  const emailBtn = buttons[2];
  const phoneBtn = buttons[3];
  const passwordBtn = buttons[4];

  // First name
  firstNameBtn.addEventListener("click", async () => {
    const value = document.getElementById("first-name-input").value.trim();
    if (!value) {
      alert("First name cannot be empty.");
      return;
    }
    if (value.length < 2) {
      alert("First name must be at least 2 characters.");
      return;
    }
    try {
      await authedApi("/account/me", {
        method: "PUT",
        body: JSON.stringify({ first_name: value }),
      });
      showSaved("First name");
    } catch (err) {
      console.error(err);
      alert("Failed to update first name.");
    }
  });

  // Last name
  lastNameBtn.addEventListener("click", async () => {
    const value = document.getElementById("last-name-input").value.trim();
    if (!value) {
      alert("Last name cannot be empty.");
      return;
    }
    if (value.length < 2) {
      alert("Last name must be at least 2 characters.");
      return;
    }
    try {
      await authedApi("/account/me", {
        method: "PUT",
        body: JSON.stringify({ last_name: value }),
      });
      showSaved("Last name");
    } catch (err) {
      console.error(err);
      alert("Failed to update last name.");
    }
  });

  // Email
  emailBtn.addEventListener("click", async () => {
    const value = document.getElementById("email-input").value.trim();
    if (!value) {
      alert("Email cannot be empty.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      alert("Please enter a valid email address.");
      return;
    }
    try {
      await authedApi("/account/me", {
        method: "PUT",
        body: JSON.stringify({ email: value }),
      });
      showSaved("Email");
    } catch (err) {
      console.error(err);
      if (String(err.message).includes("1062") || String(err.message).includes("Duplicate")) {
        alert("That email is already in use.");
      } else {
        alert("Failed to update email.");
      }
    }
  });

  // Phone
  phoneBtn.addEventListener("click", async () => {
    const value = document.getElementById("phone-input").value.trim();
    if (!value) {
      alert("Phone number cannot be empty.");
      return;
    }
    try {
      await authedApi("/account/me", {
        method: "PUT",
        body: JSON.stringify({ shipping_phone: value }),
      });
      showSaved("Phone number");
    } catch (err) {
      console.error(err);
      alert("Failed to update phone number.");
    }
  });

  // Password
  passwordBtn.addEventListener("click", async () => {
    const value = document.getElementById("password-input").value;
    if (!value) {
      alert("Password cannot be empty.");
      return;
    }
    if (value.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    try {
      // ✅ FIX: Added missing "method:" keyword
      await authedApi("/account/me", {
        method: "PUT",
        body: JSON.stringify({ password: value }),
      });
      showSaved("Password");
      document.getElementById("password-input").value = "";
    } catch (err) {
      console.error(err);
      alert("Failed to update password.");
    }
  });
}