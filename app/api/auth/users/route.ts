import { connectDb } from "@/lib/db";
import { requireAdmin } from "@/lib/requireSession";
import { User } from "@/models/User";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  await connectDb();
  const users = await User.find()
    .select("email hasAccess isAdmin createdAt")
    .sort({ email: 1 })
    .lean();

  return Response.json({
    users: users.map((u) => ({
      id: String(u._id),
      email: u.email as string,
      hasAccess: u.hasAccess !== false,
      isAdmin: u.isAdmin === true,
      createdAt: u.createdAt,
    })),
  });
}

type PatchBody = {
  userId?: string;
  hasAccess?: boolean;
};

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId, hasAccess } = body;
  if (!userId || typeof hasAccess !== "boolean") {
    return Response.json(
      { error: "userId and hasAccess (boolean) are required" },
      { status: 400 },
    );
  }

  if (userId === auth.user.id) {
    return Response.json(
      { error: "You cannot change your own access" },
      { status: 400 },
    );
  }

  await connectDb();
  const target = await User.findById(userId).exec();
  if (!target) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  if (target.isAdmin === true) {
    return Response.json(
      { error: "Admin accounts cannot have access changed" },
      { status: 400 },
    );
  }

  target.hasAccess = hasAccess;
  await target.save();

  return Response.json({
    user: {
      id: target._id.toString(),
      email: target.email as string,
      hasAccess: target.hasAccess !== false,
      isAdmin: false,
    },
  });
}
