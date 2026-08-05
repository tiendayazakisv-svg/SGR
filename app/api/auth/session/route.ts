import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_COOKIE = "sgr_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEFAULT_ADMIN_PASSWORD = "Admin12345!";

interface SessionPayload {
  id: string;
  email: string;
  sapId: string;
  nombre: string;
  rol: string;
  exp: number;
}

export async function GET(request: NextRequest) {
  const session = verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ data: { user: null } });
  }

  return NextResponse.json({
    data: {
      user: {
        id: session.id,
        email: session.email,
        user_metadata: {
          sap_id: session.sapId,
          nombre: session.nombre,
          rol: session.rol,
        },
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const { sapId, password } = await request.json();
  const cleanSapId = String(sapId ?? "").trim();
  const cleanPassword = String(password ?? "");

  if (!cleanSapId || !cleanPassword) {
    return NextResponse.json(
      { error: "Ingrese SAP ID y contrasena." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: user, error } = await supabase
    .from("supply_access_users")
    .select("id,sap_id,nombre,email,rol,activo,password_hash")
    .ilike("sap_id", cleanSapId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }

  if (!user || !user.activo) {
    return NextResponse.json(
      { error: "SAP ID no encontrado o usuario inactivo." },
      { status: 401 }
    );
  }

  let passwordHash = String(user.password_hash ?? "");

  if (!passwordHash && String(user.sap_id).toUpperCase() === "ADMIN") {
    passwordHash = hashPassword(DEFAULT_ADMIN_PASSWORD);
    await supabase
      .from("supply_access_users")
      .update({ password_hash: passwordHash })
      .eq("id", user.id);
  }

  if (!passwordHash || !verifyPassword(cleanPassword, passwordHash)) {
    return NextResponse.json(
      { error: "SAP ID o contrasena incorrecta." },
      { status: 401 }
    );
  }

  const payload: SessionPayload = {
    id: String(user.id),
    email: String(user.email),
    sapId: String(user.sap_id),
    nombre: String(user.nombre),
    rol: String(user.rol),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };

  const response = NextResponse.json({
    data: {
      user: {
        id: payload.id,
        email: payload.email,
        user_metadata: {
          sap_id: payload.sapId,
          nombre: payload.nombre,
          rol: payload.rol,
        },
      },
    },
  });

  response.cookies.set(SESSION_COOKIE, signSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [method, salt, hash] = storedHash.split(":");

  if (method !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function signSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret())
    .update(body)
    .digest("base64url");

  return `${body}.${signature}`;
}

function verifySession(value?: string) {
  if (!value) {
    return null;
  }

  const [body, signature] = value.split(".");

  if (!body || !signature) {
    return null;
  }

  const expected = createHmac("sha256", getSessionSecret())
    .update(body)
    .digest("base64url");

  if (signature !== expected) {
    return null;
  }

  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8")
  ) as SessionPayload;

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function getSessionSecret() {
  return process.env.SUPABASE_SECRET_KEY ?? "sgr-local-session-secret";
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }

  return String(error);
}
