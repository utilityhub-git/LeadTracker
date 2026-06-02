const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatDate(raw: string | null): string {
  if (!raw) return "—";
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const month = parseInt(dmy[2], 10);
    if (month >= 1 && month <= 12) {
      return `${dmy[1].padStart(2, "0")} ${MONTHS[month - 1]} ${dmy[3]}`;
    }
  }
  return raw;
}

export function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
