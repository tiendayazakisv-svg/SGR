import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");

loadEnvFile(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;
const password = process.argv[2] || "Admin12345!";

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local."
  );
}

if (password.length < 6) {
  throw new Error("La contrasena debe tener al menos 6 caracteres.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const admin = {
  id: "00000000-0000-0000-0000-000000000001",
  sap_id: "ADMIN",
  nombre: "Administrador SGR",
  email: "admin@sgr.local.com",
  rol: "administrador",
  activo: true,
  password_hash: hashPassword(password),
};

const { error } = await supabase
  .from("supply_access_users")
  .upsert(admin, { onConflict: "sap_id" });

if (error) {
  console.error("No se pudo restablecer ADMIN.");
  console.error(error.message ?? error);
  console.error(
    "Confirme que ejecuto primero scripts/sql/enable-custom-login.sql."
  );
  process.exit(1);
}

console.log("Administrador restablecido correctamente.");
console.log("SAP ID: ADMIN");
console.log(`Contrasena: ${password}`);

function hashPassword(value) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();

    if (key && !process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}
