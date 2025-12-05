// Simple demo data + wiring. In production, your developer will
// replace this with live MSS data fetched from your backend or API.

const demoData = {
  today: {
    totalRentals: 7,
    totalRevenue: 676.75,
    rentalsTrendLabel: "+2 vs prior",
    revenueTrendLabel: "+15% vs prior",
    hourly: [
      { hour: "9:00", rentals: 1, revenue: 136.5 },
      { hour: "13:00", rentals: 1, revenue: 36.75 },
      { hour: "14:00", rentals: 1, revenue: 67.2 },
      { hour: "15:00", rentals: 1, revenue: 63.0 },
      { hour: "16:00", rentals: 1, revenue: 16.8 },
    ],
    payments: [
      { method: "Credit", rentals: 5, revenue: 452.5 },
      { method: "Invoice", rentals: 2, revenue: 224.25 },
      { method: "Cash", rentals: 0, revenue: 0.0 },
    ],
    periodCompare: [
      { metric: "Rentals", current: 7, prior: 5 },
      { metric: "Revenue", current: 676.75, prior: 580.0 },
    ],
    ytdCompare: [
      { metric: "Rentals", current: 218, last: 244 },
      { metric: "Revenue", current: 23383.9, last: 17031.68 },
    ],
    failedInRange: [],
    failedOutstanding: [
      {
        date: "2025-11-25",
        name: "Dylan Moore",
        time: "3:00 PM",
        area: "Court 2 East",
        amount: 63.0,
      },
      {
        date: "2025-11-21",
        name: "Kaden Hoselton",
        time: "4:00 PM",
        area: "Court 1 West",
        amount: 81.19,
      },
      {
        date: "2024-11-23",
        name: "Tucker Fuller",
        time: "6:00 PM",
        area: "Court 3",
        amount: 21.0,
      },
      {
        date: "2024-11-03",
        name: "Marvin White",
        time: "6:00 PM",
        area: "Court 3",
        amount: 15.75,
      },
    ],
    sports: [
      { sport: "Basketball", rentals: 4, revenue: 372.75 },
      { sport: "Basketball - Training", rentals: 2, revenue: 84.0 },
      { sport: "Volleyball - Indoor", rentals: 1, revenue: 220.0 },
    ],
    setup: [{ sport: "Volleyball - Indoor", rentals: 1, revenue: 220.0 }],
  },
  // For now, other ranges just reuse the same demo block.
  yesterday: null,
  last_7_days: null,
  last_30_days: null,
  this_month: null,
  last_month: null,
  this_year: null,
  custom: null,
};

function getRangeData(rangeKey) {
  // For a simple demo, fall back to "today" for any range.
  return demoData[rangeKey] || demoData["today"];
}

function formatCurrency(amount) {
  return "$" + amount.toFixed(2);
}

