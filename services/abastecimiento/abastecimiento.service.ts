import type {
  SupplyAssignment,
  SupplyCellPerformance,
  SupplyCell,
  SupplyKeeperEfficiency,
  SupplyLinePerformance,
  SupplyLine,
  SupplyPerson,
  SupplyReport,
  SupplyRotationPlan,
  SupplyRun,
  SupplyRunStatus,
  SupplyShift,
  SupplySupervisor,
  SupplyTimeParameter,
  SupplyWarehouseKeeper,
} from "@/types/abastecimiento";

export const SUPPLY_TIMEZONE = "America/El_Salvador";
export const SUPPLY_STORE = "Tienda principal";

export const supplyShifts: SupplyShift[] = [
  {
    id: "turno-a",
    nombre: "Turno Mañana",
    inicio: "06:00",
    fin: "13:55",
    timezone: SUPPLY_TIMEZONE,
  },
  {
    id: "turno-b",
    nombre: "Turno Tarde",
    inicio: "14:15",
    fin: "22:15",
    timezone: SUPPLY_TIMEZONE,
  },
];

export const supplySupervisors: SupplySupervisor[] = [];

export const supplyCells: SupplyCell[] = [
  {
    id: "celda-d2ux-2",
    codigo: "D2UX-2",
    nombre: "D2UX-2",
    activa: true,
  },
  {
    id: "celda-door",
    codigo: "DOOR",
    nombre: "DOOR",
    activa: true,
  },
  {
    id: "celda-jl-jt",
    codigo: "JL/JT",
    nombre: "JL/JT",
    activa: true,
  },
  {
    id: "celda-c1yx-2",
    codigo: "C1YX-2",
    nombre: "C1YX-2",
    activa: true,
  },
];

export const supplyLines: SupplyLine[] = [];

export const supplyRotationPlan: SupplyRotationPlan = {
  id: "rotacion-quincenal",
  nombre: "Rotacion quincenal",
  duracionDias: 15,
  ultimoCambio: "2026-07-01",
  proximoCambio: "2026-07-16",
};

export const supplyPersonnel: SupplyPerson[] = [];

export const supplyWarehouseKeepers: SupplyWarehouseKeeper[] = [];

export const supplyTimeParameters: SupplyTimeParameter[] = [];

export const supplyAssignments: SupplyAssignment[] = [];

type RawRun = [
  string,
  string,
  string,
  string,
  number,
  string,
  string,
  string,
];

const rawRuns: RawRun[] = [];

export const supplyRuns: SupplyRun[] = rawRuns.map(
  ([id, fecha, almacenistaId, assignmentId, tolvas, entrada, salida, retorno]) => {
    const assignment = getAssignmentById(assignmentId);
    const parameter = getTimeParameter(assignment);
    const tiempoPreparacionMin = diffMinutes(entrada, salida);
    const tiempoRecorridoMin = diffMinutes(salida, retorno);
    const tiempoTotalMin = diffMinutes(entrada, retorno);

    return {
      id,
      fecha,
      almacenistaId,
      assignmentId,
      supervisorId: assignment.supervisorId,
      turnoId: assignment.turnoId,
      lineas: assignment.lineas,
      tienda: assignment.tienda,
      tolvas: Number(tolvas),
      entradaTienda: entrada,
      salidaTienda: salida,
      retornoTienda: retorno,
      tiempoPreparacionMin,
      tiempoRecorridoMin,
      tiempoTotalMin,
      tiempoObjetivoMin: parameter.tiempoObjetivoMin,
      estado: getRunStatus(tiempoTotalMin, parameter),
    };
  }
);

export function getCurrentAssignments() {
  return supplyAssignments.filter((assignment) => !assignment.vigenteHasta);
}

export function getAssignmentHistory() {
  return supplyAssignments;
}

export function findKeeperByBarcode(codigoBarras: string) {
  return supplyWarehouseKeepers.find(
    (keeper) => keeper.codigoBarras.toUpperCase() === codigoBarras.trim().toUpperCase()
  );
}

export function findLineGroupByBarcode(codigoBarras: string) {
  return supplyTimeParameters.find(
    (parameter) => parameter.codigoBarras === codigoBarras.trim()
  );
}

export function getCurrentAssignmentForKeeper(almacenistaId: string) {
  return getCurrentAssignments().find(
    (assignment) => assignment.almacenistaId === almacenistaId
  );
}

