
import { format, parse, isValid, parseISO } from "date-fns";

// Display dates in Indian format: DD/MM/YYYY
export function formatIndianDate(value) {
  if (!value) return "";

  const date =
    typeof value === "string"
      ? parseISO(value.slice(0, 10))
      : value;

  if (!isValid(date)) return "";

  return format(date, "dd/MM/yyyy");
}

// Parse DD/MM/YYYY into a JavaScript Date.
export function parseIndianDate(value) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return null;
  }

  const date = parse(value, "dd/MM/yyyy", new Date());

  if (!isValid(date) || format(date, "dd/MM/yyyy") !== value) {
    return null;
  }

  return date;
}

// Convert a JavaScript Date into the API format: YYYY-MM-DD
export function formatApiDate(date) {
  if (!date || !isValid(date)) return "";

  return format(date, "yyyy-MM-dd");
}