function populateDashboard(rangeKey) {
  const data = getRangeData(rangeKey);

  // Top KPIs in Q1
  document.getElementById("total-rentals").textContent = data.totalRentals;
  document.getElementById("total-revenue").textContent = formatCurrency(
    data.totalRevenue
  );
  document.getElementById("rentals-trend").innerHTML =
    '<span class="arrow">▲</span> ' + data.rentalsTrendLabel;
  document.getElementById("revenue-trend").innerHTML =
    '<span class="arrow">▲</span> ' + data.revenueTrendLabel;

  // Hourly table
  const hourlyBody = document.getElementById("hourly-table-body");
  hourlyBody.innerHTML = "";
  data.hourly.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.hour}</td>
      <td class="text-right">${row.rentals}</td>
      <td class="text-right">${formatCurrency(row.revenue)}</td>
    `;
    hourlyBody.appendChild(tr);
  });

  // Payments table
  const payBody = document.getElementById("payment-table-body");
  payBody.innerHTML = "";
  data.payments.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.method}</td>
      <td class="text-right">${row.rentals}</td>
      <td class="text-right">${formatCurrency(row.revenue)}</td>
    `;
    payBody.appendChild(tr);
  });

  // Period vs prior
  const periodBody = document.getElementById("period-compare-body");
  periodBody.innerHTML = "";
  data.periodCompare.forEach((row) => {
    const delta = row.current - row.prior;
    const isPos = delta >= 0;
    const badgeClass = isPos ? "badge green" : "badge red";
    const deltaLabel =
      row.metric === "Revenue"
        ? formatCurrency(Math.abs(delta))
        : Math.abs(delta);
    const sign = isPos ? "+" : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.metric}</td>
      <td class="text-right">${
        row.metric === "Revenue"
          ? formatCurrency(row.current)
          : row.current
      }</td>
      <td class="text-right">${
        row.metric === "Revenue"
          ? formatCurrency(row.prior)
          : row.prior
      }</td>
      <td class="text-right">
        <span class="${badgeClass}">${sign}${deltaLabel}</span>
      </td>
    `;
    periodBody.appendChild(tr);
  });

  // YTD vs last YTD
  const ytdBody = document.getElementById("ytd-compare-body");
  ytdBody.innerHTML = "";
  data.ytdCompare.forEach((row) => {
    const delta = row.current - row.last;
    const isPos = delta >= 0;
    const badgeClass = isPos ? "badge green" : "badge red";
    const deltaLabel =
      row.metric === "Revenue"
        ? formatCurrency(Math.abs(delta))
        : Math.abs(delta);
    const sign = isPos ? "+" : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.metric}</td>
      <td class="text-right">${
        row.metric === "Revenue"
          ? formatCurrency(row.current)
          : row.current
      }</td>
      <td class="text-right">${
        row.metric === "Revenue"
          ? formatCurrency(row.last)
          : row.last
      }</td>
      <td class="text-right">
        <span class="${badgeClass}">${sign}${deltaLabel}</span>
      </td>
    `;
    ytdBody.appendChild(tr);
  });

  // Failed payments
  const failedRangeBody = document.getElementById("failed-range-body");
  failedRangeBody.innerHTML = "";
  if (data.failedInRange.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="5" class="muted">No failed payments in this date range.</td>';
    failedRangeBody.appendChild(tr);
    document.getElementById("failed-range-count").textContent = "0";
    document.getElementById("failed-range-caption").innerHTML =
      '<span class="arrow">●</span> No new failures';
  } else {
    let totalFailedRange = 0;
    data.failedInRange.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.date}</td>
        <td>${row.name}</td>
        <td>${row.time}</td>
        <td>${row.area}</td>
        <td class="text-right">${formatCurrency(row.amount)}</td>
      `;
      totalFailedRange += row.amount;
      failedRangeBody.appendChild(tr);
    });
    document.getElementById("failed-range-count").textContent =
      data.failedInRange.length;
    document.getElementById("failed-range-caption").innerHTML =
      '<span class="arrow">▲</span> ' +
      data.failedInRange.length +
      " failed / " +
      formatCurrency(totalFailedRange);
  }

  const failedOutBody = document.getElementById("failed-outstanding-body");
  failedOutBody.innerHTML = "";
  let totalOutstanding = 0;
  data.failedOutstanding.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.date}</td>
      <td>${row.name}</td>
      <td>${row.time}</td>
      <td>${row.area}</td>
      <td class="text-right">${formatCurrency(row.amount)}</td>
    `;
    totalOutstanding += row.amount;
    failedOutBody.appendChild(tr);
  });
  document.getElementById("failed-outstanding-amount").textContent =
    formatCurrency(totalOutstanding);
  document.getElementById("failed-outstanding-caption").innerHTML =
    '<span class="arrow">▲</span> ' +
    data.failedOutstanding.length +
    " open items";

  // Q4: sport + setup
  const sportBody = document.getElementById("sport-body");
  sportBody.innerHTML = "";
  data.sports.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.sport}</td>
      <td class="text-right">${row.rentals}</td>
      <td class="text-right">${formatCurrency(row.revenue)}</td>
    `;
    sportBody.appendChild(tr);
  });

  const setupBody = document.getElementById("setup-body");
  setupBody.innerHTML = "";
  if (data.setup.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      '<td colspan="3" class="muted">No setup-required rentals in this range.</td>';
    setupBody.appendChild(tr);
    document.getElementById("setup-count").textContent = "0";
  } else {
    let totalSetup = 0;
    let setupRentals = 0;
    data.setup.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.sport}</td>
        <td class="text-right">${row.rentals}</td>
        <td class="text-right">${formatCurrency(row.revenue)}</td>
      `;
      totalSetup += row.revenue;
      setupRentals += row.rentals;
      setupBody.appendChild(tr);
    });
    document.getElementById("setup-count").textContent = setupRentals;
  }

  // sports count
  document.getElementById("sports-count").textContent = data.sports.length;
}

// Wiring up the date range buttons
document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".filter-btn");
  const customBtn = document.getElementById("custom-range-btn");
  const customInputs = document.getElementById("custom-range-inputs");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const rangeKey = btn.getAttribute("data-range");

      if (rangeKey === "custom") {
        customInputs.style.display = "flex";
      } else {
        customInputs.style.display = "none";
      }

      // For now, all ranges re-use demo data, but the UI responds
      populateDashboard(rangeKey);
    });
  });

  // Default load = "today"
  populateDashboard("today");
});