export function getSupplyReport(fecha = "2026-07-15"): SupplyReport {
  const recorridos = supplyRuns.filter((run) => run.fecha === fecha);
  const recorridosCumplidos = recorridos.filter(isRunCompliant).length;
  const totalTolvas = recorridos.reduce((total, run) => total + run.tolvas, 0);
  const horaPico = getPeakHopperHour(recorridos);
  const desempenoPorLinea = getLinePerformance(recorridos);
  const desempenoPorCelda = getCellPerformance(recorridos);

  return {
    fecha,
    totalRecorridos: recorridos.length,
    totalTolvas,
    cumplimiento: toPercent(recorridosCumplidos, recorridos.length),
    horaPicoTolvas: horaPico.hora,
    tolvasHoraPico: horaPico.tolvas,
    eficienciaPorAlmacenista: getKeeperEfficiency(recorridos),
    desempenoPorLinea,
    desempenoPorCelda,
    lineaMayorVariacion: maxBy(desempenoPorLinea, "variacionPromedioMin"),
    lineaMasAtrasada: maxBy(desempenoPorLinea, "atrasoMaximoMin"),
    lineaMejorCumplimiento: maxBy(desempenoPorLinea, "cumplimiento"),
    recorridos,
  };
}

export function getKeeperName(id: string) {
  return supplyWarehouseKeepers.find((keeper) => keeper.id === id)?.nombre ?? "Sin nombre";
}

export function getPersonName(id?: string) {
  if (!id) {
    return "Sin asignar";
  }

  return supplyPersonnel.find((person) => person.id === id)?.nombre ?? "Sin asignar";
}

export function getCellName(id: string) {
  return supplyCells.find((cell) => cell.id === id)?.nombre ?? "Sin celda";
}

export function getSupervisorName(id: string) {
  return supplySupervisors.find((supervisor) => supervisor.id === id)?.nombre ?? "Sin supervisor";
}

export function getShiftName(id: string) {
  return supplyShifts.find((shift) => shift.id === id)?.nombre ?? "Sin turno";
}

export function formatRunStatus(status: SupplyRunStatus) {
  const labels: Record<SupplyRunStatus, string> = {
    rapido: "Mas rapido",
    en_rango: "En rango",
    tarde: "Fuera de tiempo",
  };

  return labels[status];
}

export function getStatusColor(status: SupplyRunStatus) {
  const colors: Record<SupplyRunStatus, "success" | "warning" | "error"> = {
    rapido: "warning",
    en_rango: "success",
    tarde: "error",
  };

  return colors[status];
}

function getAssignmentById(id: string) {
  const assignment = supplyAssignments.find((item) => item.id === id);

  if (!assignment) {
    throw new Error(`Assignment ${id} not found`);
  }

  return assignment;
}

function getTimeParameter(assignment: SupplyAssignment) {
  const parameter = supplyTimeParameters.find(
    (item) =>
      item.tienda === assignment.tienda &&
      item.lineas.join(",") === assignment.lineas.join(",")
  );

  if (!parameter) {
    throw new Error(
      `Time parameter for ${assignment.tienda} ${assignment.lineas.join(",")} not found`
    );
  }

  return parameter;
}

function getRunStatus(
  tiempoTotalMin: number,
  parameter: SupplyTimeParameter
): SupplyRunStatus {
  if (tiempoTotalMin < parameter.tiempoObjetivoMin - parameter.toleranciaRapidoMin) {
    return "rapido";
  }

  if (tiempoTotalMin > parameter.tiempoObjetivoMin + parameter.toleranciaTardeMin) {
    return "tarde";
  }

  return "en_rango";
}

function diffMinutes(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);

  return endHour * 60 + endMinute - (startHour * 60 + startMinute);
}

function toPercent(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 1000) / 10;
}

function isRunCompliant(run: SupplyRun) {
  return run.estado === "rapido" || run.estado === "en_rango";
}

function getPeakHopperHour(recorridos: SupplyRun[]) {
  const buckets = recorridos.reduce<Record<string, number>>((acc, run) => {
    const hour = `${run.entradaTienda.slice(0, 2)}:00`;
    acc[hour] = (acc[hour] ?? 0) + run.tolvas;
    return acc;
  }, {});

  return Object.entries(buckets).reduce(
    (peak, [hora, tolvas]) => (tolvas > peak.tolvas ? { hora, tolvas } : peak),
    { hora: "Sin datos", tolvas: 0 }
  );
}

