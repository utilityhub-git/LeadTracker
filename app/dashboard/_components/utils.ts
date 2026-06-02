export function formatDate(raw: string | null): string {
  return raw || "—";
}

export function cls(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
