import type { DashboardKPIs } from "@/types/dashboard";
import type { SupplyAssignment, SupplyCrewGroup, SupplyPerson } from "@/types/abastecimiento";
import { SUPPLY_TIMEZONE } from "@/services/abastecimiento/abastecimiento.service";
import type { DbKioskRun } from "@/services/abastecimiento/abastecimiento-db.service";
import {
  listAssignmentsFromDb,
  listClosedKioskRunsFromDb,
  listOpenKioskRunsFromDb,
  listPersonnelFromDb,
} from "@/services/abastecimiento/abastecimiento-db.service";

type GroupFilter = "todos" | SupplyCrewGroup;

export async function getDashboard(groupFilter: GroupFilter = "todos"): Promise<DashboardKPIs> {
  const today = getToday();
  const [openRuns, closedRuns, assignments, people] = await Promise.all([
    listOpenKioskRunsFromDb(),
    listClosedKioskRunsFromDb({
      desde: startOfLocalDay(today).toISOString(),
      hasta: nextLocalDay(today).toISOString(),
    }),
    listAssignmentsFromDb(),
    listPersonnelFromDb(),
  ]);

  const dbAssignments = assignments ?? [];
  const dbPeople = people ?? [];
  const closed = filterRunsByGroup(closedRuns ?? [], dbAssignments, dbPeople, groupFilter);
  const open = filterRunsByGroup(openRuns ?? [], dbAssignments, dbPeople, groupFilter);
  const totalTiempo = closed.reduce(
    (total, run) => total + (run.tiempoTotalMin ?? 0),
    0
  );
  const totalLlenado = closed.reduce(
    (total, run) => total + (run.tiempoLlenadoMin ?? 0),
    0
  );
  const recorridosCumplidos = closed.filter(isRunCompliant).length;
  const currentAssignments = dbAssignments.filter(
    (assignment) =>
      !assignment.vigenteHasta &&
      personBelongsToGroup(assignment.almacenistaId, dbPeople, groupFilter)
  );
  const operationalPeople = dbPeople.filter(
    (person) =>
      (person.puesto === "almacenista" || person.puesto === "facilitador") &&
      (groupFilter === "todos" || person.grupo === groupFilter)
  );

  return {
    recorridos: closed.length,
    enProceso: open.length,
    cumplimiento: closed.length ? Math.round((recorridosCumplidos / closed.length) * 1000) / 10 : 0,
    tolvas: closed.reduce((total, run) => total + run.tolvas, 0),
    tiempoPromedio: closed.length ? Math.round(totalTiempo / closed.length) : 0,
    tiempoAbastecimiento: closed.length ? Math.round(totalLlenado / closed.length) : 0,
    almacenistasActivos: currentAssignments.length,
    almacenistasPausados: operationalPeople.filter((person) => !person.activo).length,
  };
}

function filterRunsByGroup(
  runs: DbKioskRun[],
  assignments: SupplyAssignment[],
  people: SupplyPerson[],
  groupFilter: GroupFilter
) {
  if (groupFilter === "todos") {
    return runs;
  }

  return runs.filter((run) => {
    const assignment = findHistoricalAssignment(
      run,
      assignments,
      formatDate(run.entradaAt),
      getShiftForTimestamp(run.entradaAt)
    );

    return assignment
      ? personBelongsToGroup(assignment.almacenistaId, people, groupFilter)
      : false;
  });
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

function personBelongsToGroup(
  personId: string,
  people: SupplyPerson[],
  groupFilter: GroupFilter
) {
  return groupFilter === "todos" || people.find((person) => person.id === personId)?.grupo === groupFilter;
}

function getShiftForTimestamp(value: string) {
  const [hour, minute] = formatTime(value).split(":").map(Number);
  const total = hour * 60 + minute;
  return total < 14 * 60 + 15 ? "turno-a" : "turno-b";
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

function getToday() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: SUPPLY_TIMEZONE,
  });
}

function startOfLocalDay(date: string) {
  return new Date(`${date}T00:00:00-06:00`);
}

function nextLocalDay(date: string) {
  const parsed = startOfLocalDay(date);
  parsed.setDate(parsed.getDate() + 1);
  return parsed;
}

function isRunCompliant(run: DbKioskRun) {
  return run.cumplimiento === "rapido" || run.cumplimiento === "en_rango";
}
