"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
  Alert,
} from "@mui/material";
import type {
  SupplyAssignment,
  SupplyCrewGroup,
  SupplyPerson,
  SupplyTimeParameter,
} from "@/types/abastecimiento";
import {
  getShiftName,
  SUPPLY_STORE,
  supplyPersonnel,
  supplyRotationPlan,
  supplyShifts,
} from "@/services/abastecimiento/abastecimiento.service";
import { useLineCatalog } from "@/modules/abastecimiento/hooks/useLineCatalog";
import {
  type AccessUser,
  closeCurrentAssignmentInDb,
  createAssignmentInDb,
  listAccessUsersFromDb,
  listAssignmentsFromDb,
  listPersonnelFromDb,
  updatePersonShiftInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import {
  belongsToGroupScope,
  findCurrentAccess,
  formatGroupScope,
  getSessionGroupScope,
  isAdminAccess,
  isSupervisorAccess,
  type GroupScope,
} from "@/services/auth/current-access";

interface Props {
  initialAssignments: SupplyAssignment[];
}

export default function AssignmentManager({ initialAssignments }: Props) {
  const [assignments, setAssignments] = useState(initialAssignments);
  const [people, setPeople] = useState(supplyPersonnel);
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [currentAccess, setCurrentAccess] = useState<AccessUser | null>(null);
  const [accessResolved, setAccessResolved] = useState(false);
  const [rotationMessage, setRotationMessage] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState({
    severity: "info" as "success" | "info" | "warning" | "error",
    text: "",
  });
  const [rotating, setRotating] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const { lines, lineGroups, loading: loadingLineCatalog } = useLineCatalog();
  const [draft, setDraft] = useState({
    almacenistaId: "",
    turnoId: "turno-a",
    supervisorId: "",
    facilitadorId: "",
    cubreAusenciaDeId: "",
    lineas: "",
    tienda: SUPPLY_STORE,
    vigenteDesde: getTodayInSupplyTimezone(),
  });

  const isAdmin = isAdminAccess(currentAccess);
  const isSupervisor = isSupervisorAccess(currentAccess);
  const groupScope: GroupScope = accessResolved
    ? getSessionGroupScope(currentAccess)
    : "sin-grupo";
  const supervisorGroup = groupScope === "grupo-1" || groupScope === "grupo-2" ? groupScope : undefined;
  const visibleGroups = useMemo<SupplyCrewGroup[]>(
    () =>
      groupScope === "todos"
        ? ["grupo-1", "grupo-2"]
        : groupScope === "sin-grupo"
          ? []
          : [groupScope],
    [groupScope]
  );
  const visiblePeople = useMemo(
    () =>
      groupScope === "todos"
        ? people
        : people.filter((person) => belongsToGroupScope(person.grupo, groupScope)),
    [groupScope, people]
  );
  const visibleAssignments = useMemo(
    () =>
      groupScope === "todos"
        ? assignments
        : assignments.filter((assignment) =>
            assignmentBelongsToGroup(assignment, people, groupScope)
          ),
    [assignments, groupScope, people]
  );
  const currentAssignments = useMemo(
    () => visibleAssignments.filter((assignment) => !assignment.vigenteHasta),
    [visibleAssignments]
  );
  const warehouseKeepers = visiblePeople.filter(
    (person) => person.puesto === "almacenista"
  );
  const facilitators = visiblePeople.filter((person) => person.puesto === "facilitador");
  const supervisors = accessUsers.filter(
    (user) =>
      user.rol === "supervisor" &&
      user.activo &&
      (groupScope === "todos" || user.grupo === groupScope)
  );
  const selectedLines = selectedDraftLines(draft.lineas);
  const selectedLineGroup = findLineGroupForLines(lineGroups, selectedLines);
  const selectedKeeper = warehouseKeepers.find(
    (person) => person.id === draft.almacenistaId
  );
  const operationalPeople = visiblePeople.filter(
    (person) => person.puesto === "almacenista" || person.puesto === "facilitador"
  );
  const allOperationalPeople = people.filter(
    (person) => person.puesto === "almacenista" || person.puesto === "facilitador"
  );
  const teamAssignments = useMemo(
    () => buildTeamAssignments(lineGroups, currentAssignments, visiblePeople, visibleGroups),
    [currentAssignments, lineGroups, visibleGroups, visiblePeople]
  );
  const coverageSummary = useMemo(
    () => buildCoverageSummary(lineGroups, lines, currentAssignments, visiblePeople),
    [currentAssignments, lineGroups, lines, visiblePeople]
  );
  const groupShiftStatus = useMemo(
    () => visibleGroups.map((group) => buildGroupShiftStatus(operationalPeople, group)),
    [operationalPeople, visibleGroups]
  );
  const canRotate = isAdmin && allOperationalPeople.length > 0;
  const groupOneMorning =
    buildGroupShiftStatus(allOperationalPeople, "grupo-1").turnoId === "turno-a";

  useEffect(() => {
    let active = true;

    Promise.all([
      listAssignmentsFromDb(),
      listPersonnelFromDb(),
      listAccessUsersFromDb(),
      getCurrentUser(),
    ]).then(([dbAssignments, dbPeople, dbAccessUsers, auth]) => {
      if (!active) {
        return;
      }

      const access = findCurrentAccess(dbAccessUsers, auth);
      const accessGroup = access?.rol === "supervisor" ? access.grupo : undefined;

      if (dbAssignments) {
        setAssignments(dbAssignments);
      }

      if (dbAccessUsers) {
        setAccessUsers(dbAccessUsers);
      }

      setCurrentAccess(access);
      setAccessResolved(true);

      if (dbPeople) {
        setPeople(dbPeople);
        const visibleDbPeople = accessGroup
          ? dbPeople.filter((person) => person.grupo === accessGroup)
          : dbPeople;
        const firstKeeper = visibleDbPeople.find(
          (person) => person.puesto === "almacenista"
        );
        const firstFacilitator = visibleDbPeople.find(
          (person) => person.puesto === "facilitador"
        );
        const firstSupervisor =
          access?.rol === "supervisor"
            ? access
            : dbAccessUsers?.find(
                (user) =>
                  user.rol === "supervisor" &&
                  user.activo &&
                  (!accessGroup || user.grupo === accessGroup)
              );

        setDraft((current) => ({
          ...current,
          almacenistaId: firstKeeper?.id ?? "",
          supervisorId: firstSupervisor?.id ?? "",
          facilitadorId: firstFacilitator?.id ?? "",
          cubreAusenciaDeId: "",
          turnoId: firstKeeper?.turnoId ?? current.turnoId,
        }));
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSaveAssignment(lineasOverride?: string[]) {
    const newLines = (lineasOverride ?? selectedDraftLines(draft.lineas))
      .map((line) => line.trim().toUpperCase())
      .filter(Boolean);

    if (!isAdmin && groupScope === "sin-grupo") {
      setAssignmentMessage({
        severity: "error",
        text: "Este supervisor no tiene grupo asignado en Accesos.",
      });
      return false;
    }

    const keeper = people.find((person) => person.id === draft.almacenistaId);

    if (!isAdmin && !belongsToGroupScope(keeper?.grupo, groupScope)) {
      setAssignmentMessage({
        severity: "error",
        text: "El supervisor solo puede modificar almacenistas de su grupo asignado.",
      });
      return false;
    }

    if (!draft.almacenistaId || newLines.length === 0) {
      setAssignmentMessage({
        severity: "warning",
        text: "Seleccione un almacenista y un equipo antes de guardar.",
      });
      return false;
    }

    setSavingAssignment(true);
    setAssignmentMessage({ severity: "info", text: "" });

    const newAssignment: SupplyAssignment = {
      id: `asg-${draft.almacenistaId}-${draft.vigenteDesde}-${newLines.join("-")}`,
      almacenistaId: draft.almacenistaId,
      supervisorId: isSupervisor ? currentAccess?.id ?? draft.supervisorId : draft.supervisorId,
      facilitadorId: draft.facilitadorId || undefined,
      cubreAusenciaDeId: draft.cubreAusenciaDeId || undefined,
      turnoId: draft.turnoId,
      lineas: newLines,
      tienda: draft.tienda,
      vigenteDesde: draft.vigenteDesde,
    };

    const vigenteHasta = previousDay(draft.vigenteDesde);

    await closeCurrentAssignmentInDb({
      almacenistaId: draft.almacenistaId,
      vigenteHasta,
    });
    const saved = await createAssignmentInDb(newAssignment);

    if (!saved) {
      setSavingAssignment(false);
      setAssignmentMessage({
        severity: "error",
        text: "No se pudo guardar la asignación en Supabase. Revise la consola o el API.",
      });
      return false;
    }

    setAssignments((current) => [
      ...current.map((assignment) =>
        assignment.almacenistaId === draft.almacenistaId && !assignment.vigenteHasta
          ? { ...assignment, vigenteHasta }
          : assignment
      ),
      saved ?? newAssignment,
    ]);
    setPeople((current) =>
      current.map((person) =>
        person.id === draft.almacenistaId ? { ...person, turnoId: draft.turnoId } : person
      )
    );
    setSavingAssignment(false);
    setAssignmentMessage({
      severity: "success",
      text: `Asignación guardada en base de datos para ${personName(
        people,
        draft.almacenistaId
      )}.`,
    });
    return true;
  }

  async function rotateShiftsByGroup() {
    if (isSupervisor) {
      setRotationMessage("El cambio de turno por grupo solo puede hacerlo el administrador.");
      return;
    }

    if (!canRotate || rotating) {
      setRotationMessage(
        "Primero registre personal operativo con Grupo 1 o Grupo 2 para poder cambiar turnos."
      );
      return;
    }

    setRotating(true);
    setRotationMessage("");

    const nextGroupOneShift = groupOneMorning ? "turno-b" : "turno-a";
    const nextGroupTwoShift = groupOneMorning ? "turno-a" : "turno-b";
    const nextPeople = people.map((person) => {
      if (person.grupo === "grupo-1") {
        return { ...person, turnoId: nextGroupOneShift };
      }

      if (person.grupo === "grupo-2") {
        return { ...person, turnoId: nextGroupTwoShift };
      }

      return person;
    });
    const effectiveDate = getTodayInSupplyTimezone();
    const nextCurrentAssignments = currentAssignments.map((assignment) => {
      if (assignment.vigenteHasta) {
        return assignment;
      }

      const person = nextPeople.find((item) => item.id === assignment.almacenistaId);

      if (!person) {
        return assignment;
      }

      const nextTurnoId =
        person.grupo === "grupo-1" ? nextGroupOneShift : nextGroupTwoShift;

      return {
        ...assignment,
        id: `asg-${assignment.almacenistaId}-${Date.now()}`,
        turnoId: nextTurnoId,
        vigenteDesde: effectiveDate,
        vigenteHasta: undefined,
      };
    });
    const closedAssignmentIds = new Set(currentAssignments.map((assignment) => assignment.id));
    const nextAssignments = [
      ...assignments.map((assignment) =>
        closedAssignmentIds.has(assignment.id)
          ? { ...assignment, vigenteHasta: previousDay(effectiveDate) }
          : assignment
      ),
      ...nextCurrentAssignments,
    ];

    setPeople(nextPeople);
    setAssignments(nextAssignments);

    await Promise.all([
      ...nextPeople.map((person) =>
        updatePersonShiftInDb({
          id: person.id,
          turnoId: person.turnoId,
        })
      ),
      ...currentAssignments.map((assignment) =>
        closeCurrentAssignmentInDb({
          almacenistaId: assignment.almacenistaId,
          vigenteHasta: previousDay(effectiveDate),
        })
      ),
      ...nextCurrentAssignments.map((assignment) =>
        createAssignmentInDb({
          ...assignment,
          id: `asg-${assignment.almacenistaId}-${Date.now()}`,
        })
      ),
    ]);

    const [dbAssignments, dbPeople] = await Promise.all([
      listAssignmentsFromDb(),
      listPersonnelFromDb(),
    ]);

    if (dbPeople) {
      setPeople(dbPeople);
    }

    if (dbAssignments) {
      setAssignments(dbAssignments);
    }

    setRotationMessage(
      nextGroupOneShift === "turno-a"
        ? "Cambio aplicado: Grupo 1 en mañana y Grupo 2 en tarde."
        : "Cambio aplicado: Grupo 1 en tarde y Grupo 2 en mañana."
    );
    setRotating(false);
  }

  function selectLineGroup(group: SupplyTimeParameter) {
    setDraft((current) => ({
      ...current,
      lineas: group.lineas.join(","),
    }));
  }

  async function assignLineGroup(group: SupplyTimeParameter) {
    selectLineGroup(group);
    await handleSaveAssignment(group.lineas);
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{ justifyContent: "space-between", gap: 2, alignItems: { xs: "flex-start", md: "center" } }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Resumen de asignaciones
            </Typography>
            <Typography color="text.secondary">
              Vista operativa segun el usuario con sesión iniciada.
            </Typography>
          </Box>
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
            <Chip
              color={isSupervisor ? "primary" : "default"}
              label={
                isSupervisor
                  ? `Supervisor: ${formatGroupName(supervisorGroup ?? "grupo-1")}`
                  : "Administrador: Grupo 1 y Grupo 2"
              }
            />
            {currentAccess ? (
              <Chip variant="outlined" label={`${currentAccess.sapId} - ${currentAccess.nombre}`} />
            ) : null}
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            gap: 1.5,
            mt: 2,
          }}
        >
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Personal visible</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>{operationalPeople.length}</Typography>
          </Box>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Asignaciónes vigentes</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>{currentAssignments.length}</Typography>
          </Box>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Equipos asignados</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>{coverageSummary.assignedTeams.length}</Typography>
          </Box>
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">Equipos pendientes</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900 }}>{coverageSummary.unassignedTeams.length}</Typography>
          </Box>
        </Box>
      </Paper>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "1fr auto" },
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Asignar equipo a almacenista
            </Typography>
            <Typography color="text.secondary">
              Seleccione el almacenista, confirme supervisor/facilitador y asocie el equipo de líneas que escaneara en kiosko. El histórico se conserva.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={rotateShiftsByGroup}
            disabled={!canRotate || rotating}
            sx={{ display: isSupervisor ? "none" : "inline-flex" }}
          >
            {groupOneMorning
              ? "Grupo 1 tarde / Grupo 2 mañana"
              : "Grupo 1 mañana / Grupo 2 tarde"}
          </Button>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
            gap: 1.5,
            mt: 2,
          }}
        >
          {groupShiftStatus.map((status) => (
            <Box
              key={status.grupo}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                sx={{
                  alignItems: { xs: "flex-start", sm: "center" },
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {status.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {status.count} personas operativas
                  </Typography>
                </Box>
                <Chip
                  color={
                    status.turnoId === ""
                      ? "default"
                      : status.turnoId === "turno-a"
                        ? "primary"
                        : "secondary"
                  }
                  label={status.turnoLabel}
                  variant={status.turnoId ? "filled" : "outlined"}
                />
              </Stack>
            </Box>
          ))}
        </Box>

        {isSupervisor && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Los cambios se guardaran solamente sobre {formatGroupScope(groupScope)}.
            No puede ver ni modificar asignaciones del otro grupo.
          </Alert>
        )}

        {!canRotate && !isSupervisor && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            No hay personal operativo registrado. Agregue almacenistas o facilitadores en
            Personal Operativo para poder cambiar Grupo 1 y Grupo 2 de turno.
          </Alert>
        )}

        {rotationMessage && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {rotationMessage}
          </Alert>
        )}

        {assignmentMessage.text && (
          <Alert severity={assignmentMessage.severity} sx={{ mt: 2 }}>
            {assignmentMessage.text}
          </Alert>
        )}

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
            mt: 2,
          }}
        >
          <TextField
            select
            label="Almacenista a asignar"
            value={draft.almacenistaId}
            onChange={(event) => {
              const keeper = warehouseKeepers.find(
                (person) => person.id === event.target.value
              );

              setDraft((current) => ({
                ...current,
                almacenistaId: event.target.value,
                turnoId: keeper?.turnoId ?? current.turnoId,
              }));
            }}
          >
            <MenuItem value="">Seleccione almacenista</MenuItem>
            {warehouseKeepers.map((person) => (
              <MenuItem key={person.id} value={person.id}>
                {person.sapId} - {person.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Turno"
            value={draft.turnoId}
            disabled={isSupervisor}
            onChange={(event) =>
              setDraft((current) => ({ ...current, turnoId: event.target.value }))
            }
          >
            {supplyShifts.map((shift) => (
              <MenuItem key={shift.id} value={shift.id}>
                {shift.nombre} ({shift.inicio}-{shift.fin})
              </MenuItem>
            ))}
          </TextField>

          {selectedKeeper && (
            <Stack direction="row" sx={{ gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Chip label={formatGroupName(selectedKeeper.grupo)} color="primary" />
              <Chip label={getShiftName(selectedKeeper.turnoId)} variant="outlined" />
            </Stack>
          )}

          <TextField
            select
            label="Supervisor"
            value={draft.supervisorId}
            disabled={isSupervisor}
            onChange={(event) =>
              setDraft((current) => ({ ...current, supervisorId: event.target.value }))
            }
          >
            {supervisors.map((supervisor) => (
              <MenuItem key={supervisor.id} value={supervisor.id}>
                {supervisor.sapId} - {supervisor.nombre}
              </MenuItem>
            ))}
            <MenuItem value="">Sin supervisor</MenuItem>
          </TextField>

          <TextField
            select
            label="Facilitador"
            value={draft.facilitadorId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, facilitadorId: event.target.value }))
            }
          >
            <MenuItem value="">Sin facilitador</MenuItem>
            {facilitators.map((person) => (
              <MenuItem key={person.id} value={person.id}>
                {person.sapId} - {person.nombre}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Cubre ausencia de"
            value={draft.cubreAusenciaDeId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, cubreAusenciaDeId: event.target.value }))
            }
          >
            <MenuItem value="">Sin cobertura</MenuItem>
            {warehouseKeepers.map((person) => (
              <MenuItem key={person.id} value={person.id}>
                {person.sapId} - {person.nombre}
              </MenuItem>
            ))}
          </TextField>

          <Box
            sx={{
              gridColumn: { xs: "1", md: "1 / -1" },
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
                gap: 1.5,
                alignItems: "center",
                mb: 1.5,
              }}
            >
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Equipos de líneas para asociar
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Seleccione un equipo ya creado. El código de barras de ese equipo será el que se escanee en kiosko.
                </Typography>
              </Box>
              <Chip
                color={selectedLines.length ? "primary" : "default"}
                label={`${selectedLines.length} líneas del equipo`}
              />
            </Box>

            {selectedLineGroup && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Equipo seleccionado: {formatLineGroupName(selectedLineGroup)} | Código{" "}
                {selectedLineGroup.codigoBarras} | Asociado a{" "}
                {selectedKeeper?.nombre ?? "almacenista pendiente"}
              </Alert>
            )}

            {!loadingLineCatalog && lineGroups.length === 0 && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Primero cree equipos en Líneas y equipos. Luego podrá asociarlos a cada
                almacenista desde esta pantalla.
              </Alert>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
                gap: 1.5,
              }}
            >
              {lineGroups.map((group) => (
                <Box
                  key={group.id}
                  sx={{
                    border: "1px solid",
                    borderColor: selectedLineGroup?.id === group.id ? "primary.main" : "divider",
                    borderRadius: 1,
                    p: 1.5,
                    bgcolor:
                      selectedLineGroup?.id === group.id ? "primary.50" : "background.paper",
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 1,
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 800 }}>
                          Equipo {formatLineGroupName(group)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Código kiosko: {group.codigoBarras}
                        </Typography>
                      </Box>
                      <Chip size="small" label={`${group.lineas.length} líneas`} />
                    </Stack>

                    <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap" }}>
                      {group.lineas.map((line) => (
                        <Chip key={line} size="small" variant="outlined" label={line} />
                      ))}
                    </Stack>

                    <Button
                      variant={selectedLineGroup?.id === group.id ? "contained" : "outlined"}
                      onClick={() => assignLineGroup(group)}
                      disabled={!selectedKeeper || savingAssignment}
                    >
                      {selectedLineGroup?.id === group.id
                        ? savingAssignment
                          ? "Guardando..."
                          : "Equipo guardado"
                        : selectedKeeper
                          ? `Asociar y guardar a ${selectedKeeper.nombre}`
                          : "Seleccionar equipo"}
                    </Button>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Box>

          <TextField label="Tienda" value={SUPPLY_STORE} disabled />

          <TextField
            type="date"
            label="Vigente desde"
            value={draft.vigenteDesde}
            onChange={(event) =>
              setDraft((current) => ({ ...current, vigenteDesde: event.target.value }))
            }
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Button
            variant="contained"
            onClick={() => handleSaveAssignment()}
            disabled={!draft.almacenistaId || selectedLines.length === 0 || savingAssignment}
          >
            {savingAssignment ? "Guardando..." : "Guardar cambio"}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Plan activo: {supplyRotationPlan.nombre}, cada {supplyRotationPlan.duracionDias} dias.
          Proximo cambio sugerido: {supplyRotationPlan.proximoCambio}.
        </Typography>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {isSupervisor ? "Equipos de mi grupo" : "Equipos por Grupo 1 y Grupo 2"}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {isSupervisor
            ? "Solo se muestra la asignacion del grupo del supervisor con sesión iniciada."
            : "El mismo equipo puede estar asignado a ambos grupos con distinto almacenista, turno, tiempo y cumplimiento."}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", xl: "repeat(2, 1fr)" },
            gap: 1.5,
          }}
        >
          {teamAssignments.map((team) => (
            <Box
              key={team.team.id}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: 1.5,
              }}
            >
              <Stack spacing={1.5}>
                <Stack
                  direction="row"
                  sx={{ justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>
                      Equipo {formatLineGroupName(team.team)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Código kiosko: {team.team.codigoBarras}
                    </Typography>
                  </Box>
                  <Chip label={`${team.team.lineas.length} líneas`} />
                </Stack>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
                    gap: 1,
                  }}
                >
                  {team.groups.map((item) => (
                    <Box
                      key={`${team.team.id}-${item.group}`}
                      sx={{
                        border: "1px solid",
                        borderColor: item.assignment ? "primary.main" : "divider",
                        borderRadius: 1,
                        p: 1.25,
                      }}
                    >
                      <Stack spacing={0.75}>
                        <Stack
                          direction="row"
                          sx={{ justifyContent: "space-between", gap: 1 }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {formatGroupName(item.group)}
                          </Typography>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={getShiftName(item.assignment?.turnoId ?? item.turnoId)}
                          />
                        </Stack>
                        <Typography sx={{ fontWeight: 700 }}>
                          {item.person?.nombre ?? "Sin almacenista"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.assignment
                            ? `${item.assignment.lineas.join("/")} | vigente desde ${item.assignment.vigenteDesde}`
                            : "Pendiente de asignar"}
                        </Typography>
                      </Stack>
                    </Box>
                  ))}
                </Box>
              </Stack>
            </Box>
          ))}

          {!teamAssignments.length && (
            <Typography color="text.secondary">
              Cree equipos en Líneas y equipos para ver esta matriz.
            </Typography>
          )}
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Cobertura de líneas y equipos
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Lista rápida para identificar equipos con almacenista asignado y líneas que aún
          no tienen cobertura vigente.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" },
            gap: 2,
          }}
        >
          <CoverageTable
            title="Equipos con asignación"
            rows={coverageSummary.assignedTeams}
            emptyText="Sin equipos asignados."
            statusColor="success"
          />
          <CoverageTable
            title="Equipos sin asignación"
            rows={coverageSummary.unassignedTeams}
            emptyText="Todos los equipos tienen asignación."
            statusColor="warning"
          />
          <CoverageTable
            title="Líneas con asignación"
            rows={coverageSummary.assignedLines}
            emptyText="Sin líneas asignadas."
            statusColor="success"
          />
          <CoverageTable
            title="Líneas sin asignación"
            rows={coverageSummary.unassignedLines}
            emptyText="Todas las líneas activas están cubiertas."
            statusColor="warning"
          />
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Asignaciónes vigentes
        </Typography>

        <AssignmentTable
          assignments={currentAssignments}
          people={visiblePeople}
          accessUsers={accessUsers}
          lineGroups={lineGroups}
        />
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Histórico
        </Typography>

        <AssignmentTable
          assignments={visibleAssignments}
          people={visiblePeople}
          accessUsers={accessUsers}
          lineGroups={lineGroups}
          showDates
        />
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Catálogo disponible
        </Typography>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Equipos de líneas
        </Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", mb: 2 }}>
          {lineGroups.map((group) => (
            <Chip
              key={group.id}
              label={`${formatLineGroupName(group)} | ${group.codigoBarras}`}
            />
          ))}
          {!lineGroups.length && <Chip label="Sin equipos creados" />}
        </Stack>

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Líneas independientes
        </Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          {lines.map((line) => (
            <Chip key={line.id} label={`${line.codigo} - ${line.nombre}`} />
          ))}
          {!lines.length && <Chip label="Sin líneas creadas" />}
        </Stack>
      </Paper>
    </Stack>
  );
}

