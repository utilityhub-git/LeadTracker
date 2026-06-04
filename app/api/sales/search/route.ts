import {
  normalizePhone,
  normalizeNmi,
  searchByPhone,
  searchByNmi,
  isPhoneInDnc,
} from "@/lib/salesImporter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPhone = searchParams.get("phone");
  const rawNmi   = searchParams.get("nmi");

  if (!rawPhone && !rawNmi) {
    return Response.json({ error: "Provide ?phone=<number> or ?nmi=<value>" }, { status: 400 });
  }

  if (rawPhone) {
    const phone = normalizePhone(rawPhone);
    if (!phone) return Response.json({ error: "Invalid phone number format." }, { status: 400 });
    const [channels, inDnc] = await Promise.all([
      searchByPhone(phone),
      isPhoneInDnc(phone),
    ]);
    const channelsWithDnc = channels.map((ch) => ({
      ...ch,
      records: ch.records.map((r) => ({ ...r, inDnc })),
    }));
    return Response.json({
      type: "phone",
      query: phone,
      found: channelsWithDnc.length > 0 || inDnc,
      channels: channelsWithDnc,
      inDnc,
    });
  }

  const nmi = normalizeNmi(rawNmi);
  if (!nmi) return Response.json({ error: "Invalid NMI / MIRN value." }, { status: 400 });
  const channels = await searchByNmi(nmi);

  // Check DNC for every unique phone in the results
  const uniquePhones = [...new Set(channels.flatMap((ch) => ch.records.map((r) => r.phone)))];
  const dncResults = await Promise.all(uniquePhones.map((p) => isPhoneInDnc(p)));
  const dncPhones = new Set(uniquePhones.filter((_, i) => dncResults[i]));
  const inDnc = dncPhones.size > 0;

  const channelsWithDnc = channels.map((ch) => ({
    ...ch,
    records: ch.records.map((r) => ({ ...r, inDnc: dncPhones.has(r.phone) })),
  }));

  return Response.json({ type: "nmi", query: nmi, found: channels.length > 0, channels: channelsWithDnc, inDnc });
}
