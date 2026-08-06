"use client";

import { useEffect, useMemo, useState } from "react";
import { LockReset } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  listAccessUsersFromDb,
  updateAccessUserPasswordInDb,
  type AccessUser,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import { findCurrentAccess } from "@/services/auth/current-access";

export default function PasswordSettings() {
  const [accessUser, setAccessUser] = useState<AccessUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const canSave = useMemo(
    () => password.trim().length > 0 && confirmPassword.trim().length > 0,
    [password, confirmPassword]
  );

  useEffect(() => {
    let active = true;

    Promise.all([listAccessUsersFromDb(), getCurrentUser()]).then(
      ([users, auth]) => {
        if (!active) {
          return;
        }

        const currentAccess = findCurrentAccess(users, auth);

        setAccessUser(currentAccess);
        setLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, []);

  async function changeOwnPassword() {
    if (!accessUser) {
      setMessage({
        type: "error",
        text: "No se encontro el acceso del usuario actual.",
      });
      return;
    }

    if (password.trim().length < 6) {
      setMessage({
        type: "error",
        text: "La nueva contraseña debe tener al menos 6 caracteres.",
      });
      return;
    }

    if (password.trim() !== confirmPassword.trim()) {
      setMessage({
        type: "error",
        text: "La confirmación no coincide con la nueva contraseña.",
      });
      return;
    }

    setSaving(true);
    const result = await updateAccessUserPasswordInDb({
      id: accessUser.id,
      password: password.trim(),
    });
    setSaving(false);

    if (!result.ok) {
      setMessage({
        type: "error",
        text: `No se pudo cambiar la contraseña: ${
          result.error ?? "Revise Supabase Auth."
        }`,
      });
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage({
      type: "success",
      text: "Contraseña actualizada correctamente.",
    });
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          alignItems: "center",
          mb: 2,
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <LockReset color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Cambiar mi contraseña
            </Typography>
            <Typography color="text.secondary">
              Actualice la clave del usuario con sesión iniciada.
            </Typography>
          </Box>
        </Stack>

        {accessUser ? (
          <Chip
            label={`${accessUser.sapId} - ${accessUser.nombre}`}
            sx={{ justifySelf: { md: "end" } }}
          />
        ) : null}
      </Box>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr auto" },
          gap: 2,
          alignItems: "center",
        }}
      >
        <TextField
          label="Nueva contraseña"
          type="password"
          value={password}
          disabled={loading || saving || !accessUser}
          onChange={(event) => setPassword(event.target.value)}
        />
        <TextField
          label="Confirmar contraseña"
          type="password"
          value={confirmPassword}
          disabled={loading || saving || !accessUser}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <Button
          variant="contained"
          onClick={changeOwnPassword}
          disabled={!canSave || loading || saving || !accessUser}
          startIcon={<LockReset />}
          sx={{ minHeight: 54 }}
        >
          Guardar clave
        </Button>
      </Box>
    </Paper>
  );
}
