"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminPanelSettings,
  Badge,
  LockReset,
  PersonAddAlt1,
  Security,
  SupervisorAccount,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type {
  AccessRole,
  AccessUser,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import { findCurrentAccess } from "@/services/auth/current-access";
import type { SupplyCrewGroup } from "@/types/abastecimiento";
import {
  createAccessUserInDb,
  listAccessUsersFromDb,
  updateAccessUserActiveInDb,
  updateAccessUserGroupInDb,
  updateAccessUserPasswordInDb,
  updateAccessUserRoleInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";

const roles: AccessRole[] = ["supervisor", "administrador"];
const groups: SupplyCrewGroup[] = ["grupo-1", "grupo-2"];

export default function Page() {
  const router = useRouter();
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [draft, setDraft] = useState({
    sapId: "",
    nombre: "",
    password: "",
    rol: "supervisor" as AccessRole,
    grupo: "grupo-1" as SupplyCrewGroup,
  });
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});

  const metrics = useMemo(
    () => ({
      total: users.length,
      supervisors: users.filter((user) => user.rol === "supervisor").length,
      admins: users.filter((user) => user.rol === "administrador").length,
      inactive: users.filter((user) => !user.activo).length,
    }),
    [users]
  );

  useEffect(() => {
    let active = true;

    Promise.all([listAccessUsersFromDb(), getCurrentUser()]).then(
      ([result, auth]) => {
        if (!active) {
          return;
        }

        const currentAccess = findCurrentAccess(result, auth);

        if (currentAccess?.rol !== "administrador") {
          router.replace("/dashboard");
          return;
        }

        setUsers(result ?? []);
        setCheckingAccess(false);
      }
    );

    return () => {
      active = false;
    };
  }, [router]);

  async function addUser() {
    if (
      !draft.sapId.trim() ||
      !draft.nombre.trim() ||
      !draft.password.trim()
    ) {
      setMessage({
        type: "error",
        text: "Complete SAP ID, nombre y contraseña inicial para crear el acceso.",
      });
      return;
    }

    const accessUser: AccessUser = {
      id: `access-${Date.now()}`,
      sapId: draft.sapId.trim(),
      nombre: draft.nombre.trim(),
      email: buildInternalEmail(draft.sapId.trim()),
      rol: draft.rol,
      grupo: draft.rol === "supervisor" ? draft.grupo : undefined,
      activo: true,
    };
    const saved = await createAccessUserInDb(accessUser, draft.password.trim());

    if (!saved) {
      setMessage({
        type: "error",
        text: "No se pudo crear el acceso. Revise si el SAP ID ya existe o si Supabase Auth rechazó la contraseña.",
      });
      return;
    }

    setUsers((current) => [
      saved,
      ...current.filter((item) => item.sapId !== saved.sapId),
    ]);
    setDraft({
      sapId: "",
      nombre: "",
      password: "",
      rol: "supervisor",
      grupo: "grupo-1",
    });
    setMessage({
      type: "success",
      text: `Acceso creado para ${saved.nombre}.`,
    });
  }

  async function toggleActive(id: string, activo: boolean) {
    await updateAccessUserActiveInDb(id, activo);
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, activo } : user))
    );
  }

  async function changeGroup(user: AccessUser, grupo: SupplyCrewGroup) {
    const saved = await updateAccessUserGroupInDb({ id: user.id, grupo });
    setUsers((current) =>
      current.map((item) =>
        item.id === user.id ? { ...item, grupo: saved?.grupo ?? grupo } : item
      )
    );
  }

  async function changeRole(user: AccessUser, rol: AccessRole) {
    const nextGroup = rol === "supervisor" ? user.grupo ?? "grupo-1" : undefined;
    const saved = await updateAccessUserRoleInDb({
      id: user.id,
      rol,
      grupo: nextGroup,
    });

    setUsers((current) =>
      current.map((item) =>
        item.id === user.id
          ? {
              ...item,
              rol: saved?.rol ?? rol,
              grupo: rol === "supervisor" ? saved?.grupo ?? nextGroup : undefined,
            }
          : item
      )
    );
  }

  async function changePassword(user: AccessUser) {
    const password = passwordDrafts[user.id]?.trim();

    if (!password) {
      setMessage({
        type: "error",
        text: `Ingrese una nueva contraseña para ${user.nombre}.`,
      });
      return;
    }

    const result = await updateAccessUserPasswordInDb({ id: user.id, password });

    if (!result.ok) {
      setMessage({
        type: "error",
        text: `No se pudo cambiar la contraseña de ${user.nombre}: ${
          result.error ?? "Revise Supabase Auth."
        }`,
      });
      return;
    }

    setPasswordDrafts((current) => ({ ...current, [user.id]: "" }));
    setMessage({
      type: "success",
      text: `Contraseña actualizada para ${user.nombre}.`,
    });
  }

  if (checkingAccess) {
    return <Typography color="text.secondary">Validando acceso...</Typography>;
  }

  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 3 },
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1.3fr 2fr" },
            gap: 2.5,
            alignItems: "center",
          }}
        >
          <Stack spacing={0.75}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
              <Security color="primary" />
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                Accesos
              </Typography>
            </Stack>
            <Typography color="text.secondary">
              Administracion de supervisores y administradores por SAP ID.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr 1fr",
                md: "repeat(4, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <MetricCard label="Usuarios" value={metrics.total} icon={<Badge />} />
            <MetricCard
              label="Supervisores"
              value={metrics.supervisors}
              icon={<SupervisorAccount />}
            />
            <MetricCard
              label="Administradores"
              value={metrics.admins}
              icon={<AdminPanelSettings />}
            />
            <MetricCard
              label="Inactivos"
              value={metrics.inactive}
              icon={<LockReset />}
            />
          </Box>
        </Box>
      </Paper>

      {message ? <Alert severity={message.type}>{message.text}</Alert> : null}

      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Crear acceso
            </Typography>
            <Typography variant="body2" color="text.secondary">
              El ingreso será con SAP ID y contraseña. No se captura correo.
            </Typography>
          </Box>
          <Chip
            color="primary"
            variant="outlined"
            icon={<PersonAddAlt1 />}
            label="Nuevo usuario"
            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
            gap: 2,
          }}
        >
          <TextField
            label="SAP ID"
            value={draft.sapId}
            sx={{ gridColumn: { md: "span 2" } }}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sapId: event.target.value }))
            }
          />
          <TextField
            label="Nombre"
            value={draft.nombre}
            sx={{ gridColumn: { md: "span 3" } }}
            onChange={(event) =>
              setDraft((current) => ({ ...current, nombre: event.target.value }))
            }
          />
          <TextField
            label="Contraseña inicial"
            type="password"
            value={draft.password}
            sx={{ gridColumn: { md: "span 2" } }}
            onChange={(event) =>
              setDraft((current) => ({ ...current, password: event.target.value }))
            }
          />
          <TextField
            select
            label="Rol"
            value={draft.rol}
            sx={{ gridColumn: { md: "span 2" } }}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                rol: event.target.value as AccessRole,
              }))
            }
          >
            {roles.map((role) => (
              <MenuItem key={role} value={role}>
                {formatRole(role)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Grupo supervisor"
            value={draft.grupo}
            disabled={draft.rol !== "supervisor"}
            sx={{ gridColumn: { md: "span 2" } }}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                grupo: event.target.value as SupplyCrewGroup,
              }))
            }
          >
            {groups.map((group) => (
              <MenuItem key={group} value={group}>
                {formatGroup(group)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            onClick={addUser}
            startIcon={<PersonAddAlt1 />}
            sx={{ gridColumn: { md: "span 1" }, minHeight: 54 }}
          >
            Agregar
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 2 }}>
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Accesos registrados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cambie rol, grupo, estado o contraseña sin afectar el histórico de
            recorridos.
          </Typography>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>SAP ID</TableCell>
                <TableCell>Usuario</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Seguridad</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{user.sapId}</TableCell>
                  <TableCell>
                    <Stack spacing={0.25}>
                      <Typography sx={{ fontWeight: 700 }}>{user.nombre}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Acceso interno sin correo visible
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={user.rol}
                      sx={{ minWidth: 170 }}
                      onChange={(event) =>
                        changeRole(user, event.target.value as AccessRole)
                      }
                    >
                      {roles.map((role) => (
                        <MenuItem key={role} value={role}>
                          {formatRole(role)}
                        </MenuItem>
                      ))}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    {user.rol === "supervisor" ? (
                      <TextField
                        select
                        size="small"
                        value={user.grupo ?? "grupo-1"}
                        sx={{ minWidth: 135 }}
                        onChange={(event) =>
                          changeGroup(user, event.target.value as SupplyCrewGroup)
                        }
                      >
                        {groups.map((group) => (
                          <MenuItem key={group} value={group}>
                            {formatGroup(group)}
                          </MenuItem>
                        ))}
                      </TextField>
                    ) : (
                      <Chip size="small" label="Todos los grupos" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={user.activo ? "success" : "default"}
                      label={user.activo ? "Activo" : "Inactivo"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack
                      direction={{ xs: "column", lg: "row" }}
                      spacing={1}
                      sx={{ alignItems: { xs: "stretch", lg: "center" } }}
                    >
                      <TextField
                        size="small"
                        type="password"
                        label="Nueva contraseña"
                        value={passwordDrafts[user.id] ?? ""}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <LockReset fontSize="small" />
                              </InputAdornment>
                            ),
                          },
                        }}
                        onChange={(event) =>
                          setPasswordDrafts((current) => ({
                            ...current,
                            [user.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => changePassword(user)}
                      >
                        Cambiar clave
                      </Button>
                      <Divider
                        flexItem
                        orientation="vertical"
                        sx={{ display: { xs: "none", lg: "block" } }}
                      />
                      <Button
                        size="small"
                        color={user.activo ? "warning" : "success"}
                        onClick={() => toggleActive(user.id, !user.activo)}
                      >
                        {user.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
        <Box>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function formatRole(role: AccessRole) {
  return role === "supervisor" ? "Supervisor" : "Administrador";
}

function formatGroup(group: SupplyCrewGroup) {
  return group === "grupo-1" ? "Grupo 1" : "Grupo 2";
}

function buildInternalEmail(sapId: string) {
  return `${sapId.trim().toLowerCase()}@sgr.local.com`;
}
