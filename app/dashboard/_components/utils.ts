const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatDate(raw: string | null): string {
  if (!raw) return "—";
  // Stored format is "dd-mm-yyyy"
  const m = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12) {
      return `${m[1]} ${MONTHS[month - 1]} ${m[3]}`;
    }
  }
  return raw;
}

export function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