interface GroupShiftStatus {
  grupo: SupplyPerson["grupo"];
  label: string;
  turnoId: "turno-a" | "turno-b" | "";
  turnoLabel: string;
  count: number;
}


function assignmentBelongsToGroup(
  assignment: SupplyAssignment,
  people: SupplyPerson[],
  group: GroupScope
) {
  const person = people.find((item) => item.id === assignment.almacenistaId);
  return belongsToGroupScope(person?.grupo, group);
}
function buildGroupShiftStatus(
  people: SupplyPerson[],
  grupo: SupplyPerson["grupo"]
): GroupShiftStatus {
  const groupPeople = people.filter((person) => person.grupo === grupo);

  if (groupPeople.length === 0) {
    return {
      grupo,
      label: formatGroupName(grupo),
      turnoId: "",
      turnoLabel: "Sin personal asignado",
      count: 0,
    };
  }

  const morningCount = groupPeople.filter((person) => person.turnoId === "turno-a").length;
  const afternoonCount = groupPeople.filter((person) => person.turnoId === "turno-b").length;
  const turnoId = morningCount >= afternoonCount ? "turno-a" : "turno-b";

  return {
    grupo,
    label: formatGroupName(grupo),
    turnoId,
    turnoLabel: turnoId === "turno-a" ? "Turno Mañana" : "Turno Tarde",
    count: groupPeople.length,
  };
}

