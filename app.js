// ========================================================
//  MSS Daily Dashboard - Full Logic (Hive Annex)
//  Works with headers:
//  Name, Area Reserved, Reservation Date, Start Time, End Time,
//  Title, Sport, Paid Status, Price, Form Of Payment
// ========================================================

let allData = [];
let todayChart = null;
let trendChart = null;
let sportsChart = null;

document.addEventListener("DOMContentLoaded", () => {
    const csvInput = document.getElementById("csv-input");
    const clearBtn = document.getElementById("clear-data-btn");
    const status = document.getElementById("status");

    // Load existing data if present
    const saved = localStorage.getItem("mssData");
    if (saved) {
        try {
            allData = JSON.parse(saved) || [];
        } catch {
            allData = [];
        }
    }

    rebuildDashboard();

    csvInput.addEventListener("change", () => {
        const file = csvInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = e => {
            const parsed = parseCSV(e.target.result);
            allData = allData.concat(parsed);
            localStorage.setItem("mssData", JSON.stringify(allData));

            markUploadTime();
            rebuildDashboard();

            status.textContent = "CSV uploaded and dashboard updated.";
        };
        reader.readAsText(file);
    });

    clearBtn.addEventListener("click", () => {
        localStorage.removeItem("mssData");
        allData = [];
        status.textContent = "Stored data cleared.";
        rebuildDashboard();
    });
});

// --------------------------------------------------------
// CSV parsing (simple, works with your exports)
// --------------------------------------------------------
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim());

    return lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim());
        const row = {};
        headers.forEach((h, i) => {
            row[h] = cols[i] ?? "";
        });
        return row;
    });
}

// --------------------------------------------------------
// Date helpers
// --------------------------------------------------------
function parseResDate(str) {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function getDataDate() {
    if (!allData.length) return null;
    let max = null;
    allData.forEach(r => {
        const d = parseResDate(r["Reservation Date"]);
        if (!d) return;
        if (!max || d > max) max = d;
    });
    return max;
}

// --------------------------------------------------------
// Timestamp display
// --------------------------------------------------------
function updateDataDateDisplay(dateObj) {
    const el = document.getElementById("data-date");
    if (!el) return;

    if (!dateObj) {
        el.textContent = "Data Date: —";
        return;
    }
    const formatted = dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
    el.textContent = "Data Date: " + formatted;
}

function markUploadTime() {
    const el = document.getElementById("last-upload");
    if (!el) return;
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    el.textContent = "Last Upload: " + time;
}

// --------------------------------------------------------
// Main rebuild
// --------------------------------------------------------
function rebuildDashboard() {
    clearSections();

    if (!allData.length) {
        updateDataDateDisplay(null);
        return;
    }

    const dataDate = getDataDate();
    updateDataDateDisplay(dataDate);

    buildTodaySnapshot(dataDate);
    buildMonthlyTrend(dataDate);
    buildFailedPayments(dataDate);
    buildSportBreakdown(dataDate);
    buildSetupList(dataDate);
}

function clearSections() {
    ["today-stats", "trend-stats", "failed-today",
     "failed-outstanding", "sports-stats", "setup-required"
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "";
    });

    if (todayChart) { todayChart.destroy(); todayChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    if (sportsChart) { sportsChart.destroy(); sportsChart = null; }
}

// --------------------------------------------------------
// Helper: money formatting
// --------------------------------------------------------
function dollars(num) {
    if (!isFinite(num)) num = 0;
    return "$" + num.toFixed(2);
}

function isFailed(row) {
    const status = (row["Paid Status"] || "").toLowerCase();
    return status === "failed";
}

function numericPrice(row) {
    const p = parseFloat(row["Price"] || "0");
    return isNaN(p) ? 0 : p;
}

// --------------------------------------------------------
// 1) TODAY SNAPSHOT (by hour, totals, revenue)
// --------------------------------------------------------
function buildTodaySnapshot(dataDate) {
    const todayStr = dataDate.toLocaleDateString("en-US");

    const todaysRows = allData.filter(r => r["Reservation Date"] === todayStr);

    let hourlyCounts = {};
    let hourlyRevenue = {};
    let totalRevenue = 0;

    todaysRows.forEach(r => {
        const hr = r["Start Time"] || "Unknown";
        if (!hourlyCounts[hr]) {
            hourlyCounts[hr] = 0;
            hourlyRevenue[hr] = 0;
        }
        hourlyCounts[hr] += 1;

        // Only count revenue if NOT failed
        if (!isFailed(r)) {
            const val = numericPrice(r);
            hourlyRevenue[hr] += val;
            totalRevenue += val;
        }
    });

    const totalRentals = todaysRows.length;
    const todayStatsEl = document.getElementById("today-stats");
    todayStatsEl.innerHTML =
        `<strong>Total Rentals Today:</strong> ${totalRentals}<br>` +
        `<strong>Total Revenue (Paid):</strong> ${dollars(totalRevenue)}`;

    // Build bar chart for counts
    const ctx = document.getElementById("today-chart").getContext("2d");
    const labels = Object.keys(hourlyCounts);
    const data = Object.values(hourlyCounts);

    if (labels.length) {
        todayChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: "Rentals by Hour (Today)",
                    data,
                    backgroundColor: "#4A90E2"
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }
}

// --------------------------------------------------------
// 2) MONTHLY & YTD TREND
// --------------------------------------------------------
function buildMonthlyTrend(dataDate) {
    if (!dataDate) return;

    const thisYear = dataDate.getFullYear();
    const thisMonth = dataDate.getMonth();

    const lastMonthIndex = (thisMonth + 11) % 12;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const ytdCutoff = dataDate;
    const lastYtdCutoff = new Date(thisYear - 1, dataDate.getMonth(), dataDate.getDate());

    let thisMonthRev = 0;
    let lastMonthRev = 0;
    let thisYTD = 0;
    let lastYTD = 0;

    allData.forEach(r => {
        const d = parseResDate(r["Reservation Date"]);
        if (!d || isFailed(r)) return; // only count paid for revenue

        const year = d.getFullYear();
        const month = d.getMonth();
        const val = numericPrice(r);

        if (year === thisYear) {
            if (month === thisMonth) thisMonthRev += val;
            if (month === lastMonthIndex && year === lastMonthYear) lastMonthRev += val;
            if (d <= ytdCutoff) thisYTD += val;
        }

        if (year === thisYear - 1 && d <= lastYtdCutoff) {
            lastYTD += val;
        }
    });

    const trendStatsEl = document.getElementById("trend-stats");
    trendStatsEl.innerHTML =
        `<strong>This Month:</strong> ${dollars(thisMonthRev)}<br>` +
        `<strong>Last Month:</strong> ${dollars(lastMonthRev)}<br>` +
        `<strong>YTD:</strong> ${dollars(thisYTD)}<br>` +
        `<strong>Last YTD:</strong> ${dollars(lastYTD)}`;

    const ctx = document.getElementById("trend-chart").getContext("2d");
    trendChart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["This Month", "Last Month", "YTD", "Last YTD"],
            datasets: [{
                label: "Revenue",
                data: [thisMonthRev, lastMonthRev, thisYTD, lastYTD],
                backgroundColor: ["#4A90E2", "#7B8D93", "#3EAF3A", "#B56576"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } }
        }
    });
}

