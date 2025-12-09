/* Clean rebuilt APP.JS — handles CSV upload, date display, and chart rendering */

document.addEventListener("DOMContentLoaded", function () {
    const csvInput = document.getElementById("csv-input");
    const clearBtn = document.getElementById("clear-data-btn");
    const status = document.getElementById("status");

    let allData = JSON.parse(localStorage.getItem("mssData")) || [];

    function markUploadTime() {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        document.getElementById("last-upload").textContent = "Last Upload: " + time;
    }

    function updateDataDate(dateObj) {
        if (!dateObj) return;
        const formatted = dateObj.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        document.getElementById("data-date").textContent = "Data Date: " + formatted;
    }

    function parseCSV(text) {
        const rows = text.split(/\r?\n/).map(r => r.split(","));
        const headers = rows.shift().map(h => h.trim());

        return rows
            .filter(row => row.length === headers.length)
            .map(row => {
                let obj = {};
                headers.forEach((h, i) => obj[h] = row[i]?.trim());
                return obj;
            });
    }

    function renderDashboard() {
        document.getElementById("today-stats").textContent = "";
        if (allData.length === 0) return;

        document.getElementById("today-stats").textContent =
            "Total Records Loaded: " + allData.length;
    }

    csvInput.addEventListener("change", function () {
        const file = csvInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const parsed = parseCSV(e.target.result);
            allData = allData.concat(parsed);

            localStorage.setItem("mssData", JSON.stringify(allData));

            status.textContent = "File uploaded and processed.";
            markUploadTime();

            const lastRow = parsed[parsed.length - 1];
            if (lastRow && lastRow["Reservation Date"]) {
                updateDataDate(new Date(lastRow["Reservation Date"]));
            }

            renderDashboard();
        };
        reader.readAsText(file);
    });

    clearBtn.addEventListener("click", function () {
        localStorage.removeItem("mssData");
        allData = [];
        status.textContent = "Stored data cleared.";
        renderDashboard();
    });

    updateDataDate(new Date());
    renderDashboard();
});
