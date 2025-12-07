/**
 * checkout.js - Checkout page with database-only data
 * ALL data from MySQL - NO localStorage except token
 * Requires authentication - guests blocked
 */

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ BLOCK GUESTS - REQUIRE AUTHENTICATION
  try {
    await requireAuth();
  } catch (error) {
    return; // Redirected to login
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

  // Track which fields the user has edited
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

  // ✅ AUTOFILL SHIPPING FROM DATABASE (/account/me)
  try {
    const account = await authedApi("/account/me");

    if (account) {
      // First name
      if (firstInput && !touched.first && !firstInput.value) {
        firstInput.value = account.first_name || "";
      }

      // Last name
      if (lastInput && !touched.last && !lastInput.value) {
        lastInput.value = account.last_name || "";
      }

      // Email
      if (emailInput && !touched.email && !emailInput.value) {
        emailInput.value = account.email || "";
      }

      // Build full address from shipping fields
      if (addrInput && !touched.addr && !addrInput.value) {
        if (
          account.shipping_street ||
          account.shipping_city ||
          account.shipping_state ||
          account.shipping_zip
        ) {
          const parts = [
            account.shipping_street || "",
            account.shipping_city || "",
            account.shipping_state || "",
            account.shipping_zip || "",
          ].filter(Boolean);
          addrInput.value = parts.join(", ");
        } else if (account.address) {
          // Fallback to old single address field
          addrInput.value = account.address;
        }
      }

      // Phone
      if (phoneInput && !touched.phone && !phoneInput.value && account.shipping_phone) {
        phoneInput.value = account.shipping_phone;
      }
    }
  } catch (err) {
    console.warn("Could not load account info for checkout:", err);
  }

  // ✅ AUTOFILL PAYMENT FROM DEFAULT CARD (DATABASE)
  try {
    const defaultMethod = await authedApi("/payment-methods/default");

    if (defaultMethod) {
      // Card number (masked)
      if (cardNumberEl && !touched.cardNumber && !cardNumberEl.value) {
        const last4 = defaultMethod.lastFourDigits || defaultMethod.last4 || "****";
        cardNumberEl.value = "**** **** **** " + last4;
      }

      // Expiration
      if (expEl && !touched.exp && !expEl.value) {
        if (defaultMethod.expiryDate) {
          expEl.value = defaultMethod.expiryDate; // e.g. "01/28"
        } else if (defaultMethod.expMonth && defaultMethod.expYear) {
          const mm = String(defaultMethod.expMonth).padStart(2, "0");
          const yy = String(defaultMethod.expYear).slice(-2);
          expEl.value = `${mm}/${yy}`;
        }
      }

      // Use cardholder name to backfill first/last if empty
      const cardholder = defaultMethod.cardholderName || defaultMethod.cardholder_name || "";
      if (cardholder) {
        const parts = cardholder.trim().split(/\s+/);
        if (firstInput && !touched.first && !firstInput.value && parts[0]) {
          firstInput.value = parts[0];
        }
        if (lastInput && !touched.last && !lastInput.value && parts.length > 1) {
          lastInput.value = parts.slice(1).join(" ");
        }
      }
    }
  } catch (err) {
    console.warn("No default payment method found.", err);
  }

  // ✅ LOAD CART (AUTHENTICATED - from database)
  try {
    const cart = await authedApi("/cart");

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

  // ✅ PLACE ORDER (AUTHENTICATED)
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
      // Create order (tied to logged-in user via JWT)
      const order = await authedApi("/orders", {
        method: "POST",
        body: JSON.stringify({
          shippingName: `${first} ${last}`,
          shippingEmail: email,
          shippingPhone: phone,
          shippingAddress: address,
        }),
      });

      // Process mock payment
      await authedApi("/payments/mock", {
        method: "POST",
        body: JSON.stringify({ orderId: order.id }),
      });

      alert(
        `Order placed successfully!\nOrder ID: ${order.id}\nTotal: $${order.total.toFixed(2)}`
      );
      window.location.href = "main.html";
    } catch (e) {
      console.error("Failed to place order:", e);
      alert("Failed to place order: " + e.message);
    }
  });
});