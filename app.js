// MSS Daily Dashboard - CSV Testing Mode with Persistent History
// ------------------------------------------------------------
// This version lets you:
//  - Upload one or more MSS reservation CSV exports
//  - Auto-merge them into a persistent history stored in the browser
//  - Drive all four dashboard quadrants off that history
//
// Expected headers (case-insensitive match):
// Name, Area Reserved, Reservation Date, Start Time, End Time,
// Title, Sport, Paid Status, Price, Form Of Payment

const STORAGE_KEY = "mssDashboardReservations_v1";
let reservations = []; // in-memory history
let currentRangeKey = "today";
let customRange = { start: null, end: null };

// ---------- Utilities ----------

function formatCurrency(amount) {
  if (!isFinite(amount)) return "$0.00";
  return "$" + amount.toFixed(2);
}

function toDateOnly(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return null;
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
}

function parseReservationDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Try MM/DD/YYYY
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
        return new Date(y, m - 1, d);
      }
    }
  }

  // Try YYYY-MM-DD (ISO)
  if (s.includes("-")) {
    const parts = s.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
        return new Date(y, m - 1, d);
      }
    }
  }

  const d = new Date(s);
  if (!isNaN(d)) return d;
  return null;
}

function parseStartDateTime(resDate, timeStr) {
  if (!(resDate instanceof Date) || isNaN(resDate)) return null;
  if (!timeStr) return null;
  const s = String(timeStr).trim();
  if (!s) return null;

  // Formats like "3:00 PM", "3 PM", "15:00"
  const ampmMatch = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([AaPp][Mm])$/);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    let minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return new Date(
      resDate.getFullYear(),
      resDate.getMonth(),
      resDate.getDate(),
      hour,
      minute
    );
  }

  const hhmm = s.match(/^(\d{1,2})(?::(\d{2}))$/);
  if (hhmm) {
    const hour = parseInt(hhmm[1], 10);
    const minute = parseInt(hhmm[2], 10);
    if (!isNaN(hour) && !isNaN(minute)) {
      return new Date(
        resDate.getFullYear(),
        resDate.getMonth(),
        resDate.getDate(),
        hour,
        minute
      );
    }
  }

  const hhOnly = s.match(/^(\d{1,2})$/);
  if (hhOnly) {
    const hour = parseInt(hhOnly[1], 10);
    if (!isNaN(hour)) {
      return new Date(
        resDate.getFullYear(),
        resDate.getMonth(),
        resDate.getDate(),
        hour,
        0
      );
    }
  }

  return null;
}

function needsSetupSport(sportVal) {
  if (!sportVal) return false;
  const s = String(sportVal).toLowerCase();
  return s.includes("volleyball") || s.includes("birthday");
}

function cleanPrice(raw) {
  if (raw === null || raw === undefined) return 0;
  const s = String(raw).replace(/[^0-9.\-]/g, "");
  if (!s) return 0;
  const v = parseFloat(s);
  return isNaN(v) ? 0 : v;
}

// ---------- CSV Parsing ----------

function detectSeparator(line) {
  if (line.includes("\t")) return "\t";
  return ","; // default
}

