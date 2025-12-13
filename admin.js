const API_BASE = "http://127.0.0.1:8000"; // change to deployed URL later

const tbody = document.getElementById("ordersTbody");
const msgEl = document.getElementById("msg");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("searchInput");
const adminEmailEl = document.getElementById("adminEmail");

function getToken() {
  return localStorage.getItem("token");
}

function parseJwt(token) {
  if (!token) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function showMsg(text, type = "") {
  msgEl.textContent = text;
  msgEl.classList.remove("hidden", "error");
  if (type === "error") msgEl.classList.add("error");
}

function hideMsg() {
  msgEl.classList.add("hidden");
}

async function authedFetch(path, options = {}) {
  const token = getToken();
  if (!token) {
    window.location.href = "./loginauth.html"; 
    return;
  }

  const headers = options.headers || {};
  headers["Authorization"] = `Bearer ${token}`;
  headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function matchesFilters(order) {
  const wantedStatus = (statusFilter.value || "").trim().toLowerCase();
  if (wantedStatus && (order.status || "").toLowerCase() !== wantedStatus) return false;

  const q = (searchInput.value || "").trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    order.id,
    order.shippingEmail,
    order.shippingName,
    order.shippingAddress,
    String(order.userId),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function renderOrders(orders) {
  tbody.innerHTML = "";

  const filtered = orders.filter(matchesFilters);

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8" class="muted">No matching orders.</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const o of filtered) {
    const tr = document.createElement("tr");

    const itemsHtml = (o.items || [])
      .map(
        (it) => `
        <div class="item-row">
          <div class="item-left">
            <div><b>${it.productName || it.productId}</b></div>
            <div class="muted">Product ID: ${it.productId}</div>
          </div>
          <div>
            <div>Qty: <b>${it.qty}</b></div>
            <div>${money(it.price)}</div>
          </div>
        </div>
      `
      )
      .join("");

    tr.innerHTML = `
      <td>
        <div><b>${o.id}</b></div>
        <div class="muted">Subtotal: ${money(o.subtotal)} | Tax: ${money(o.tax)}</div>
      </td>
      <td>
        <div class="pill">User ID: ${o.userId}</div>
      </td>
      <td>
        <div>${formatDate(o.createdAt)}</div>
        <div class="muted">Paid: ${o.paidAt ? formatDate(o.paidAt) : "-"}</div>
      </td>
      <td><b>${money(o.total)}</b></td>
      <td><span class="pill">${o.status}</span></td>
      <td>
        <div><b>${o.shippingName || "-"}</b></div>
        <div class="muted">${o.shippingEmail || "-"}</div>
        <div class="muted">${o.shippingPhone || "-"}</div>
        <div class="muted">${o.shippingAddress || "-"}</div>
      </td>
      <td>
        <div class="items">${itemsHtml}</div>
      </td>
      <td>
        <div class="update-wrap">
          <select data-order-id="${o.id}">
            ${["pending","paid","shipped","delivered","failed","cancelled"]
              .map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
          <button class="btn" data-save="${o.id}">Save</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  }

  // Wire up save buttons
  tbody.querySelectorAll("button[data-save]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.getAttribute("data-save");
      const sel = tbody.querySelector(`select[data-order-id="${orderId}"]`);
      const newStatus = sel.value;

      btn.disabled = true;
      hideMsg();

      try {
        const res = await authedFetch(`/api/admin/orders/${orderId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        });

        if (!res) return;

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg = (data?.errors && data.errors[0]?.msg) || data?.message || "Admin update failed";
          showMsg(msg, "error");
          return;
        }

        showMsg(`Updated ${orderId} → ${newStatus}`);
        await loadOrders(); // refresh
      } catch (e) {
        showMsg("Network/server error", "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function loadOrders() {
  hideMsg();
  tbody.innerHTML = `<tr><td colspan="8" class="muted">Loading...</td></tr>`;

  const res = await authedFetch("/api/admin/orders", { method: "GET" });
  if (!res) return;

  const data = await res.json().catch(() => []);

  if (!res.ok) {
    const msg =
      (data?.errors && data.errors[0]?.msg) ||
      data?.message ||
      `Failed to load admin orders (HTTP ${res.status})`;
    showMsg(msg, "error");
    tbody.innerHTML = "";
    return;
  }

  renderOrders(Array.isArray(data) ? data : []);
}

function init() {
  const token = getToken();
  const payload = parseJwt(token);
  adminEmailEl.textContent = payload?.email ? `Signed in: ${payload.email}` : "";

  refreshBtn.addEventListener("click", loadOrders);
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = "./auth.html";
  });

  statusFilter.addEventListener("change", loadOrders);
  searchInput.addEventListener("input", () => {
    loadOrders();
  });

  loadOrders();
}

document.addEventListener("DOMContentLoaded", init);
