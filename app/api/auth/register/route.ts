import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import { User } from "@/models/User";

type RegisterBody = {
  email?: string;
  password?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : "";
  const password = body.password ?? "";


  if (!email || !password) {
    return Response.json(
      { error: "email and password are required" },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return Response.json(
      { error: "password must be at least 8 characters" },
      { status: 400 },
    );
  }
  if (!email.endsWith("@utilityhub.com.au")) {
    return Response.json(
      { error: "Your account is not authorized for self-service registration. Please contact your administrator." },
      { status: 403 },
    );
  }

  await connectDb();

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await User.create({
      email,
      passwordHash,
    });

    const userId = user._id.toString();

    return Response.json(
      { user: { id: userId, email: email || null } },
      { status: 201 },
    );
  } catch (err: unknown) {
    // Mongo duplicate key error
    if (typeof err === "object" && err && "code" in err && err.code === 11000) {
      return Response.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }
    return Response.json({ error: "Registration failed" }, { status: 500 });
  }
}

