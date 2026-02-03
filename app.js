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

// Always create YYYY-MM-DD from a local Date (no timezone surprises)
function ymdFromLocalDate(dateObj) {
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return "";
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Parse a date string into a LOCAL Date at midnight.
// Supports: MM/DD/YYYY, YYYY-MM-DD
function parseReservationDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // MM/DD/YYYY
  if (s.includes("/")) {
    const parts = s.split("/");
    if (parts.length === 3) {
      const m = parseInt(parts[0], 10);
      const d = parseInt(parts[1], 10);
      const y = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
        return new Date(y, m - 1, d); // LOCAL midnight
      }
    }
  }

  // YYYY-MM-DD (date-only)
  // IMPORTANT: do NOT do new Date("YYYY-MM-DD") because that can be treated as UTC.
  if (/^\d{4}-\d{