function splitCSVLine(line, sep) {
  if (!line) return [];
  if (sep === "\t") {
    return line.split("\t").map((v) => v.trim());
  }
  // Very simple CSV split (no quoted commas). Good enough for clean exports.
  return line.split(",").map((v) => v.trim());
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];

  const sep = detectSeparator(lines[0]);
  const headerCols = splitCSVLine(lines[0], sep);
  const headerMap = {};
  headerCols.forEach((h, idx) => {
    headerMap[h.trim().toLowerCase()] = idx;
  });

  const required = [
    "name",
    "area reserved",
    "reservation date",
    "start time",
    "end time",
    "title",
    "sport",
    "paid status",
    "price",
    "form of payment",
  ];
  const missing = required.filter((r) => !(r in headerMap));
  if (missing.length > 0) {
    throw new Error(
      "Missing expected columns in CSV: " + missing.join(", ")
    );
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCSVLine(line, sep);
    if (cols.length < headerCols.length) continue;

    const name = cols[headerMap["name"]];
    const area = cols[headerMap["area reserved"]];
    const resDateRaw = cols[headerMap["reservation date"]];
    const startTimeRaw = cols[headerMap["start time"]];
    const endTimeRaw = cols[headerMap["end time"]];
    const title = cols[headerMap["title"]];
    const sport = cols[headerMap["sport"]];
    const paidStatus = cols[headerMap["paid status"]];
    const priceRaw = cols[headerMap["price"]];
    const formOfPayment = cols[headerMap["form of payment"]];

    const resDate = parseReservationDate(resDateRaw);
    const startDateTime = parseStartDateTime(resDate, startTimeRaw);
    const startHour = startDateTime ? startDateTime.getHours() : null;
    const price = cleanPrice(priceRaw);
    const isFailed =
      String(paidStatus || "").trim().toLowerCase() === "failed";

    rows.push({
      name: name || "",
      area: area || "",
      reservationDate: resDate,
      reservationDateStr: resDate ? resDate.toISOString().slice(0, 10) : "",
      startTimeStr: startTimeRaw || "",
      endTimeStr: endTimeRaw || "",
      title: title || "",
      sport: sport || "",
      paidStatus: paidStatus || "",
      formOfPayment: formOfPayment || "",
      price,
      startDateTime,
      startHour,
      isFailed,
    });
  }

  return rows;
}

// ---------- Storage ----------

function saveReservationsToStorage() {
  const simple = reservations.map((r) => ({
    ...r,
    reservationDate: r.reservationDate
      ? r.reservationDate.toISOString()
      : null,
    startDateTime: r.startDateTime ? r.startDateTime.toISOString() : null,
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(simple));
}

function loadReservationsFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    reservations = [];
    return;
  }
  try {
    const arr = JSON.parse(raw);
    reservations = arr.map((r) => ({
      ...r,
      reservationDate: r.reservationDate
        ? new Date(r.reservationDate)
        : null,
      startDateTime: r.startDateTime ? new Date(r.startDateTime) : null,
    }));
  } catch (e) {
    console.error("Failed to parse stored reservations:", e);
    reservations = [];
  }
}

// ---------- Date Range Helpers ----------

function getReferenceToday() {
  if (reservations.length === 0) {
    return null;
  }
  let maxDate = null;
  reservations.forEach((r) => {
    if (!r.reservationDate) return;
    const d = toDateOnly(r.reservationDate);
    if (!maxDate || d > maxDate) maxDate = d;
  });
  return maxDate;
}

function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

function getDateRange(option) {
  const ref = getReferenceToday();
  if (!ref) return { start: null, end: null };

  if (option === "today") {
    return { start: ref, end: ref };
  }
  if (option === "yesterday") {
    const y = addDays(ref, -1);
    return { start: y, end: y };
  }
  if (option === "last_7_days") {
    const start = addDays(ref, -6);
    return { start, end: ref };
  }
  if (option === "last_30_days") {
    const start = addDays(ref, -29);
    return { start, end: ref };
  }
  if (option === "this_month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    return { start, end: ref };
  }
  if (option === "last_month") {
    let year = ref.getFullYear();
    let month = ref.getMonth() - 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
    const start = new Date(year, month, 1);
    const end = addDays(new Date(ref.getFullYear(), ref.getMonth(), 1), -1);
    return { start, end };
  }
  if (option === "this_year") {
    const start = new Date(ref.getFullYear(), 0, 1);
    return { start, end: ref };
  }
  if (option === "custom" && customRange.start && customRange.end) {
    return { start: customRange.start, end: customRange.end };
  }

  return { start: null, end: null };
}

// ---------- Dashboard Calculations ----------

function filterByDateRange(start, end) {
  if (!start || !end) return [];
  return reservations.filter((r) => {
    if (!r.reservationDate) return false;
    const d = toDateOnly(r.reservationDate);
    return d >= start && d <= end;
  });
}

function sumRevenue(rows) {
  return rows
    .filter((r) => !r.isFailed)
    .reduce((acc, r) => acc + (r.price || 0), 0);
}

