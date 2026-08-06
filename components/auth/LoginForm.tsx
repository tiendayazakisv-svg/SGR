"use client";

import { useEffect, useState } from "react";
import { Badge, LockOutlined, Login } from "@mui/icons-material";
import {
  Alert,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import { ensureDefaultAdminInDb } from "@/services/abastecimiento/abastecimiento-db.service";
import { loginWithSapId } from "@/services/auth/auth.service";

export default function LoginForm() {
  const [sapId, setSapId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    ensureDefaultAdminInDb();
  }, []);

  async function handleLogin() {
    if (!sapId.trim() || !password.trim()) {
      setError("Ingrese SAP ID y contraseña.");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await loginWithSapId(sapId, password);

    setLoading(false);

    if (error) {
      setError(formatLoginError(error));
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <Stack spacing={2.2}>
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="SAP ID"
        fullWidth
        autoFocus
        value={sapId}
        onChange={(event) => setSapId(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleLogin();
          }
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Badge fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <TextField
        label="Contraseña"
        type="password"
        fullWidth
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleLogin();
          }
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      <Button
        variant="contained"
        size="large"
        startIcon={loading ? undefined : <Login />}
        onClick={handleLogin}
        disabled={loading}
        sx={{
          py: 1.4,
          fontWeight: 800,
          bgcolor: "#1976d2",
        }}
      >
        {loading ? <CircularProgress size={24} color="inherit" /> : "Ingresar al sistema"}
      </Button>
    </Stack>
  );
}

function formatLoginError(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();

    if (message && message !== "{}") {
      return message;
    }
  }

  if (typeof error === "string" && error.trim() && error.trim() !== "{}") {
    return error;
  }

  return "No se pudo iniciar sesión. Verifique SAP ID, contraseña y que el usuario exista en Supabase Auth.";
}
