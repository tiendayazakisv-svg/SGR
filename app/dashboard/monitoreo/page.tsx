"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type {
  SupplyAssignment,
  SupplyCrewGroup,
  SupplyPerson,
} from "@/types/abastecimiento";
import {
  formatRunStatus,
  getShiftName,
  getStatusColor,
  SUPPLY_TIMEZONE,
} from "@/services/abastecimiento/abastecimiento.service";
import type { DbKioskRun } from "@/services/abastecimiento/abastecimiento-db.service";
import {
  listAccessUsersFromDb,
  listAssignmentsFromDb,
  listClosedKioskRunsFromDb,
  listOpenKioskRunsFromDb,
  listPersonnelFromDb,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import {
  belongsToGroupScope,
  findCurrentAccess,
  formatGroupScope,
  getSessionGroupScope,
  type GroupScope,
} from "@/services/auth/current-access";

interface MonitorRun {
  run: DbKioskRun;
  assignment?: SupplyAssignment;
  person?: SupplyPerson;
}

export default function Page() {
  const [openRuns, setOpenRuns] = useState<DbKioskRun[]>([]);
  const [closedRuns, setClosedRuns] = useState<DbKioskRun[]>([]);
  const [assignments, setAssignments] = useState<SupplyAssignment[]>([]);
  const [people, setPeople] = useState<SupplyPerson[]>([]);
  const [visibleGroup, setVisibleGroup] = useState<GroupScope>("sin-grupo");
  const [now, setNow] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const [
        dbOpen,
        dbClosed,
        dbAssignments,
        dbPeople,
        dbAccessUsers,
        auth,
      ] = await Promise.all([
        listOpenKioskRunsFromDb(),
        listClosedKioskRunsFromDb({
          desde: startOfLocalDay(getToday()).toISOString(),
          hasta: nextLocalDay(getToday()).toISOString(),
        }),
        listAssignmentsFromDb(),
        listPersonnelFromDb(),
        listAccessUsersFromDb(),
        getCurrentUser(),
      ]);

      if (!active) {
        return;
      }

      const access = findCurrentAccess(dbAccessUsers, auth);

      setVisibleGroup(getSessionGroupScope(access));
      setLoading(false);
    }

    load();
    const refresh = window.setInterval(load, 30000);
    const clock = window.setInterval(() => setNow(new Date()), 1000);

    return () => {
      active = false;
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, []);

  const activeMonitorRuns = useMemo(
    () =>
      openRuns
        .map((run) => enrichRun(run, assignments, people))
        .filter((item) => belongsToVisibleGroup(item, visibleGroup)),
    [assignments, openRuns, people, visibleGroup]
  );
  const closedMonitorRuns = useMemo(
    () =>
      closedRuns
        .map((run) => enrichRun(run, assignments, people))
        .filter((item) => belongsToVisibleGroup(item, visibleGroup)),
    [assignments, closedRuns, people, visibleGroup]
  );

  const totalTolvasEnProceso = activeMonitorRuns.reduce(
    (total, item) => total + item.run.tolvas,
    0
  );
  const totalTolvasCerradas = closedMonitorRuns.reduce(
    (total, item) => total + item.run.tolvas,
    0
  );
  const promedioCerrado = closedMonitorRuns.length
    ? Math.round(
        closedMonitorRuns.reduce(
          (total, item) => total + (item.run.tiempoTotalMin ?? 0),
          0
        ) / closedMonitorRuns.length
      )
    : 0;

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Monitoreo operativo
        </Typography>
        <Typography color="text.secondary">
          Recorridos del kiosko en tiempo real y últimos movimientos guardados en Supabase.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" },
          gap: 2,
        }}
      >
        <Kpi title="En proceso" value={String(activeMonitorRuns.length)} />
        <Kpi title="Tolvas en proceso" value={String(totalTolvasEnProceso)} />
        <Kpi title="Cerrados hoy" value={String(closedMonitorRuns.length)} />
        <Kpi title="Tolvas cerradas" value={String(totalTolvasCerradas)} />
        <Kpi title="Promedio cerrado" value={`${promedioCerrado} min`} />
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Recorridos activos
        </Typography>
        {loading ? (
          <Typography color="text.secondary">Cargando datos de Supabase...</Typography>
        ) : activeMonitorRuns.length === 0 ? (
          <Typography color="text.secondary">Sin recorridos activos.</Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
              gap: 1.5,
            }}
          >
            {activeMonitorRuns.map((item) => (
              <Paper
                key={item.run.id}
                elevation={0}
                sx={{ p: 1.5, border: "1px solid", borderColor: "divider" }}
              >
                <Stack spacing={1}>
                  <Stack
                    direction="row"
                    sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 800 }}>
                        {item.person?.nombre ?? "Sin asignación"}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Equipo {item.run.lineas.join("/")} | Código {item.run.codigoBarras}
                      </Typography>
                    </Box>
                    <Chip color="primary" label={formatOpenState(item.run.estado)} />
                  </Stack>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                    <Chip size="small" label={`${item.run.tolvas} tolvas`} />
                    <Chip size="small" variant="outlined" label={getShiftName(getShiftForTimestamp(item.run.entradaAt))} />
                    <Chip
                      size="small"
                      variant="outlined"
                      label={`${elapsedMinutes(item.run.entradaAt, now)} min transcurridos`}
                    />
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Últimos movimientos de bitácora
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Estado</TableCell>
              <TableCell>Hora</TableCell>
              <TableCell>Almacenista</TableCell>
              <TableCell>Equipo</TableCell>
              <TableCell>Tolvas</TableCell>
              <TableCell>Ideal</TableCell>
              <TableCell>Llenado</TableCell>
              <TableCell>Reparto</TableCell>
              <TableCell>Total real</TableCell>
              <TableCell>Variacion</TableCell>
              <TableCell>Cumplimiento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[...activeMonitorRuns, ...closedMonitorRuns].slice(0, 12).map((item) => (
              <TableRow key={item.run.id}>
                <TableCell>
                  <Chip size="small" label={formatOpenState(item.run.estado)} />
                </TableCell>
                <TableCell>{formatTime(item.run.retornoAt ?? item.run.salidaAt ?? item.run.entradaAt)}</TableCell>
                <TableCell>{item.person?.nombre ?? "Sin asignación"}</TableCell>
                <TableCell>{item.run.lineas.join("/")}</TableCell>
                <TableCell>{item.run.tolvas}</TableCell>
                <TableCell>{item.run.tiempoObjetivoMin} min</TableCell>
                <TableCell>{formatOptionalMinutes(item.run.tiempoLlenadoMin)}</TableCell>
                <TableCell>{formatOptionalMinutes(item.run.tiempoRepartoMin)}</TableCell>
                <TableCell>
                  {item.run.tiempoTotalMin
                    ? `${item.run.tiempoTotalMin} min`
                    : `${elapsedMinutes(item.run.entradaAt, now)} min en proceso`}
                </TableCell>
                <TableCell>
                  {item.run.tiempoTotalMin
                    ? formatVariation(item.run.tiempoTotalMin, item.run.tiempoObjetivoMin)
                    : "Pendiente"}
                </TableCell>
                <TableCell>
                  {item.run.cumplimiento ? (
                    <Chip
                      size="small"
                      color={getStatusColor(item.run.cumplimiento)}
                      label={formatRunStatus(item.run.cumplimiento)}
                    />
                  ) : (
                    <Chip size="small" variant="outlined" label="En proceso" />
                  )}
                </TableCell>
                <TableCell>
                  {item.run.cierreAutomatico ? (
                    <Chip
                      size="small"
                      color="warning"
                      label="Sistema cerro automaticamente"
                      title={item.run.cierreMotivo}
                    />
                  ) : (
                    <Chip size="small" variant="outlined" label={item.run.estado === "cerrado" ? "Escaneo manual" : "En proceso"} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

function enrichRun(
  run: DbKioskRun,
  assignments: SupplyAssignment[],
  people: SupplyPerson[]
): MonitorRun {
  const fecha = formatDate(run.entradaAt);
  const turnoId = getShiftForTimestamp(run.entradaAt);
  const assignment = findHistoricalAssignment(run, assignments, fecha, turnoId);
  const person = assignment
    ? people.find((item) => item.id === assignment.almacenistaId)
    : undefined;

  return { run, assignment, person };
}

function findHistoricalAssignment(
  run: DbKioskRun,
  assignments: SupplyAssignment[],
  fecha: string,
  turnoId: string
) {
  return assignments.find((assignment) => {
    const startsBefore = assignment.vigenteDesde <= fecha;
    const endsAfter = !assignment.vigenteHasta || assignment.vigenteHasta >= fecha;
    const sameShift = assignment.turnoId === turnoId;
    const hasLine = run.lineas.some((line) => assignment.lineas.includes(line));

    return startsBefore && endsAfter && sameShift && hasLine;
  });
}

function belongsToVisibleGroup(item: MonitorRun, visibleGroup: GroupScope) {
  return belongsToGroupScope(item.person?.grupo, visibleGroup);
}

function formatOpenState(state: DbKioskRun["estado"]) {
  const labels: Record<DbKioskRun["estado"], string> = {
    llenando_carro: "Llenando carro",
    repartiendo_tolvas: "Repartiendo",
    cerrado: "Cerrado",
  };

  return labels[state];
}

function elapsedMinutes(start: string, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - new Date(start).getTime()) / 60000));
}

function formatOptionalMinutes(value?: number) {
  return typeof value === "number" ? `${value} min` : "Pendiente";
}

function formatVariation(real: number, ideal: number) {
  const diff = real - ideal;

  if (diff === 0) {
    return "0 min";
  }

  return diff > 0 ? `+${diff} min` : `${diff} min`;
}

function getShiftForTimestamp(value: string) {
  const [hour, minute] = formatTime(value).split(":").map(Number);
  const total = hour * 60 + minute;
  return total < 14 * 60 + 15 ? "turno-a" : "turno-b";
}

function startOfLocalDay(date: string) {
  return new Date(`${date}T00:00:00-06:00`);
}

function nextLocalDay(date: string) {
  const parsed = startOfLocalDay(date);
  parsed.setDate(parsed.getDate() + 1);
  return parsed;
}

function getToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: SUPPLY_TIMEZONE,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: SUPPLY_TIMEZONE,
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SUPPLY_TIMEZONE,
  });
}