function formatGroupName(grupo: SupplyPerson["grupo"]) {
  return grupo === "grupo-1" ? "Grupo 1" : "Grupo 2";
}

interface TeamAssignmentGroup {
  group: SupplyCrewGroup;
  turnoId: string;
  assignment?: SupplyAssignment;
  person?: SupplyPerson;
}

interface TeamAssignmentSummary {
  team: SupplyTimeParameter;
  groups: TeamAssignmentGroup[];
}

interface CoverageRow {
  id: string;
  nombre: string;
  detalle: string;
  almacenista?: string;
  grupo?: string;
  turno?: string;
}

interface CoverageSummary {
  assignedTeams: CoverageRow[];
  unassignedTeams: CoverageRow[];
  assignedLines: CoverageRow[];
  unassignedLines: CoverageRow[];
}

function buildTeamAssignments(
  teams: SupplyTimeParameter[],
  assignments: SupplyAssignment[],
  people: SupplyPerson[],
  groups: SupplyCrewGroup[] = ["grupo-1", "grupo-2"]
): TeamAssignmentSummary[] {
  return teams.map((team) => ({
    team,
    groups: groups.map((group) => {
      const assignment = assignments.find((item) => {
        const person = people.find((candidate) => candidate.id === item.almacenistaId);
        return person?.grupo === group && sameLineSet(item.lineas, team.lineas);
      });
      const person = assignment
        ? people.find((candidate) => candidate.id === assignment.almacenistaId)
        : people.find((candidate) => candidate.grupo === group);

      return {
        group,
        turnoId: person?.turnoId ?? "",
        assignment,
        person: assignment ? person : undefined,
      };
    }),
  }));
}

