import { getSessionUser } from "@/lib/requireSession";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ user: null }, { status: 401 });
  }

  return Response.json({ user });
}

