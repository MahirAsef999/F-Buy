document.addEventListener("DOMContentLoaded", async () => {
  // ✅ REQUIRE LOGIN
  try {
    await requireAuth();
  } catch (error) {
    return;
  }

  const summaryEl = document.getElementById("order-summary");
  const calcEl = document.getElementById("order-calculations");

  const firstInput = document.getElementById("first-name");
  const lastInput = document.getElementById("last-name");
  const emailInput = document.getElementById("email");
  const addrInput = document.getElementById("address");
  const phoneInput = document.getElementById("phone-number");

  const cardNumberEl = document.getElementById("card-number");
  const expEl = document.getElementById("card-expiration");
  const cvvEl = document.getElementById("card-cvv");

  // Track if user has edited fields
  const touched = {
    first: false,
    last: false,
    email: false,
    addr: false,
    phone: false,
    cardNumber: false,
    exp: false,
    cvv: false,
  };

  if (firstInput) firstInput.addEventListener("input", () => (touched.first = true));
  if (lastInput) lastInput.addEventListener("input", () => (touched.last = true));
  if (emailInput) emailInput.addEventListener("input", () => (touched.email = true));
  if (addrInput) addrInput.addEventListener("input", () => (touched.addr = true));
  if (phoneInput) phoneInput.addEventListener("input", () => (touched.phone = true));
  if (cardNumberEl) cardNumberEl.addEventListener("input", () => (touched.cardNumber = true));
  if (expEl) expEl.addEventListener("input", () => (touched.exp = true));
  if (cvvEl) cvvEl.addEventListener("input", () => (touched.cvv = true));

  // ✅ AUTOFILL NAME, EMAIL, PHONE, ADDRESS FROM DATABASE
  try {
    const account = await authedApi("/account/me");
    console.log("✓ Loaded account for checkout:", account);

    // First name
    if (firstInput && !touched.first && !firstInput.value && account.first_name) {
      firstInput.value = account.first_name;
    }

    // Last name
    if (lastInput && !touched.last && !lastInput.value && account.last_name) {
      lastInput.value = account.last_name;
    }

    // Email
    if (emailInput && !touched.email && !emailInput.value && account.email) {
      emailInput.value = account.email;
    }

    // Phone (use phone first, fallback to shipping_phone)
    if (phoneInput && !touched.phone && !phoneInput.value) {
      const phoneNumber = account.phone || account.shipping_phone;
      if (phoneNumber) phoneInput.value = phoneNumber;
    }

    // ✅ ADDRESS - BUILD FROM YOUR ADDRESS-EDIT FORMAT
    if (addrInput && !touched.addr && !addrInput.value) {
      const parts = [];
      
      // Street
      if (account.shipping_street) parts.push(account.shipping_street);
      
      // City
      if (account.shipping_city) parts.push(account.shipping_city);
      
      // State (if US) OR Province (if international)
      if (account.shipping_state && account.shipping_state !== "NON_US") {
        parts.push(account.shipping_state);
      } else if (account.shipping_province) {
        parts.push(account.shipping_province);
      }
      
      // Zip
      if (account.shipping_zip) parts.push(account.shipping_zip);
      
      // Country (only if not US)
      if (account.shipping_country && account.shipping_country !== "United States") {
        parts.push(account.shipping_country);
      }
      
      if (parts.length > 0) {
        addrInput.value = parts.join(", ");
        console.log("✓ Autofilled address:", addrInput.value);
      }
    }
  } catch (err) {
    console.warn("Could not load account for autofill:", err);
  }

  // ✅ AUTOFILL PAYMENT FROM DEFAULT CARD (INCLUDING CVV)
  try {
    const defaultMethod = await authedApi("/payment-methods/default");

    if (defaultMethod) {
      console.log("✓ Loaded default payment method");

      // Card number (masked)
      if (cardNumberEl && !touched.cardNumber && !cardNumberEl.value) {
        const last4 = defaultMethod.lastFourDigits || defaultMethod.last4 || "****";
        cardNumberEl.value = "**** **** **** " + last4;
      }

      // Expiration
      if (expEl && !touched.exp && !expEl.value) {
        if (defaultMethod.expiryDate) {
          expEl.value = defaultMethod.expiryDate;
        } else if (defaultMethod.expMonth && defaultMethod.expYear) {
          const mm = String(defaultMethod.expMonth).padStart(2, "0");
          const yy = String(defaultMethod.expYear).slice(-2);
          expEl.value = `${mm}/${yy}`;
        }
      }

      // ✅ CVV - AUTOFILL FROM DATABASE
      if (cvvEl && !touched.cvv && !cvvEl.value && defaultMethod.cvv) {
        cvvEl.value = defaultMethod.cvv;
        console.log("✓ Autofilled CVV");
      }
    }
  } catch (err) {
    console.warn("No default payment method found:", err);
  }

  // ✅ LOAD CART
  try {
    const cart = await authedApi("/cart");
    console.log("✓ Loaded cart:", cart);

    if (!cart.items || cart.items.length === 0) {
      summaryEl.textContent = "Your cart is empty.";
      calcEl.textContent = "";
      return;
    }

    let subtotal = 0;
    summaryEl.innerHTML = "";

    cart.items.forEach((item) => {
      const lineTotal = item.price * item.qty;
      subtotal += lineTotal;

      const div = document.createElement("div");
      div.textContent = `${item.productName || item.productId} x${item.qty}: $${lineTotal.toFixed(2)}`;
      summaryEl.appendChild(div);
    });

    const taxRate = 0.08;
    const tax = Math.round(subtotal * taxRate * 100) / 100;
    const total = subtotal + tax;

    calcEl.innerHTML =
      `Subtotal: $${subtotal.toFixed(2)}<br>` +
      `Tax: $${tax.toFixed(2)}<br>` +
      `Total: $${total.toFixed(2)}`;
  } catch (e) {
    console.error("Failed to load cart:", e);
    summaryEl.textContent = "Failed to load order.";
    calcEl.textContent = "";
  }

  // ✅ PLACE ORDER
  const btn = document.getElementById("place-order");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const first = firstInput.value.trim();
    const last = lastInput.value.trim();
    const address = addrInput.value.trim();
    const phone = phoneInput.value.trim();
    const email = emailInput.value.trim();
    const cardNumber = cardNumberEl.value.trim();
    const exp = expEl.value.trim();
    const cvv = cvvEl.value.trim();

    if (!first || !last || !address || !phone || !email || !cardNumber || !exp || !cvv) {
      alert("Please fill out all fields.");
      return;
    }

    try {
      // Create order
      const order = await authedApi("/orders", {
        method: "POST",
        body: JSON.stringify({
          shippingName: `${first} ${last}`,
          shippingEmail: email,
          shippingPhone: phone,
          shippingAddress: address,
        }),
      });

      console.log("✓ Order created:", order);

      // Process payment
      await authedApi("/payments/mock", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id }),
      });

      console.log("✓ Payment processed for order:", order.id);

      alert(
        `✓ Order placed successfully!\nOrder ID: ${order.id}\nTotal: $${order.total.toFixed(2)}`
      );
      window.location.href = "main.html";
    } catch (e) {
      console.error("Failed to place order:", e);
      alert("Failed to place order: " + e.message);
    }
  });
});