function buildDashboard(rangeKey) {
  const statusEl = document.getElementById("upload-status-text");

  if (!reservations.length) {
    statusEl.textContent =
      "No data loaded. Upload one or more MSS CSV exports to populate the dashboard.";
    resetAllTablesToEmpty();
    return;
  }

  const { start, end } = getDateRange(rangeKey);
  if (!start || !end) {
    statusEl.textContent =
      "Could not determine a date range. Check that your CSV has valid Reservation Date values.";
    resetAllTablesToEmpty();
    return;
  }

  const rangeRows = filterByDateRange(start, end);

  const ref = getReferenceToday();
  statusEl.textContent =
    "Data loaded. Latest reservation date in history: " +
    (ref ? ref.toISOString().slice(0, 10) : "n/a") +
    ". Current filter: " +
    rangeKey.replace(/_/g, " ");

  document.getElementById("hourly-label").textContent =
    start.toISOString().slice(0, 10) +
    " to " +
    end.toISOString().slice(0, 10);

  // Q1: totals
  const totalRentals = rangeRows.length;
  const totalRevenue = sumRevenue(rangeRows);

  document.getElementById("total-rentals").textContent = totalRentals;
  document.getElementById("total-revenue").textContent =
    formatCurrency(totalRevenue);
  document.getElementById("rentals-trend").innerHTML =
    '<span class="arrow">●</span> Based on uploaded data';
  document.getElementById("revenue-trend").innerHTML =
    '<span class="arrow">●</span> Based on uploaded data';

  // Q1: hourly
  const hourlyMap = {};
  rangeRows.forEach((r) => {
    const h = r.startHour != null ? r.startHour : -1;
    if (!hourlyMap[h]) {
      hourlyMap[h] = { rentals: 0, revenue: 0 };
    }
    hourlyMap[h].rentals += 1;
    if (!r.isFailed) hourlyMap[h].revenue += r.price || 0;
  });

  const hourlyEntries = Object.entries(hourlyMap).sort(
    (a, b) => parseInt(a[0], 10) - parseInt(b[0], 10)
  );
  const hourlyBody = document.getElementById("hourly-table-body");
  hourlyBody.innerHTML = "";
  if (!hourlyEntries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="3" class="muted">No rentals in this date range.</td>';
    hourlyBody.appendChild(tr);
  } else {
    hourlyEntries.forEach(([hourStr, val]) => {
      const hourNum = parseInt(hourStr, 10);
      const label =
        hourNum >= 0
          ? `${hourNum.toString().padStart(2, "0")}:00`
          : "Unknown";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${label}</td>
        <td class="text-right">${val.rentals}</td>
        <td class="text-right">${formatCurrency(val.revenue)}</td>
      `;
      hourlyBody.appendChild(tr);
    });
  }

  // Q1: payment
  const payMap = {};
  rangeRows.forEach((r) => {
    const key = (r.formOfPayment || "Unknown").trim() || "Unknown";
    if (!payMap[key]) {
      payMap[key] = { rentals: 0, revenue: 0 };
    }
    payMap[key].rentals += 1;
    if (!r.isFailed) payMap[key].revenue += r.price || 0;
  });
  const payEntries = Object.entries(payMap).sort(
    (a, b) => b[1].rentals - a[1].rentals
  );
  const payBody = document.getElementById("payment-table-body");
  payBody.innerHTML = "";
  if (!payEntries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="3" class="muted">No rentals in this date range.</td>';
    payBody.appendChild(tr);
  } else {
    payEntries.forEach(([method, val]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${method}</td>
        <td class="text-right">${val.rentals}</td>
        <td class="text-right">${formatCurrency(val.revenue)}</td>
      `;
      payBody.appendChild(tr);
    });
  }

  // Q2: current vs prior + YTD vs last YTD
  const periodDays =
    (toDateOnly(end) - toDateOnly(start)) / (1000 * 60 * 60 * 24) + 1;
  const priorEnd = addDays(start, -1);
  const priorStart = addDays(priorEnd, -periodDays + 1);
  const priorRows = filterByDateRange(priorStart, priorEnd);

  const currentRentals = rangeRows.length;
  const currentRevenue = sumRevenue(rangeRows);
  const priorRentals = priorRows.length;
  const priorRevenue = sumRevenue(priorRows);

  document.getElementById("current-rentals").textContent = currentRentals;
  document.getElementById("current-revenue").textContent =
    formatCurrency(currentRevenue);
  document.getElementById("current-rentals-trend").innerHTML =
    '<span class="arrow">●</span> vs prior ' + periodDays + " days";
  document.getElementById("current-revenue-trend").innerHTML =
    '<span class="arrow">●</span> vs prior ' + periodDays + " days";

  const periodBody = document.getElementById("period-compare-body");
  periodBody.innerHTML = "";
  const periodMetrics = [
    {
      metric: "Rentals",
      current: currentRentals,
      prior: priorRentals,
      isMoney: false,
    },
    {
      metric: "Revenue",
      current: currentRevenue,
      prior: priorRevenue,
      isMoney: true,
    },
  ];
  periodMetrics.forEach((row) => {
    const delta = row.current - row.prior;
    const isPos = delta >= 0;
    const badgeClass = isPos ? "badge green" : "badge red";
    const label = row.isMoney
      ? formatCurrency(Math.abs(delta))
      : Math.abs(delta);
    const sign = isPos ? "+" : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.metric}</td>
      <td class="text-right">${
        row.isMoney ? formatCurrency(row.current) : row.current
      }</td>
      <td class="text-right">${
        row.isMoney ? formatCurrency(row.prior) : row.prior
      }</td>
      <td class="text-right">
        <span class="${badgeClass}">${sign}${label}</span>
      </td>
    `;
    periodBody.appendChild(tr);
  });

  // YTD vs last YTD
  const endDate = toDateOnly(end);
  const ytdStart = new Date(endDate.getFullYear(), 0, 1);
  const ytdRows = filterByDateRange(ytdStart, endDate);

  const lastYear = endDate.getFullYear() - 1;
  const lastYtdStart = new Date(lastYear, 0, 1);
  let lastYtdEnd;
  try {
    lastYtdEnd = new Date(
      lastYear,
      endDate.getMonth(),
      endDate.getDate()
    );
  } catch (e) {
    lastYtdEnd = new Date(lastYear, 11, 31);
  }
  const lastYtdRows = filterByDateRange(lastYtdStart, lastYtdEnd);

  const ytdRentals = ytdRows.length;
  const ytdRevenue = sumRevenue(ytdRows);
  const lastYtdRentals = lastYtdRows.length;
  const lastYtdRevenue = sumRevenue(lastYtdRows);

  const ytdBody = document.getElementById("ytd-compare-body");
  ytdBody.innerHTML = "";
  const ytdMetrics = [
    {
      metric: "Rentals",
      current: ytdRentals,
      last: lastYtdRentals,
      isMoney: false,
    },
    {
      metric: "Revenue",
      current: ytdRevenue,
      last: lastYtdRevenue,
      isMoney: true,
    },
  ];
  ytdMetrics.forEach((row) => {
    const delta = row.current - row.last;
    const isPos = delta >= 0;
    const badgeClass = isPos ? "badge green" : "badge red";
    const label = row.isMoney
      ? formatCurrency(Math.abs(delta))
      : Math.abs(delta);
    const sign = isPos ? "+" : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.metric}</td>
      <td class="text-right">${
        row.isMoney ? formatCurrency(row.current) : row.current
      }</td>
      <td class="text-right">${
        row.isMoney ? formatCurrency(row.last) : row.last
      }</td>
      <td class="text-right">
        <span class="${badgeClass}">${sign}${label}</span>
      </td>
    `;
    ytdBody.appendChild(tr);
  });

  // Q3: failed
  const failedInRange = rangeRows.filter((r) => r.isFailed);
  const failedAll = reservations.filter((r) => r.isFailed);

  const failedRangeBody = document.getElementById("failed-range-body");
  failedRangeBody.innerHTML = "";
  if (!failedInRange.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="5" class="muted">No failed payments in this date range.</td>';
    failedRangeBody.appendChild(tr);
    document.getElementById("failed-range-count").textContent = "0";
    document.getElementById("failed-range-caption").innerHTML =
      '<span class="arrow">●</span> No new failures';
  } else {
    let totalFailedRange = 0;
    failedInRange
      .slice()
      .sort((a, b) => b.reservationDate - a.reservationDate)
      .forEach((r) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${r.reservationDateStr}</td>
          <td>${r.name}</td>
          <td>${r.startTimeStr || ""}</td>
          <td>${r.area}</td>
          <td class="text-right">${formatCurrency(r.price)}</td>
        `;
        totalFailedRange += r.price || 0;
        failedRangeBody.appendChild(tr);
      });
    document.getElementById("failed-range-count").textContent =
      failedInRange.length;
    document.getElementById("failed-range-caption").innerHTML =
      '<span class="arrow">▲</span> ' +
      failedInRange.length +
      " failed / " +
      formatCurrency(totalFailedRange);
  }

  const failedOutBody = document.getElementById("failed-outstanding-body");
  failedOutBody.innerHTML = "";
  let totalOutstanding = 0;
  failedAll
    .slice()
    .sort((a, b) => b.reservationDate - a.reservationDate)
    .forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.reservationDateStr}</td>
        <td>${r.name}</td>
        <td>${r.startTimeStr || ""}</td>
        <td>${r.area}</td>
        <td class="text-right">${formatCurrency(r.price)}</td>
      `;
      totalOutstanding += r.price || 0;
      failedOutBody.appendChild(tr);
    });
  document.getElementById("failed-outstanding-amount").textContent =
    formatCurrency(totalOutstanding);
  document.getElementById("failed-outstanding-caption").innerHTML =
    '<span class="arrow">▲</span> ' +
    failedAll.length +
    " open items";

  // Q4: by sport / setup
  const sportMap = {};
  rangeRows.forEach((r) => {
    const key = (r.sport || "Unknown").trim() || "Unknown";
    if (!sportMap[key]) {
      sportMap[key] = { rentals: 0, revenue: 0 };
    }
    sportMap[key].rentals += 1;
    if (!r.isFailed) sportMap[key].revenue += r.price || 0;
  });
  const sportEntries = Object.entries(sportMap).sort(
    (a, b) => b[1].rentals - a[1].rentals
  );
  const sportBody = document.getElementById("sport-body");
  sportBody.innerHTML = "";
  if (!sportEntries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="3" class="muted">No rentals in this date range.</td>';
    sportBody.appendChild(tr);
  } else {
    sportEntries.forEach(([sport, val]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sport}</td>
        <td class="text-right">${val.rentals}</td>
        <td class="text-right">${formatCurrency(val.revenue)}</td>
      `;
      sportBody.appendChild(tr);
    });
  }

  const setupMap = {};
  rangeRows.forEach((r) => {
    if (!needsSetupSport(r.sport)) return;
    const key = (r.sport || "Unknown").trim() || "Unknown";
    if (!setupMap[key]) {
      setupMap[key] = { rentals: 0, revenue: 0 };
    }
    setupMap[key].rentals += 1;
    if (!r.isFailed) setupMap[key].revenue += r.price || 0;
  });
  const setupEntries = Object.entries(setupMap).sort(
    (a, b) => b[1].rentals - a[1].rentals
  );
  const setupBody = document.getElementById("setup-body");
  setupBody.innerHTML = "";
  if (!setupEntries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="3" class="muted">No setup-required rentals in this date range.</td>';
    setupBody.appendChild(tr);
  } else {
    setupEntries.forEach(([sport, val]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sport}</td>
        <td class="text-right">${val.rentals}</td>
        <td class="text-right">${formatCurrency(val.revenue)}</td>
      `;
      setupBody.appendChild(tr);
    });
  }

  // Sports & setup counts
  document.getElementById("sports-count").textContent = sportEntries.length;
  let setupCount = 0;
  setupEntries.forEach((e) => {
    setupCount += e[1].rentals;
  });
  document.getElementById("setup-count").textContent = setupCount;
}

