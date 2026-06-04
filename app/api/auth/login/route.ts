import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  isAdminEmail,
  isAllowedEmail,
  normalizeAuthEmail,
  userHasAccess,
} from "@/lib/accessControl";
import { AUTH_COOKIE_NAME, signAuthToken } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

type LoginBody = {
  email?: string;
  password?: string;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email ? normalizeAuthEmail(body.email) : "";
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }

  if (!isAllowedEmail(email)) {
    return Response.json(
      { error: "This email is not authorized to sign in." },
      { status: 403 },
    );
  }

  await connectDb();

  const user = await User.findOne({ email }).select("+passwordHash").exec();

  if (!user) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await bcrypt.compare(password, user.passwordHash as string);
  if (!ok) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (!userHasAccess(user.hasAccess as boolean | undefined)) {
    return Response.json(
      { error: "You don't have access. Please contact an administrator." },
      { status: 403 },
    );
  }

  if (isAdminEmail(email) && user.isAdmin !== true) {
    user.isAdmin = true;
    await user.save();
  }

  const userId = user._id.toString();
  const token = signAuthToken({ sub: userId, email: user.email as string });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return Response.json({
    user: {
      id: userId,
      email: user.email as string,
      isAdmin: user.isAdmin === true,
      hasAccess: true,
    },
  });
}

