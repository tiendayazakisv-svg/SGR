"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AccessTime,
  CheckCircle,
  Inventory2,
  LocalShipping,
  PauseCircle,
  QrCodeScanner,
  SentimentDissatisfied,
  SentimentSatisfiedAlt,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type {
  SupplyAssignment,
  SupplyPerson,
  SupplyTimeParameter,
} from "@/types/abastecimiento";
import { useLineCatalog } from "@/modules/abastecimiento/hooks/useLineCatalog";
import {
  SUPPLY_TIMEZONE,
  supplyShifts,
} from "@/services/abastecimiento/abastecimiento.service";
import {
  closeKioskRunInDb,
  createKioskRunInDb,
  listAssignmentsFromDb,
  listOpenKioskRunsFromDb,
  listPersonnelFromDb,
  registerKioskExitInDb,
  updatePersonActiveInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";

type ActiveStep = "llenando_carro" | "repartiendo_tolvas";

interface ActiveKioskRun {
  id: string;
  group: SupplyTimeParameter;
  assignment?: SupplyAssignment;
  assignedPerson?: SupplyPerson;
  tolvas: number;
  entradaAt: Date;
  salidaAt?: Date;
  step: ActiveStep;
}

interface PendingKioskRun {
  group: SupplyTimeParameter;
  assignment: SupplyAssignment;
  assignedPerson: SupplyPerson;
  entradaAt?: Date;
}

interface CompletedKioskRun extends ActiveKioskRun {
  salidaAt: Date;
  retornoAt: Date;
  tiempoLlenadoMin: number;
  tiempoRepartoMin: number;
  tiempoTotalMin: number;
  cumplimiento: "rapido" | "en_rango" | "tarde";
}

export default function KioskoPage() {
  const { lineGroups, findLineGroupByBarcode } = useLineCatalog();
  const [barcode, setBarcode] = useState("");
  const [tolvas, setTolvas] = useState("");
  const [pendingRun, setPendingRun] = useState<PendingKioskRun | null>(null);
  const [activeRuns, setActiveRuns] = useState<ActiveKioskRun[]>([]);
  const [completedRuns, setCompletedRuns] = useState<CompletedKioskRun[]>([]);
  const [assignments, setAssignments] = useState<SupplyAssignment[]>([]);
  const [people, setPeople] = useState<SupplyPerson[]>([]);
  const [now, setNow] = useState<Date | null>(null);
  const [message, setMessage] = useState({
    severity: "info" as "success" | "info" | "warning" | "error",
    text: "Escanee el código de barras del equipo de líneas.",
  });
  const [quickResult, setQuickResult] = useState<CompletedKioskRun | null>(null);
  const [savingRun, setSavingRun] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadOperationalData() {
      const [runs, dbAssignments, dbPeople] = await Promise.all([
        listOpenKioskRunsFromDb(),
        listAssignmentsFromDb(),
        listPersonnelFromDb(),
      ]);

      if (!active) {
        return;
      }

      setAssignments(dbAssignments ?? []);
      setPeople(dbPeople ?? []);
      setActiveRuns(
        (runs ?? []).map((run) => {
          const group =
            lineGroups.find((item) => item.codigoBarras === run.codigoBarras) ??
            ({
              id: run.lineGroupId,
              codigoBarras: run.codigoBarras,
              tienda: run.tienda,
              lineas: run.lineas,
              tiempoObjetivoMin: run.tiempoObjetivoMin,
              toleranciaRapidoMin: 0,
              toleranciaTardeMin: 0,
            } satisfies SupplyTimeParameter);
          const context = resolveAssignmentForGroup(
            group,
            dbAssignments ?? [],
            dbPeople ?? [],
            new Date(run.entradaAt)
          );

          return {
            id: run.id,
            group,
            assignment: context?.assignment,
            assignedPerson: context?.assignedPerson,
            tolvas: run.tolvas,
            entradaAt: new Date(run.entradaAt),
            salidaAt: run.salidaAt ? new Date(run.salidaAt) : undefined,
            step:
              run.estado === "repartiendo_tolvas"
                ? "repartiendo_tolvas"
                : "llenando_carro",
          };
        })
      );
    }

    loadOperationalData();
    const refresh = window.setInterval(loadOperationalData, 45000);

    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [lineGroups]);

  const visibleActiveRuns = useMemo(
    () => dedupeActiveRunsByGroup(activeRuns),
    [activeRuns]
  );
  const activeRunByCode = useMemo(
    () =>
      visibleActiveRuns.reduce<Record<string, ActiveKioskRun>>((acc, run) => {
        if (!acc[run.group.codigoBarras]) {
          acc[run.group.codigoBarras] = run;
        }
        return acc;
      }, {}),
    [visibleActiveRuns]
  );
  const pausedPeople = useMemo(
    () =>
      people.filter(
        (person) => !person.activo && isOperationalPosition(person.puesto)
      ),
    [people]
  );
  const currentShiftId = now ? getActiveShiftForDate(now) : null;
  const currentShift = currentShiftId
    ? supplyShifts.find((shift) => shift.id === currentShiftId)
    : undefined;


  async function reactivatePersonIfPaused(person?: SupplyPerson) {
    if (!person || person.activo) {
      return person;
    }

    const updated = await updatePersonActiveInDb(person.id, true);
    const nextPerson = updated ?? { ...person, activo: true };

    setPeople((current) =>
      current.map((item) => (item.id === nextPerson.id ? nextPerson : item))
    );
    setActiveRuns((current) =>
      current.map((run) =>
        run.assignedPerson?.id === nextPerson.id
          ? { ...run, assignedPerson: nextPerson }
          : run
      )
    );
    setPendingRun((current) =>
      current?.assignedPerson.id === nextPerson.id
        ? { ...current, assignedPerson: nextPerson }
        : current
    );

    return nextPerson;
  }

  async function handleScanLine() {
    const lineGroup = findLineGroupByBarcode(barcode);

    if (!lineGroup) {
      setMessage({
        severity: "error",
        text: "Código de equipo no encontrado. Configure el código en Líneas y equipos.",
      });
      return;
    }

    const activeRun = activeRunByCode[lineGroup.codigoBarras];

    if (!activeRun) {
      const scanAt = new Date();
      const activeShiftId = getActiveShiftForDate(scanAt);

      if (!activeShiftId) {
        setMessage({
          severity: "warning",
          text: `Fuera de horario de turno. Solo se pueden iniciar recorridos en los horarios parametrizados: ${formatShiftWindows()}, hora de El Salvador.`,
        });
        setBarcode("");
        return;
      }

      const context = resolveAssignmentForGroup(lineGroup, assignments, people, scanAt);

      if (!context) {
        setMessage({
          severity: "warning",
          text: buildShiftMismatchMessage(lineGroup, assignments, people, scanAt),
        });
        setBarcode("");
        return;
      }

      const wasPaused = !context.assignedPerson.activo;
      const nextContext = wasPaused
        ? {
            ...context,
            assignedPerson: {
              ...context.assignedPerson,
              activo: true,
            },
          }
        : context;

      if (wasPaused) {
        await reactivatePersonIfPaused(context.assignedPerson);
      }

      setPendingRun(nextContext);
      setBarcode("");
      setTolvas("");
      setMessage({
        severity: "success",
        text: `${
          wasPaused
            ? `Hora de comida finalizada para ${context.assignedPerson.nombre}. `
            : ""
        }Entrada detectada para equipo ${formatLines(lineGroup.lineas)}, asociado a ${context.assignedPerson.nombre}. Digite tolvas para iniciar tiempo dentro de tienda.`,
      });
      return;
    }

    if (activeRun.step === "llenando_carro") {
      const reactivatedPerson = await reactivatePersonIfPaused(activeRun.assignedPerson);
      registerExit(
        reactivatedPerson
          ? { ...activeRun, assignedPerson: reactivatedPerson }
          : activeRun
      );
      return;
    }

    const reactivatedPerson = await reactivatePersonIfPaused(activeRun.assignedPerson);
    closeRun(
      reactivatedPerson ? { ...activeRun, assignedPerson: reactivatedPerson } : activeRun
    );
  }

  async function handleStartRun() {
    if (!pendingRun || savingRun) {
      return;
    }

    const duplicateRun = activeRunByCode[pendingRun.group.codigoBarras];
    if (duplicateRun) {
      setPendingRun(null);
      setTolvas("");
      setBarcode("");
      setMessage({
        severity: "warning",
        text: `Ya existe un recorrido activo para el equipo ${formatLines(pendingRun.group.lineas)}. Cierre la salida o retorno pendiente antes de iniciar otro.`,
      });
      return;
    }

    const activeShiftId = getActiveShiftForDate(new Date());
    const pendingPersonStillBelongsToShift =
      pendingRun.assignedPerson.turnoId === pendingRun.assignment.turnoId;

    if (
      !activeShiftId ||
      activeShiftId !== pendingRun.assignment.turnoId ||
      !pendingPersonStillBelongsToShift
    ) {
      setPendingRun(null);
      setTolvas("");
      setBarcode("");
      setMessage({
        severity: "warning",
        text: "El turno actual ya no corresponde a esta entrada pendiente. Escanee nuevamente el equipo cuando el grupo y turno estén habilitados.",
      });
      return;
    }

    const parsedTolvas = Number(tolvas);

    if (!Number.isInteger(parsedTolvas) || parsedTolvas <= 0) {
      setMessage({
        severity: "warning",
        text: "Digite una cantidad válida de tolvas.",
      });
      return;
    }

    setSavingRun(true);

    try {
      const { group, assignment, assignedPerson } = pendingRun;
      const activeAssignedPerson =
        (await reactivatePersonIfPaused(assignedPerson)) ?? assignedPerson;
      const entradaAt = pendingRun.entradaAt ?? new Date();
      const run: ActiveKioskRun = {
        id: `${group.id}-${Date.now()}`,
        group,
        assignment,
        assignedPerson: activeAssignedPerson,
        tolvas: parsedTolvas,
        entradaAt,
        step: "llenando_carro",
      };
      const saved = await createKioskRunInDb({
        group,
        tolvas: parsedTolvas,
        entradaAt,
      });

      const nextRun: ActiveKioskRun = saved
        ? {
            ...run,
            id: saved.id,
            entradaAt: new Date(saved.entradaAt),
            salidaAt: saved.salidaAt ? new Date(saved.salidaAt) : undefined,
            step:
              saved.estado === "repartiendo_tolvas"
                ? "repartiendo_tolvas"
                : "llenando_carro",
          }
        : run;

      setActiveRuns((current) =>
        dedupeActiveRunsByGroup([nextRun, ...current])
      );
      setPendingRun(null);
      setTolvas("");
      setBarcode("");
      setMessage({
        severity: "success",
        text: `Entrada registrada. ${nextRun.assignedPerson?.nombre ?? "Almacenista"} está llenando carro para equipo ${formatLines(nextRun.group.lineas)} con ${nextRun.tolvas} tolvas.`,
      });
    } finally {
      setSavingRun(false);
    }
  }

  async function registerExit(run: ActiveKioskRun) {
    const salidaAt = new Date();
    const saved = await registerKioskExitInDb(run.id, salidaAt);
    const nextSalidaAt = saved?.salidaAt ? new Date(saved.salidaAt) : salidaAt;

    setActiveRuns((current) =>
      current.map((item) =>
        item.id === run.id
          ? {
              ...item,
              salidaAt: nextSalidaAt,
              step: "repartiendo_tolvas",
            }
          : item
      )
    );
    setBarcode("");
    setMessage({
      severity: "success",
      text: `Salida registrada. ${run.assignedPerson?.nombre ?? "Almacenista"} va a repartir tolvas del equipo ${formatLines(run.group.lineas)}.`,
    });
  }

  async function closeRun(run: ActiveKioskRun) {
    if (!run.salidaAt) {
      return;
    }

    const retornoAt = new Date();
    const tiempoLlenadoMin = diffMinutes(run.entradaAt, run.salidaAt);
    const tiempoRepartoMin = diffMinutes(run.salidaAt, retornoAt);
    const tiempoTotalMin = diffMinutes(run.entradaAt, retornoAt);
    const cumplimiento = getRunStatus(tiempoTotalMin, run.group);
    const completed: CompletedKioskRun = {
      ...run,
      salidaAt: run.salidaAt,
      retornoAt,
      tiempoLlenadoMin,
      tiempoRepartoMin,
      tiempoTotalMin,
      cumplimiento,
    };

    await closeKioskRunInDb({
      id: run.id,
      retornoAt,
      tiempoLlenadoMin,
      tiempoRepartoMin,
      tiempoTotalMin,
      cumplimiento,
    });

    setActiveRuns((current) => current.filter((item) => item.id !== run.id));
    setCompletedRuns((current) => [completed, ...current].slice(0, 10));
    setQuickResult(completed);
    const activeShiftAtReturn = getActiveShiftForDate(retornoAt);

    if (
      run.assignment &&
      run.assignedPerson &&
      activeShiftAtReturn === run.assignment.turnoId &&
      run.assignedPerson.turnoId === run.assignment.turnoId
    ) {
      setPendingRun({
        group: run.group,
        assignment: run.assignment,
        assignedPerson: run.assignedPerson,
        entradaAt: retornoAt,
      });
    } else {
      setPendingRun(null);
    }
    setTolvas("");
    setBarcode("");
    setMessage({
      severity: cumplimiento === "tarde" ? "warning" : "success",
      text:
        activeShiftAtReturn === run.assignment?.turnoId
          ? `${getCompletionFaceText(cumplimiento)} Recorrido cerrado para ${run.assignedPerson?.nombre ?? "almacenista"}. Equipo ${formatLines(run.group.lineas)} total ${completed.tiempoTotalMin} min, objetivo ${run.group.tiempoObjetivoMin} min. Digite tolvas para iniciar el siguiente recorrido; la nueva entrada quedó marcada a las ${formatTime(retornoAt)}.`
          : `${getCompletionFaceText(cumplimiento)} Recorrido cerrado para ${run.assignedPerson?.nombre ?? "almacenista"}. Equipo ${formatLines(run.group.lineas)} total ${completed.tiempoTotalMin} min, objetivo ${run.group.tiempoObjetivoMin} min. El turno ya no está habilitado para iniciar otro recorrido.`,
    });
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary", p: { xs: 2, md: 4 } }}>
      <Stack spacing={3} sx={{ maxWidth: 1180, mx: "auto" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", md: "row" },
          }}
        >
          <Box>
            <Typography variant="h3" component="h1" sx={{ fontWeight: 800 }}>
              Kiosko de abastecimiento
            </Typography>
            <Typography color="text.secondary">
              Entrada, salida y retorno por código de equipo asociado a un almacenista.
            </Typography>
          </Box>

          <Button component={Link} href="/dashboard" variant="outlined">
            Dashboard
          </Button>
        </Box>

        <Alert severity={message.severity}>{message.text}</Alert>
        <Snackbar
          open={Boolean(quickResult)}
          autoHideDuration={4200}
          onClose={() => setQuickResult(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          sx={{
            inset: "0 !important",
            left: "0 !important",
            right: "0 !important",
            bottom: "0 !important",
            top: "0 !important",
            transform: "none !important",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "rgba(2, 6, 23, 0.56)",
            backdropFilter: "blur(3px)",
            pointerEvents: "none",
            zIndex: (theme) => theme.zIndex.snackbar,
          }}
        >
          {quickResult ? (
            <Paper
              elevation={10}
              sx={{
                width: { xs: "calc(100vw - 32px)", sm: 640, md: 760 },
                minHeight: { xs: 260, md: 320 },
                p: { xs: 3, md: 5 },
                borderRadius: 3,
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "auto 1fr" },
                gap: { xs: 2, md: 3 },
                alignItems: "center",
                color: "common.white",
                bgcolor:
                  quickResult.cumplimiento === "tarde"
                    ? "error.dark"
                    : "success.dark",
                border: "2px solid",
                borderColor:
                  quickResult.cumplimiento === "tarde"
                    ? "error.light"
                    : "success.light",
                pointerEvents: "auto",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  placeItems: "center",
                  justifySelf: { xs: "center", sm: "start" },
                  width: { xs: 112, md: 140 },
                  height: { xs: 112, md: 140 },
                  borderRadius: "50%",
                  bgcolor: "rgba(255,255,255,0.16)",
                }}
              >
                {getCompletionIcon(quickResult.cumplimiento, 96)}
              </Box>

              <Box sx={{ textAlign: { xs: "center", sm: "left" } }}>
                <Typography
                  component="div"
                  sx={{
                    fontSize: { xs: 32, md: 46 },
                    lineHeight: 1,
                    fontWeight: 950,
                  }}
                >
                  {quickResult.cumplimiento === "tarde"
                    ? "Fuera de tiempo"
                    : "Buen recorrido"}
                </Typography>

                <Typography
                  sx={{
                    mt: 1.5,
                    fontSize: { xs: 18, md: 24 },
                    fontWeight: 800,
                  }}
                >
                  {quickResult.cumplimiento === "tarde"
                    ? "Puede mejorar, el recorrido se atraso."
                    : "Dentro del tiempo parametrizado."}
                </Typography>

                <Box
                  sx={{
                    mt: 2.5,
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                    gap: 1.25,
                  }}
                >
                  <ResultMetric
                    label="Equipo"
                    value={formatLines(quickResult.group.lineas)}
                  />
                  <ResultMetric
                    label="Tiempo"
                    value={`${quickResult.tiempoTotalMin} min`}
                  />
                  <ResultMetric
                    label="Objetivo"
                    value={`${quickResult.group.tiempoObjetivoMin} min`}
                  />
                </Box>

                <Typography sx={{ mt: 2, opacity: 0.86 }}>
                  {quickResult.assignedPerson?.nombre ?? "Almacenista"} | {quickResult.tolvas} tolvas
                </Typography>
              </Box>
            </Paper>
          ) : undefined}
        </Snackbar>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              lg: "repeat(4, minmax(0, 1fr))",
            },
            gap: 1.5,
          }}
        >
          <KioskSummaryCard
            icon={<AccessTime />}
            label="Turno habilitado"
            value={currentShift ? currentShift.nombre : "Fuera de turno"}
            detail={currentShift ? `${currentShift.inicio}-${currentShift.fin}` : "Espere el horario parametrizado"}
            color={currentShift ? "primary.main" : "warning.main"}
          />
          <KioskSummaryCard
            icon={<LocalShipping />}
            label="Recorridos activos"
            value={String(visibleActiveRuns.length)}
            detail="En tienda o reparto"
            color="success.main"
          />
          <KioskSummaryCard
            icon={<PauseCircle />}
            label="Personal en pausa"
            value={String(pausedPeople.length)}
            detail="Comida o pausa operativa"
            color="warning.main"
          />
          <KioskSummaryCard
            icon={<QrCodeScanner />}
            label="Equipos configurados"
            value={String(lineGroups.length)}
            detail="Códigos disponibles"
            color="secondary.main"
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(320px, 1fr)" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <Stack spacing={3}>
            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              {!pendingRun ? (
              <Stack spacing={3}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <QrCodeScanner color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      Escanear código de equipo
                    </Typography>
                    <Typography color="text.secondary">
                      Escanee el equipo. Si no hay recorrido activo, solicita tolvas. Si ya está activo, registra salida o retorno.
                    </Typography>
                  </Box>
                </Stack>

                <TextField
                  autoFocus
                  fullWidth
                  label="Código de barras del equipo"
                  value={barcode}
                  onChange={(event) => setBarcode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleScanLine();
                    }
                  }}
                  placeholder="000001516"
                />

                <Button
                  size="large"
                  variant="contained"
                  startIcon={<QrCodeScanner />}
                  onClick={handleScanLine}
                  sx={{ py: 1.5 }}
                >
                  Registrar escaneo
                </Button>

                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Códigos configurados desde Líneas y equipos
                  </Typography>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                    {lineGroups.map((group) => (
                      <Chip
                        key={group.id}
                        label={`${group.codigoBarras} - ${formatLines(group.lineas)}`}
                        color={activeRunByCode[group.codigoBarras] ? "primary" : "default"}
                        onClick={() => setBarcode(group.codigoBarras)}
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={3}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Inventory2 color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>
                      Entrada a tienda
                    </Typography>
                    <Typography color="text.secondary">
                      Equipo {formatLines(pendingRun.group.lineas)} | {pendingRun.group.tienda}
                    </Typography>
                    <Typography color="text.secondary">
                      Almacenista: {pendingRun.assignedPerson.nombre}
                    </Typography>
                    {pendingRun.entradaAt ? (
                      <Typography color="primary" sx={{ fontWeight: 700 }}>
                        Nueva entrada marcada: {formatTime(pendingRun.entradaAt)}
                      </Typography>
                    ) : null}
                  </Box>
                </Stack>

                <TextField
                  autoFocus
                  fullWidth
                  label="Cantidad de tolvas"
                  value={tolvas}
                  onChange={(event) => setTolvas(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleStartRun();
                    }
                  }}
                  inputMode="numeric"
                  placeholder="Ej. 24"
                />

                <Box sx={{ display: "flex", gap: 1.5 }}>
                  <Button
                    size="large"
                    variant="contained"
                    startIcon={<CheckCircle />}
                    onClick={handleStartRun}
                    disabled={savingRun}
                    sx={{ py: 1.5, flex: 1 }}
                  >
                    Iniciar recorrido
                  </Button>
                  <Button
                    size="large"
                    variant="outlined"
                    onClick={() => {
                      setPendingRun(null);
                      setTolvas("");
                      setMessage({
                        severity: "info",
                        text: "Escanee el código de barras del equipo de líneas.",
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                </Box>
              </Stack>
            )}
            </Paper>

            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
                <LocalShipping color="primary" fontSize="large" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Recorridos cerrados
                  </Typography>
                  <Typography color="text.secondary">
                    Ãšltimos recorridos de la sesión.
                  </Typography>
                </Box>
              </Stack>

              {completedRuns.length === 0 ? (
                <Typography color="text.secondary">Aún no hay recorridos cerrados.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  <CompletionResult run={completedRuns[0]} featured />
                  {completedRuns.map((run) => (
                    <Box
                      key={run.id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 1,
                        p: 1.5,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          Equipo {formatLines(run.group.lineas)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {run.assignedPerson?.nombre ?? "Sin almacenista"} | Entrada {formatTime(run.entradaAt)} | Salida {formatTime(run.salidaAt)} | Retorno {formatTime(run.retornoAt)}
                        </Typography>
                      </Box>
                      <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
                        {getCompletionIcon(run.cumplimiento)}
                        <Chip
                          color={run.cumplimiento === "tarde" ? "error" : "success"}
                          label={`${run.tiempoTotalMin} min / ${run.tolvas} tolvas`}
                        />
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              )}
            </Paper>
          </Stack>

          <Stack spacing={3}>
            <PausedPersonnelPanel
              people={pausedPeople}
              assignments={assignments}
              now={now}
            />

            <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
                <AccessTime color="primary" fontSize="large" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    Recorridos activos
                  </Typography>
                  <Typography color="text.secondary">
                    Hora actual: {now ? formatTime(now) : "--:--:--"}
                  </Typography>
                </Box>
              </Stack>

              {visibleActiveRuns.length === 0 ? (
                <Typography color="text.secondary">Sin recorridos activos.</Typography>
              ) : (
                <Stack spacing={1.25}>
                  {visibleActiveRuns.map((run) => (
                    <RunCard key={run.id} run={run} now={now ?? run.entradaAt} />
                  ))}
                </Stack>
              )}
            </Paper>

          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}





function dedupeActiveRunsByGroup(runs: ActiveKioskRun[]) {
  const sortedRuns = [...runs].sort(
    (left, right) => right.entradaAt.getTime() - left.entradaAt.getTime()
  );
  const seen = new Set<string>();

  return sortedRuns.filter((run) => {
    const key = run.group.codigoBarras;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 1.5,
        bgcolor: "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      <Typography variant="caption" sx={{ opacity: 0.78 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{value}</Typography>
    </Box>
  );
}
function KioskSummaryCard({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        minHeight: 118,
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            display: "grid",
            placeItems: "center",
            borderRadius: 1.5,
            color,
            bgcolor: "action.hover",
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
function PausedPersonnelPanel({
  people,
  assignments,
  now,
}: {
  people: SupplyPerson[];
  assignments: SupplyAssignment[];
  now: Date | null;
}) {
  const groups: Array<SupplyPerson["grupo"]> = ["grupo-1", "grupo-2"];
  const localDate = now ? getLocalDate(now) : undefined;

  return (
    <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 2 }}>
        <PauseCircle color="warning" fontSize="large" />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Personal en pausa
          </Typography>
          <Typography color="text.secondary">
            Se reactiva automáticamente al escanear su equipo.
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={1.25}>
        {groups.map((group) => {
          const groupPeople = people.filter((person) => person.grupo === group);

          return (
            <Box
              key={group}
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}
              >
                <Typography sx={{ fontWeight: 800 }}>{formatGroup(group)}</Typography>
                <Chip
                  size="small"
                  color={groupPeople.length ? "warning" : "default"}
                  label={`${groupPeople.length} en pausa`}
                />
              </Stack>

              {!groupPeople.length ? (
                <Typography variant="body2" color="text.secondary">
                  Sin personal en pausa en este grupo.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {groupPeople.map((person) => {
                    const assignment = findCurrentAssignmentForPerson(
                      person,
                      assignments,
                      localDate
                    );

                    return (
                      <Box
                        key={person.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 1,
                          alignItems: "center",
                        }}
                      >
                        <Box>
                          <Typography sx={{ fontWeight: 700 }}>
                            {person.nombre}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            SAP {person.sapId} | {person.puesto}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Equipo: {assignment ? formatLines(assignment.lineas) : "Sin equipo vigente"}
                          </Typography>
                        </Box>
                        <Chip color="warning" label="Pausa comida" />
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
function RunCard({ run, now }: { run: ActiveKioskRun; now: Date }) {
  const elapsed = diffMinutes(run.entradaAt, now);
  const fillingTime = run.salidaAt ? diffMinutes(run.entradaAt, run.salidaAt) : elapsed;
  const deliveryTime = run.salidaAt ? diffMinutes(run.salidaAt, now) : 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 1,
        p: 1.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
      }}
    >
      <Box>
        <Typography sx={{ fontWeight: 700 }}>
          Equipo {formatLines(run.group.lineas)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Almacenista: {run.assignedPerson?.nombre ?? "Sin asignación"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {run.step === "llenando_carro"
            ? `Llenando carro: ${fillingTime} min desde entrada`
            : `Repartiendo: ${deliveryTime} min desde salida`}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Entrada {formatTime(run.entradaAt)}
          {run.salidaAt ? ` | Salida ${formatTime(run.salidaAt)}` : ""}
        </Typography>
      </Box>
      <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
        <Chip
          color={run.step === "llenando_carro" ? "warning" : "primary"}
          label={run.step === "llenando_carro" ? "Dentro tienda" : "En reparto"}
        />
        <Chip variant="outlined" label={`${run.tolvas} tolvas`} />
      </Stack>
    </Box>
  );
}

function CompletionResult({
  run,
  featured,
}: {
  run: CompletedKioskRun;
  featured?: boolean;
}) {
  const isLate = run.cumplimiento === "tarde";

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 1.5,
        alignItems: "center",
        p: featured ? 2 : 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: isLate ? "error.light" : "success.light",
        bgcolor: isLate ? "rgba(211, 47, 47, 0.08)" : "rgba(46, 125, 50, 0.08)",
      }}
    >
      <Box sx={{ display: "flex", color: isLate ? "error.main" : "success.main" }}>
        {getCompletionIcon(run.cumplimiento, featured ? 56 : 36)}
      </Box>
      <Box>
        <Typography variant={featured ? "h6" : "body1"} sx={{ fontWeight: 900 }}>
          {isLate ? "Fuera de tiempo" : "Dentro del tiempo"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Equipo {formatLines(run.group.lineas)} | {run.assignedPerson?.nombre ?? "Sin almacenista"}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total {run.tiempoTotalMin} min | Objetivo {run.group.tiempoObjetivoMin} min | {run.tolvas} tolvas
        </Typography>
      </Box>
      <Chip
        color={isLate ? "error" : "success"}
        label={isLate ? "Triste" : "Feliz"}
      />
    </Box>
  );
}

function formatLines(lineas: string[]) {
  return lineas.join("/");
}

function formatGroup(group: SupplyPerson["grupo"]) {
  return group === "grupo-1" ? "Grupo 1" : "Grupo 2";
}

function buildShiftMismatchMessage(
  group: SupplyTimeParameter,
  assignments: SupplyAssignment[],
  people: SupplyPerson[],
  date: Date
) {
  const fecha = getLocalDate(date);
  const activeShiftId = getActiveShiftForDate(date);
  const activeShiftName = activeShiftId ? getShiftLabel(activeShiftId) : "Fuera de turno";
  const validAssignments = assignments.filter((item) => {
    const startsBefore = item.vigenteDesde <= fecha;
    const endsAfter = !item.vigenteHasta || item.vigenteHasta >= fecha;
    return startsBefore && endsAfter && sameLineSet(item.lineas, group.lineas);
  });

  if (validAssignments.length === 0) {
    return `El equipo ${formatLines(group.lineas)} no tiene asignación vigente. Asigne el equipo al grupo y almacenista correspondiente antes de iniciar.`;
  }

  const details = validAssignments
    .map((assignment) => {
      const person = people.find((item) => item.id === assignment.almacenistaId);
      const personGroup = person ? formatGroup(person.grupo) : "Grupo no encontrado";
      const personShift = person ? getShiftLabel(person.turnoId) : "Turno no encontrado";
      const assignmentShift = getShiftLabel(assignment.turnoId);
      const personName = person?.nombre ?? "Sin almacenista";
      return `${personGroup} / ${assignmentShift}: ${personName} (${personShift})`;
    })
    .join(" | ");

  return `Equipo ${formatLines(group.lineas)} bloqueado para ${activeShiftName}. Asignaciones vigentes: ${details}. Use Cambio de turno desde administrador si el grupo debe rotar.`;
}

function getShiftLabel(turnoId?: string) {
  return supplyShifts.find((shift) => shift.id === turnoId)?.nombre ?? "Sin turno";
}

function resolveAssignmentForGroup(
  group: SupplyTimeParameter,
  assignments: SupplyAssignment[],
  people: SupplyPerson[],
  date: Date
): PendingKioskRun | null {
  const fecha = getLocalDate(date);
  const turnoId = getActiveShiftForDate(date);

  if (!turnoId) {
    return null;
  }

  const validAssignments = assignments.filter((item) => {
    const startsBefore = item.vigenteDesde <= fecha;
    const endsAfter = !item.vigenteHasta || item.vigenteHasta >= fecha;
    return startsBefore && endsAfter && sameLineSet(item.lineas, group.lineas);
  });

  for (const assignment of validAssignments) {
    if (assignment.turnoId !== turnoId) {
      continue;
    }

    const assignedPerson = people.find(
      (person) => person.id === assignment.almacenistaId
    );

    if (!assignedPerson) {
      continue;
    }

    const personBelongsToActiveShift = assignedPerson.turnoId === turnoId;
    const personIsOperational = isOperationalPosition(assignedPerson.puesto);

    if (!personBelongsToActiveShift || !personIsOperational) {
      continue;
    }

    return {
      group,
      assignment,
      assignedPerson,
    };
  }

  return null;
}

function findCurrentAssignmentForPerson(
  person: SupplyPerson,
  assignments: SupplyAssignment[],
  localDate?: string
) {
  return assignments.find((assignment) => {
    const belongsToPerson = assignment.almacenistaId === person.id;
    const isCurrent =
      !localDate ||
      (assignment.vigenteDesde <= localDate &&
        (!assignment.vigenteHasta || assignment.vigenteHasta >= localDate));

    return belongsToPerson && isCurrent;
  });
}

function isOperationalPosition(position: SupplyPerson["puesto"]) {
  return position === "almacenista" || position === "facilitador";
}

function getLocalDate(date: Date) {
  return date.toLocaleDateString("en-CA", {
    timeZone: SUPPLY_TIMEZONE,
  });
}

function getActiveShiftForDate(date: Date) {
  const time = new Intl.DateTimeFormat("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SUPPLY_TIMEZONE,
  }).format(date);
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute;
  const shift = supplyShifts.find((item) => {
    const start = timeToMinutes(item.inicio);
    const end = timeToMinutes(item.fin);

    return total >= start && total <= end;
  });

  return shift?.id ?? null;
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function formatShiftWindows() {
  return supplyShifts
    .map((shift) => `${shift.nombre} ${shift.inicio}-${shift.fin}`)
    .join(", ");
}

function sameLineSet(left: string[], right: string[]) {
  return normalizeLines(left) === normalizeLines(right);
}

function normalizeLines(lineas: string[]) {
  return [...lineas]
    .map((line) => line.trim().toUpperCase())
    .sort()
    .join("|");
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function getRunStatus(tiempoTotalMin: number, group: SupplyTimeParameter) {
  if (tiempoTotalMin < group.tiempoObjetivoMin - group.toleranciaRapidoMin) {
    return "rapido";
  }

  if (tiempoTotalMin > group.tiempoObjetivoMin + group.toleranciaTardeMin) {
    return "tarde";
  }

  return "en_rango";
}

function getCompletionIcon(
  cumplimiento: CompletedKioskRun["cumplimiento"],
  size = 32
) {
  return cumplimiento === "tarde" ? (
    <SentimentDissatisfied sx={{ fontSize: size }} />
  ) : (
    <SentimentSatisfiedAlt sx={{ fontSize: size }} />
  );
}

function getCompletionFaceText(cumplimiento: CompletedKioskRun["cumplimiento"]) {
  return cumplimiento === "tarde" ? "Carita triste." : "Carita feliz.";
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("es-SV", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: SUPPLY_TIMEZONE,
  }).format(date);
}