function resetAllTablesToEmpty() {
  document.getElementById("total-rentals").textContent = "0";
  document.getElementById("total-revenue").textContent = "$0.00";
  document.getElementById("rentals-trend").innerHTML =
    '<span class="arrow">●</span> Waiting for data';
  document.getElementById("revenue-trend").innerHTML =
    '<span class="arrow">●</span> Waiting for data';

  const placeholders = {
    "hourly-table-body": 3,
    "payment-table-body": 3,
    "period-compare-body": 4,
    "ytd-compare-body": 4,
    "failed-range-body": 5,
    "failed-outstanding-body": 5,
    "sport-body": 3,
    "setup-body": 3,
  };

  Object.entries(placeholders).forEach(([id, cols]) => {
    const body = document.getElementById(id);
    if (!body) return;
    body.innerHTML = `<tr><td colspan="${cols}" class="muted">Upload data to populate this section.</td></tr>`;
  });

  document.getElementById("current-rentals").textContent = "0";
  document.getElementById("current-revenue").textContent = "$0.00";
  document.getElementById("current-rentals-trend").innerHTML =
    '<span class="arrow">●</span> Waiting for data';
  document.getElementById("current-revenue-trend").innerHTML =
    '<span class="arrow">●</span> Waiting for data';

  document.getElementById("failed-range-count").textContent = "0";
  document.getElementById("failed-range-caption").innerHTML =
    '<span class="arrow">●</span> Waiting for data';
  document.getElementById("failed-outstanding-amount").textContent = "$0.00";
  document.getElementById("failed-outstanding-caption").innerHTML =
    '<span class="arrow">●</span> Waiting for data';

  document.getElementById("sports-count").textContent = "0";
  document.getElementById("setup-count").textContent = "0";
}