function buildCoverageSummary(
  teams: SupplyTimeParameter[],
  lines: { id: string; codigo: string; nombre: string; activa: boolean }[],
  assignments: SupplyAssignment[],
  people: SupplyPerson[]
): CoverageSummary {
  const activeLines = lines.filter((line) => line.activa);
  const assignedTeams: CoverageRow[] = [];
  const unassignedTeams: CoverageRow[] = [];
  const assignedLines: CoverageRow[] = [];
  const unassignedLines: CoverageRow[] = [];

  teams.forEach((team) => {
    const matchingAssignments = assignments.filter((assignment) =>
      sameLineSet(assignment.lineas, team.lineas)
    );

    if (!matchingAssignments.length) {
      unassignedTeams.push({
        id: team.id,
        nombre: `Equipo ${formatLineGroupName(team)}`,
        detalle: `Código ${team.codigoBarras} | ${team.lineas.join("/")}`,
      });
      return;
    }

    matchingAssignments.forEach((assignment) => {
      const person = people.find((item) => item.id === assignment.almacenistaId);
      assignedTeams.push({
        id: `${team.id}-${assignment.id}`,
        nombre: `Equipo ${formatLineGroupName(team)}`,
        detalle: `Código ${team.codigoBarras} | ${team.lineas.join("/")}`,
        almacenista: person?.nombre ?? "Sin almacenista",
        grupo: person ? formatGroupName(person.grupo) : "Sin grupo",
        turno: getShiftName(assignment.turnoId),
      });
    });
  });

  activeLines.forEach((line) => {
    const matchingAssignments = assignments.filter((assignment) =>
      assignment.lineas.includes(line.codigo)
    );

    if (!matchingAssignments.length) {
      unassignedLines.push({
        id: line.id,
        nombre: `${line.codigo} - ${line.nombre}`,
        detalle: "Sin equipo/asignación vigente",
      });
      return;
    }

    matchingAssignments.forEach((assignment) => {
      const person = people.find((item) => item.id === assignment.almacenistaId);
      assignedLines.push({
        id: `${line.id}-${assignment.id}`,
        nombre: `${line.codigo} - ${line.nombre}`,
        detalle: `Equipo ${assignment.lineas.join("/")}`,
        almacenista: person?.nombre ?? "Sin almacenista",
        grupo: person ? formatGroupName(person.grupo) : "Sin grupo",
        turno: getShiftName(assignment.turnoId),
      });
    });
  });

  return {
    assignedTeams,
    unassignedTeams,
    assignedLines,
    unassignedLines,
  };
}

