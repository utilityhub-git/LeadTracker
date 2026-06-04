import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { userHasAccess } from "@/lib/accessControl";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

export type SessionUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  hasAccess: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  let payload: { sub: string; email: string };
  try {
    payload = verifyAuthToken(token);
  } catch {
    return null;
  }

  await connectDb();
  const user = await User.findById(payload.sub).exec();
  if (!user) return null;

  const hasAccess = userHasAccess(user.hasAccess as boolean | undefined);
  if (!hasAccess) return null;

  return {
    id: user._id.toString(),
    email: user.email as string,
    isAdmin: user.isAdmin === true,
    hasAccess: true,
  };
}

export async function requireSession(): Promise<
  { user: SessionUser } | { response: Response }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { user };
}

export async function requireAdmin(): Promise<
  { user: SessionUser } | { response: Response }
> {
  const result = await requireSession();
  if ("response" in result) return result;
  if (!result.user.isAdmin) {
    return {
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return result;
}