function getKeeperEfficiency(recorridos: SupplyRun[]): SupplyKeeperEfficiency[] {
  const grouped = recorridos.reduce<Record<string, SupplyRun[]>>((acc, run) => {
    acc[run.almacenistaId] = [...(acc[run.almacenistaId] ?? []), run];
    return acc;
  }, {});

  return Object.entries(grouped).map(([almacenistaId, runs]) => {
    const firstRun = runs[0];
    const dentroRango = runs.filter((run) => run.estado === "en_rango").length;
    const cumplidos = runs.filter(isRunCompliant).length;
    const totalTiempo = runs.reduce((total, run) => total + run.tiempoTotalMin, 0);
    const totalTolvas = runs.reduce((total, run) => total + run.tolvas, 0);

    return {
      almacenistaId,
      nombre: getKeeperName(almacenistaId),
      turno: getShiftName(firstRun.turnoId),
      supervisor: getSupervisorName(firstRun.supervisorId),
      recorridos: runs.length,
      tolvas: totalTolvas,
      tiempoPromedioMin: Math.round((totalTiempo / runs.length) * 10) / 10,
      dentroRango,
      eficiencia: toPercent(cumplidos, runs.length),
    };
  });
}

function getLinePerformance(recorridos: SupplyRun[]): SupplyLinePerformance[] {
  const grouped = recorridos.reduce<Record<string, SupplyRun[]>>((acc, run) => {
    const key = `${run.tienda}|${run.lineas.join("/")}`;
    acc[key] = [...(acc[key] ?? []), run];
    return acc;
  }, {});

  return Object.values(grouped).map((runs) => {
    const firstRun = runs[0];
    const totalTiempo = runs.reduce((total, run) => total + run.tiempoTotalMin, 0);
    const totalVariacion = runs.reduce(
      (total, run) => total + Math.abs(run.tiempoTotalMin - run.tiempoObjetivoMin),
      0
    );
    const atrasoMaximoMin = runs.reduce(
      (max, run) => Math.max(max, run.tiempoTotalMin - run.tiempoObjetivoMin),
      0
    );
    const cumplidos = runs.filter(isRunCompliant).length;

    return {
      lineas: firstRun.lineas,
      tienda: firstRun.tienda,
      recorridos: runs.length,
      tiempoObjetivoMin: firstRun.tiempoObjetivoMin,
      tiempoPromedioMin: Math.round((totalTiempo / runs.length) * 10) / 10,
      variacionPromedioMin: Math.round((totalVariacion / runs.length) * 10) / 10,
      atrasoMaximoMin,
      cumplimiento: toPercent(cumplidos, runs.length),
    };
  });
}

function getCellPerformance(recorridos: SupplyRun[]): SupplyCellPerformance[] {
  const grouped = recorridos.reduce<Record<string, SupplyRun[]>>((acc, run) => {
    const cell = getCellForRun(run);
    acc[cell.id] = [...(acc[cell.id] ?? []), run];
    return acc;
  }, {});

  return Object.entries(grouped).map(([celdaId, runs]) => {
    const cell = supplyCells.find((item) => item.id === celdaId);
    const totalTiempo = runs.reduce((total, run) => total + run.tiempoTotalMin, 0);
    const totalTolvas = runs.reduce((total, run) => total + run.tolvas, 0);
    const totalVariacion = runs.reduce(
      (total, run) => total + Math.abs(run.tiempoTotalMin - run.tiempoObjetivoMin),
      0
    );
    const atrasoMaximoMin = runs.reduce(
      (max, run) => Math.max(max, run.tiempoTotalMin - run.tiempoObjetivoMin),
      0
    );
    const cumplidos = runs.filter(isRunCompliant).length;

    return {
      celdaId,
      celda: cell?.nombre ?? "Sin celda",
      recorridos: runs.length,
      tolvas: totalTolvas,
      tiempoPromedioMin: Math.round((totalTiempo / runs.length) * 10) / 10,
      variacionPromedioMin: Math.round((totalVariacion / runs.length) * 10) / 10,
      atrasoMaximoMin,
      cumplimiento: toPercent(cumplidos, runs.length),
    };
  });
}

function getCellForRun(run: SupplyRun) {
  const firstLine = run.lineas[0];
  const line = supplyLines.find((item) => item.codigo === firstLine);
  return (
    supplyCells.find((cell) => cell.id === line?.celdaId) ?? {
      id: "sin-celda",
      codigo: "SIN",
      nombre: "Sin celda",
      activa: true,
    }
  );
}

function maxBy<T>(items: T[], key: keyof T) {
  return items.reduce<T | undefined>((selected, item) => {
    if (!selected) {
      return item;
    }

    return Number(item[key]) > Number(selected[key]) ? item : selected;
  }, undefined);
}