function findLineGroupForLines(
  lineGroups: SupplyTimeParameter[],
  lineas: string[]
) {
  return lineGroups.find((group) => sameLineSet(group.lineas, lineas));
}

function assignmentLineGroupName(
  lineGroups: SupplyTimeParameter[],
  lineas: string[]
) {
  const group = findLineGroupForLines(lineGroups, lineas);
  return group ? formatLineGroupName(group) : "Sin equipo";
}

function formatLineGroupName(group: SupplyTimeParameter) {
  return group.lineas.join("-");
}

function sameLineSet(left: string[], right: string[]) {
  const normalizedLeft = [...left].map(normalizeLine).sort().join("|");
  const normalizedRight = [...right].map(normalizeLine).sort().join("|");
  return normalizedLeft === normalizedRight;
}

function normalizeLine(line: string) {
  return line.trim().toUpperCase();
}

function CoverageTable({
  title,
  rows,
  emptyText,
  statusColor,
}: {
  title: string;
  rows: CoverageRow[];
  emptyText: string;
  statusColor: "success" | "warning";
}) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", gap: 1, mb: 1.5 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {title}
        </Typography>
        <Chip size="small" color={statusColor} label={String(rows.length)} />
      </Stack>

      {!rows.length ? (
        <Typography color="text.secondary">{emptyText}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Elemento</TableCell>
              <TableCell>Detalle</TableCell>
              <TableCell>Almacenista</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.nombre}</TableCell>
                <TableCell>{row.detalle}</TableCell>
                <TableCell>
                  {row.almacenista ? (
                    <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap" }}>
                      <Chip size="small" label={row.almacenista} />
                      {row.grupo && <Chip size="small" variant="outlined" label={row.grupo} />}
                      {row.turno && <Chip size="small" variant="outlined" label={row.turno} />}
                    </Stack>
                  ) : (
                    <Chip size="small" color="warning" label="Pendiente" />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

function AssignmentTable({
  assignments,
  people,
  accessUsers,
  lineGroups,
  showDates = false,
}: {
  assignments: SupplyAssignment[];
  people: SupplyPerson[];
  accessUsers: AccessUser[];
  lineGroups: SupplyTimeParameter[];
  showDates?: boolean;
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Almacenista</TableCell>
          <TableCell>Grupo</TableCell>
          <TableCell>Turno</TableCell>
          <TableCell>Supervisor</TableCell>
          <TableCell>Facilitador</TableCell>
          <TableCell>Equipo</TableCell>
          <TableCell>Líneas</TableCell>
          <TableCell>Contador</TableCell>
          <TableCell>Cobertura</TableCell>
          {showDates && <TableCell>Vigencia</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {assignments.map((assignment) => (
          <TableRow key={assignment.id}>
            <TableCell>{personName(people, assignment.almacenistaId)}</TableCell>
            <TableCell>{personGroupName(people, assignment.almacenistaId)}</TableCell>
            <TableCell>{getShiftName(assignment.turnoId)}</TableCell>
            <TableCell>{accessUserName(accessUsers, assignment.supervisorId)}</TableCell>
            <TableCell>{personName(people, assignment.facilitadorId)}</TableCell>
            <TableCell>{assignmentLineGroupName(lineGroups, assignment.lineas)}</TableCell>
            <TableCell>{assignment.lineas.join("/")}</TableCell>
            <TableCell>{assignment.lineas.length}</TableCell>
            <TableCell>{personName(people, assignment.cubreAusenciaDeId)}</TableCell>
            {showDates && (
              <TableCell>
                {assignment.vigenteDesde} a {assignment.vigenteHasta ?? "vigente"}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function personName(people: SupplyPerson[], id?: string) {
  return people.find((person) => person.id === id)?.nombre ?? "Sin persona";
}

function personGroupName(people: SupplyPerson[], id?: string) {
  const person = people.find((item) => item.id === id);
  return person ? formatGroupName(person.grupo) : "Sin grupo";
}

function accessUserName(accessUsers: AccessUser[], id?: string) {
  return accessUsers.find((user) => user.id === id)?.nombre ?? "Sin supervisor";
}

function previousDay(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function getTodayInSupplyTimezone() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/El_Salvador",
  });
}

function selectedDraftLines(value: string) {
  return value
    .split(",")
    .map((line) => line.trim().toUpperCase())
    .filter(Boolean);
}