// --------------------------------------------------------
// 3) FAILED PAYMENTS
// --------------------------------------------------------
function buildFailedPayments(dataDate) {
    const todayStr = dataDate.toLocaleDateString("en-US");

    const failedRows = allData.filter(isFailed);
    const failedToday = failedRows.filter(r => r["Reservation Date"] === todayStr);

    const fmtRow = r =>
        `${r["Name"] || "Unknown"} — ${r["Start Time"] || ""} — ` +
        `${r["Area Reserved"] || ""} — ${dollars(numericPrice(r))}`;

    const failedTodayEl = document.getElementById("failed-today");
    failedTodayEl.innerHTML = failedToday.length
        ? failedToday.map(fmtRow).join("<br>")
        : "No failed payments today.";

    const failedOutstandingEl = document.getElementById("failed-outstanding");
    failedOutstandingEl.innerHTML = failedRows.length
        ? failedRows.map(fmtRow).join("<br>")
        : "No outstanding failed payments.";
}

// --------------------------------------------------------
// 4) SPORT BREAKDOWN (TODAY ONLY)
// --------------------------------------------------------
function buildSportBreakdown(dataDate) {
    const todayStr = dataDate.toLocaleDateString("en-US");
    const todaysRows = allData.filter(r => r["Reservation Date"] === todayStr);

    let sportCounts = {};
    todaysRows.forEach(r => {
        const sport = r["Sport"] || "Unknown";
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
    });

    const statsEl = document.getElementById("sports-stats");
    if (!Object.keys(sportCounts).length) {
        statsEl.innerHTML = "No rentals for today.";
        return;
    }

    statsEl.innerHTML = Object.entries(sportCounts)
        .map(([sport, count]) => `${sport}: ${count}`)
        .join("<br>");

    const ctx = document.getElementById("sports-chart").getContext("2d");
    sportsChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels: Object.keys(sportCounts),
            datasets: [{
                data: Object.values(sportCounts),
                backgroundColor: ["#4A90E2", "#50E3C2", "#F5A623", "#D0021B", "#7B8D93"]
            }]
        },
        options: {
            responsive: true
        }
    });
}

// --------------------------------------------------------
// 5) SETUP REQUIRED (VB + BIRTHDAY TODAY)
// --------------------------------------------------------
function buildSetupList(dataDate) {
    const todayStr = dataDate.toLocaleDateString("en-US");

    const setupRows = allData.filter(r => {
        if (r["Reservation Date"] !== todayStr) return false;
        const sport = (r["Sport"] || "").toLowerCase();
        return sport.includes("volleyball") || sport.includes("birthday");
    });

    const el = document.getElementById("setup-required");
    if (!setupRows.length) {
        el.innerHTML = "No setup required today.";
        return;
    }

    el.innerHTML = setupRows.map(r => {
        return `${r["Start Time"] || ""} — ${r["Area Reserved"] || ""} — ${r["Sport"] || ""}`;
    }).join("<br>");
}
