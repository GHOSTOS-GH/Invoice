// Formatting helpers reproducing lib/utils/formatters.dart

/**
 * Format a number as FCFA currency, grouping thousands with a space.
 * Mirrors formatCurrency() from the Flutter app: "1 250 000 FCFA"
 */
export function formatCurrency(value: number): string {
  const intValue = Math.round(value);
  const formatted = String(intValue);
  const buffer: string[] = [];
  let count = 0;
  for (let i = formatted.length - 1; i >= 0; i--) {
    if (count === 3) {
      buffer.push(" ");
      count = 0;
    }
    buffer.push(formatted[i]);
    count++;
  }
  const reversed = buffer.reverse().join("");
  return `${reversed} FCFA`;
}

/** Format a number with space thousand separators, no currency suffix. */
export function formatNumber(value: number): string {
  const intValue = Math.round(value);
  const formatted = String(intValue);
  const buffer: string[] = [];
  let count = 0;
  for (let i = formatted.length - 1; i >= 0; i--) {
    if (count === 3) {
      buffer.push(" ");
      count = 0;
    }
    buffer.push(formatted[i]);
    count++;
  }
  return buffer.reverse().join("");
}

/** Short reference id: last 6 chars of the id prefixed with # */
export function refId(id: string): string {
  return id.length >= 6 ? `#${id.slice(-6)}` : id;
}

/** Format a date as "dd/MM/yyyy à HH:mm" (French). */
export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} à ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** Format a date as "dd/MM/yyyy". */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Short date label for stat charts, e.g. "lun. 12/05". */
export function formatShortDay(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const days = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getDay()]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Month + year label, e.g. "mai 2025". */
export function formatMonthYear(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const months = [
    "janv", "févr", "mars", "avr", "mai", "juin",
    "juil", "août", "sept", "oct", "nov", "déc",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Validate a Senegalese phone number (+221 followed by 9 digits). */
export function isValidSenegalPhone(phone: string): boolean {
  const normalized = phone.replace(/[\s.-]/g, "");
  // Accept +221XXXXXXXXX or 221XXXXXXXXX or 7XXXXXXXX (9 digits starting with 7)
  if (/^\+221\d{9}$/.test(normalized)) return true;
  if (/^221\d{9}$/.test(normalized)) return true;
  if (/^7\d{8}$/.test(normalized)) return true;
  return false;
}

/** Normalize any valid Senegalese number to +221XXXXXXXXX. */
export function normalizeSenegalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("7")) return `+221${digits}`;
  if (digits.length === 12 && digits.startsWith("221")) return `+${digits}`;
  return phone.trim();
}

/** Escape a CSV field (semicolon-separated, French convention). */
export function escapeCsv(field: string): string {
  if (field.includes(";") || field.includes('"') || field.includes("\n") || field.includes("\r")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/** Number → string without trailing decimals if integer. */
export function numStr(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
