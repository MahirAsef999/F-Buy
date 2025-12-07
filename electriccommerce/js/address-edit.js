document.addEventListener("DOMContentLoaded", async () => {
  // ✅ REQUIRE AUTHENTICATION
  try {
    await requireAuth();
  } catch (error) {
    return;
  }

  // ✅ Load existing address FROM DATABASE
  try {
    const account = await authedApi("/account/me");

    if (account.shipping_street) {
      document.getElementById("street-input").value = account.shipping_street;
    }
    if (account.shipping_city) {
      document.getElementById("city-input").value = account.shipping_city;
    }
    if (account.shipping_state) {
      document.getElementById("state-select").value = account.shipping_state;
    }
    if (account.shipping_zip) {
      document.getElementById("zip-input").value = account.shipping_zip;
    }
    if (account.shipping_phone && document.getElementById("phone-input")) {
      document.getElementById("phone-input").value = account.shipping_phone;
    }

    toggleNonUsFields();
  } catch (err) {
    console.error("Failed to load address:", err);
    alert("Could not load address information.");
  }

  // State selector toggle
  const stateSelect = document.getElementById("state-select");
  stateSelect.addEventListener("change", toggleNonUsFields);

  // Save buttons
  document.querySelectorAll(".save-changes").forEach((btn) => {
    btn.addEventListener("click", async (evt) => {
      evt.preventDefault();
      await saveAddress();
    });
  });
});

async function saveAddress() {
  const payload = {
    shipping_street: document.getElementById("street-input").value.trim(),
    shipping_city: document.getElementById("city-input").value.trim(),
    shipping_state: document.getElementById("state-select").value,
    shipping_zip: document.getElementById("zip-input").value.trim(),
  };

  const phoneEl = document.getElementById("phone-input");
  if (phoneEl) {
    payload.shipping_phone = phoneEl.value.trim();
  }

  // ✅ REMOVED: localStorage for province/country
  // TODO: Add province/country fields to MySQL database if needed

  try {
    await authedApi("/account/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    alert("Address saved successfully!");
  } catch (err) {
    console.error("Failed to save address:", err);
    alert("Could not save address: " + err.message);
  }
}

function toggleNonUsFields() {
  const stateSelect = document.getElementById("state-select");
  const provinceBox = document.getElementById("province-box");
  const countryBox = document.getElementById("country-box");
  const isNonUs = stateSelect.value === "NON_US";

  if (provinceBox) provinceBox.style.display = isNonUs ? "flex" : "none";
  if (countryBox) countryBox.style.display = isNonUs ? "flex" : "none";
}