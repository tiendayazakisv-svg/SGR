"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import type { SupplyCrewGroup, SupplyPerson } from "@/types/abastecimiento";
import { getShiftName } from "@/services/abastecimiento/abastecimiento.service";
import type { AccessUser } from "@/services/abastecimiento/abastecimiento-db.service";
import {
  listAccessUsersFromDb,
  listPersonnelFromDb,
  updatePersonActiveInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import {
  belongsToGroupScope,
  findCurrentAccess,
  formatGroupScope,
  getSessionGroupScope,
  isAdminAccess,
  type GroupScope,
} from "@/services/auth/current-access";

type GroupFilter = GroupScope;

export default function SupervisorPage() {
  const [people, setPeople] = useState<SupplyPerson[]>([]);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [currentAccess, setCurrentAccess] = useState<AccessUser | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("sin-grupo");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    Promise.all([
      listPersonnelFromDb(),
      listAccessUsersFromDb(),
      getCurrentUser(),
    ])
      .then(([dbPeople, dbAccessUsers, auth]) => {
        if (!active) {
          return;
        }

        const users = dbAccessUsers ?? [];
        const access = findCurrentAccess(users, auth);

        setPeople(dbPeople ?? []);
        setAccessUsers(users);
        setCurrentAccess(access);
        setGroupFilter(getSessionGroupScope(access));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const supervisorGroup =
    currentAccess?.rol === "supervisor" ? currentAccess.grupo : undefined;
  const effectiveGroup = isAdminAccess(currentAccess) ? groupFilter : getSessionGroupScope(currentAccess);
  const operationalPeople = useMemo(
    () =>
      people.filter((person) => {
        const isOperational =
          person.puesto === "almacenista" || person.puesto === "facilitador";
        const belongsToGroup = belongsToGroupScope(person.grupo, effectiveGroup);

        return isOperational && belongsToGroup;
      }),
    [effectiveGroup, people]
  );
  const pausedCount = operationalPeople.filter((person) => !person.activo).length;
  const supervisorLabel = currentAccess
    ? `${currentAccess.nombre} | ${
        currentAccess.rol === "supervisor"
          ? formatGroupScope(getSessionGroupScope(currentAccess))
          : "Administrador"
      }`
    : "Sin acceso asociado";

  async function togglePause(person: SupplyPerson) {
    if (!isAdminAccess(currentAccess) && !belongsToGroupScope(person.grupo, getSessionGroupScope(currentAccess))) {
      setMessage("No puede modificar personal de otro grupo.");
      return;
    }

    const nextActive = !person.activo;
    await updatePersonActiveInDb(person.id, nextActive);
    setPeople((current) =>
      current.map((item) =>
        item.id === person.id ? { ...item, activo: nextActive } : item
      )
    );
    setMessage(
      nextActive
        ? `${person.nombre} fue reactivado para iniciar recorridos.`
        : `${person.nombre} quedó en pausa por comida. Puede reactivarse aqui o automáticamente al iniciar recorrido en kiosko.`
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Control de supervisor
        </Typography>
        <Typography color="text.secondary">
          Pausas operativas por comida. Cada supervisor ve solo el personal de su grupo.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
            gap: 2,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              Usuario actual
            </Typography>
            <Typography sx={{ fontWeight: 700 }}>{supervisorLabel}</Typography>
          </Box>
          <TextField
            select
            label="Grupo visible"
            value={effectiveGroup}
            disabled={!isAdminAccess(currentAccess)}
            onChange={(event) => setGroupFilter(event.target.value as GroupFilter)}
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="sin-grupo">Sin grupo asignado</MenuItem>
            <MenuItem value="grupo-1">Grupo 1</MenuItem>
            <MenuItem value="grupo-2">Grupo 2</MenuItem>
          </TextField>
        </Box>
        {currentAccess?.rol === "supervisor" && !currentAccess.grupo ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Este supervisor no tiene grupo asignado en Accesos.
          </Alert>
        ) : null}
        {!currentAccess && accessUsers.length ? (
          <Alert severity="warning" sx={{ mt: 2 }}>
            El correo de la sesión no coincide con un usuario de Accesos.
          </Alert>
        ) : null}
      </Paper>

      {message ? <Alert severity="success">{message}</Alert> : null}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        <Kpi title="Personal operativo" value={String(operationalPeople.length)} />
        <Kpi title="Activos" value={String(operationalPeople.length - pausedCount)} />
        <Kpi title="En pausa" value={String(pausedCount)} />
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Pausar o reactivar personal
        </Typography>

        {loading ? (
          <Typography color="text.secondary">Cargando datos de Supabase...</Typography>
        ) : operationalPeople.length === 0 ? (
          <Typography color="text.secondary">No hay personal operativo para este grupo.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>SAP ID</TableCell>
                <TableCell>Nombre</TableCell>
                <TableCell>Puesto</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Turno base</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Accion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {operationalPeople.map((person) => (
                <TableRow key={person.id}>
                  <TableCell>{person.sapId}</TableCell>
                  <TableCell>{person.nombre}</TableCell>
                  <TableCell>{person.puesto}</TableCell>
                  <TableCell>{formatGroup(person.grupo)}</TableCell>
                  <TableCell>{getShiftName(person.turnoId)}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={person.activo ? "success" : "warning"}
                      label={person.activo ? "Activo" : "Pausa comida"}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant={person.activo ? "outlined" : "contained"}
                      color={person.activo ? "warning" : "primary"}
                      onClick={() => togglePause(person)}
                    >
                      {person.activo ? "Pausar comida" : "Reactivar"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
    </Paper>
  );
}

function formatGroup(group: SupplyCrewGroup) {
  return group === "grupo-1" ? "Grupo 1" : "Grupo 2";
}