// ---------- Event Wiring ----------

document.addEventListener("DOMContentLoaded", () => {
  loadReservationsFromStorage();

  const statusEl = document.getElementById("upload-status-text");
  if (reservations.length) {
    const ref = getReferenceToday();
    statusEl.textContent =
      "Loaded " +
      reservations.length +
      " rows from previous session. Latest reservation date: " +
      (ref ? ref.toISOString().slice(0, 10) : "n/a") +
      ".";
  }

  const buttons = document.querySelectorAll(".filter-btn");
  const customBtn = document.getElementById("custom-range-btn");
  const customInputs = document.getElementById("custom-range-inputs");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const rangeKey = btn.getAttribute("data-range");
      currentRangeKey = rangeKey;

      if (rangeKey === "custom") {
        customInputs.style.display = "flex";
      } else {
        customInputs.style.display = "none";
      }

      buildDashboard(currentRangeKey);
    });
  });

  document.getElementById("custom-start").addEventListener("change", (e) => {
    if (!e.target.value) return;
    customRange.start = new Date(e.target.value);
    if (customRange.end) {
      buildDashboard("custom");
    }
  });

  document.getElementById("custom-end").addEventListener("change", (e) => {
    if (!e.target.value) return;
    customRange.end = new Date(e.target.value);
    if (customRange.start) {
      buildDashboard("custom");
    }
  });

  const csvInput = document.getElementById("csv-input");
  csvInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const rows = parseCSV(text);
        if (!rows.length) {
          alert("No usable rows found in CSV.");
          return;
        }
        reservations = reservations.concat(rows);
        saveReservationsToStorage();
        const ref = getReferenceToday();
        statusEl.textContent =
          "Loaded " +
          rows.length +
          " new rows. Total stored: " +
          reservations.length +
          ". Latest reservation date: " +
          (ref ? ref.toISOString().slice(0, 10) : "n/a") +
          ".";
        buildDashboard(currentRangeKey);
      } catch (err) {
        console.error(err);
        alert(
          "Error reading CSV: " +
            err.message +
            "\\nCheck that the header row matches the expected MSS export."
        );
      } finally {
        csvInput.value = "";
      }
    };
    reader.readAsText(file);
  });

  document
    .getElementById("clear-data-btn")
    .addEventListener("click", () => {
      if (
        !confirm(
          "This will clear all stored reservation data in this browser for this dashboard. Continue?"
        )
      ) {
        return;
      }
      reservations = [];
      localStorage.removeItem(STORAGE_KEY);
      statusEl.textContent =
        "All stored data cleared. Upload CSV files to repopulate the dashboard.";
      resetAllTablesToEmpty();
    });

  // If we already have data, build the default view ("today")
  if (reservations.length) {
    buildDashboard(currentRangeKey);
  } else {
    resetAllTablesToEmpty();
  }
});
