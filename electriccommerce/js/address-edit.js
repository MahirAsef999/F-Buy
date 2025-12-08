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

    console.log("Loaded account data:", account); // Debug log

    // Load US address fields
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

    // ✅ Load NON-US fields (province/country) from database
    const provinceInput = document.getElementById("province-input");
    const countryInput = document.getElementById("country-input");
    
    if (account.shipping_province && provinceInput) {
      provinceInput.value = account.shipping_province;
    }
    if (account.shipping_country && countryInput) {
      countryInput.value = account.shipping_country;
    }

    toggleNonUsFields();
  } catch (err) {
    console.error("Failed to load address:", err);
    alert("Could not load address information: " + err.message);
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

  // ✅ SAVE province/country to database
  const provinceInput = document.getElementById("province-input");
  const countryInput = document.getElementById("country-input");
  
  if (provinceInput) {
    payload.shipping_province = provinceInput.value.trim();
  }
  if (countryInput) {
    payload.shipping_country = countryInput.value.trim();
  }

  console.log("Saving address data:", payload); // Debug log

  try {
    const response = await authedApi("/account/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    
    console.log("Save response:", response); // Debug log
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