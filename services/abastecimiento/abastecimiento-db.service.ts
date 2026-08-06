import type {
  SupplyAssignment,
  SupplyCell,
  SupplyCrewGroup,
  SupplyLine,
  SupplyPerson,
  SupplyTimeParameter,
} from "@/types/abastecimiento";

export type KioskRunState = "llenando_carro" | "repartiendo_tolvas" | "cerrado";
export type AccessRole = "supervisor" | "administrador";

export interface DbKioskRun {
  id: string;
  lineGroupId: string;
  codigoBarras: string;
  lineas: string[];
  tienda: string;
  tolvas: number;
  entradaAt: string;
  salidaAt?: string;
  retornoAt?: string;
  estado: KioskRunState;
  tiempoObjetivoMin: number;
  tiempoLlenadoMin?: number;
  tiempoRepartoMin?: number;
  tiempoTotalMin?: number;
  cumplimiento?: "rapido" | "en_rango" | "tarde";
  cierreAutomatico?: boolean;
  cierreMotivo?: string;
}

export interface AccessUser {
  id: string;
  sapId: string;
  nombre: string;
  email: string;
  rol: AccessRole;
  grupo?: SupplyCrewGroup;
  activo: boolean;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

type ApiActionResult<T> = {
  data: T | null;
  error: string | null;
};

const READ_ACTION_TTL_MS: Record<string, number> = {
  "list-access-users": 120000,
  "list-assignments": 45000,
  "list-personnel": 45000,
  "list-line-catalog": 120000,
  "list-cells": 120000,
  "list-open-kiosk-runs": 15000,
  "list-closed-kiosk-runs": 20000,
};

const apiActionCache = new Map<
  string,
  {
    expiresAt: number;
    result?: ApiActionResult<unknown>;
    promise?: Promise<ApiActionResult<unknown>>;
  }
>();

function getApiActionCacheKey(action: string, payload?: unknown) {
  return `${action}:${JSON.stringify(payload ?? null)}`;
}

function clearApiActionCache() {
  apiActionCache.clear();
}

export async function listLineCatalogFromDb() {
  const data = await apiAction<{
    lines: Record<string, unknown>[];
    lineGroups: Record<string, unknown>[];
  }>("list-line-catalog");

  if (!data) {
    return null;
  }

  return {
    lines: data.lines.map(mapLineFromDb),
    lineGroups: data.lineGroups.map(mapLineGroupFromDb),
  };
}

export async function createLineInDb(line: SupplyLine) {
  const data = await apiAction<Record<string, unknown>>("create-line", line);
  return data ? mapLineFromDb(data) : null;
}

export async function updateLineActiveInDb(id: string, activa: boolean) {
  await apiAction("update-line-active", { id, activa });
}

export async function updateLineInDb(line: SupplyLine) {
  const data = await apiAction<Record<string, unknown>>("update-line", line);
  return data ? mapLineFromDb(data) : null;
}

export async function createLineGroupInDb(group: SupplyTimeParameter) {
  const data = await apiAction<Record<string, unknown>>("create-line-group", group);
  return data ? mapLineGroupFromDb(data) : null;
}

export async function updateLineGroupInDb(group: SupplyTimeParameter) {
  const data = await apiAction<Record<string, unknown>>("update-line-group", group);
  return data ? mapLineGroupFromDb(data) : null;
}

export async function removeLineGroupInDb(id: string) {
  await apiAction("remove-line-group", { id });
}

export async function listPersonnelFromDb() {
  const data = await apiAction<Record<string, unknown>[]>("list-personnel");
  return data ? data.map(mapPersonFromDb) : null;
}

export async function createPersonInDb(person: SupplyPerson) {
  const data = await apiAction<Record<string, unknown>>("create-person", person);
  return data ? mapPersonFromDb(data) : null;
}

export async function updatePersonActiveInDb(id: string, activo: boolean) {
  const data = await apiAction<Record<string, unknown>>("update-person-active", {
    id,
    activo,
  });
  return data ? mapPersonFromDb(data) : null;
}

export async function updatePersonShiftInDb(input: {
  id: string;
  turnoId: string;
}) {
  await apiAction("update-person-shift", input);
}

export async function listAccessUsersFromDb() {
  const data = await apiAction<Record<string, unknown>[]>("list-access-users");
  return data ? data.map(mapAccessUserFromDb) : null;
}

export async function createAccessUserInDb(user: AccessUser, password?: string) {
  const data = await apiAction<Record<string, unknown>>("create-access-user", {
    ...user,
    password,
  });
  return data ? mapAccessUserFromDb(data) : null;
}

export async function updateAccessUserActiveInDb(id: string, activo: boolean) {
  await apiAction("update-access-user-active", { id, activo });
}

export async function updateAccessUserRoleInDb(input: {
  id: string;
  rol: AccessRole;
  grupo?: SupplyCrewGroup;
}) {
  const data = await apiAction<Record<string, unknown>>("update-access-user-role", input);
  return data ? mapAccessUserFromDb(data) : null;
}

export async function updateAccessUserGroupInDb(input: {
  id: string;
  grupo: SupplyCrewGroup;
}) {
  const data = await apiAction<Record<string, unknown>>("update-access-user-group", input);
  return data ? mapAccessUserFromDb(data) : null;
}

export async function updateAccessUserPasswordInDb(input: {
  id: string;
  password: string;
}) {
  const result = await apiActionResult<{ ok: boolean }>(
    "update-access-user-password",
    input
  );

  return {
    ok: Boolean(result.data?.ok),
    error: result.error,
  };
}

export async function resolveAccessLoginInDb(sapId: string) {
  return await apiAction<{ email: string }>("resolve-access-login", { sapId });
}

export async function ensureDefaultAdminInDb() {
  await apiAction("ensure-default-admin");
}

export async function listCellsFromDb() {
  const data = await apiAction<Record<string, unknown>[]>("list-cells");
  return data ? data.map(mapCellFromDb) : null;
}

export async function createCellInDb(cell: SupplyCell) {
  const data = await apiAction<Record<string, unknown>>("create-cell", cell);
  return data ? mapCellFromDb(data) : null;
}

export async function updateCellActiveInDb(id: string, activa: boolean) {
  await apiAction("update-cell-active", { id, activa });
}

export async function createKioskRunInDb(input: {
  group: SupplyTimeParameter;
  tolvas: number;
  entradaAt?: Date;
}) {
  const data = await apiAction<Record<string, unknown>>("create-kiosk-run", {
    ...input,
    entradaAt: input.entradaAt?.toISOString(),
  });
  return data ? mapKioskRunFromDb(data) : null;
}

export async function registerKioskExitInDb(id: string, salidaAt: Date) {
  const data = await apiAction<Record<string, unknown>>("register-kiosk-exit", {
    id,
    salidaAt: salidaAt.toISOString(),
  });
  return data ? mapKioskRunFromDb(data) : null;
}

export async function closeKioskRunInDb(input: {
  id: string;
  retornoAt: Date;
  tiempoLlenadoMin: number;
  tiempoRepartoMin: number;
  tiempoTotalMin: number;
  cumplimiento: "rapido" | "en_rango" | "tarde";
}) {
  const data = await apiAction<Record<string, unknown>>("close-kiosk-run", {
    ...input,
    retornoAt: input.retornoAt.toISOString(),
  });
  return data ? mapKioskRunFromDb(data) : null;
}

export async function listOpenKioskRunsFromDb() {
  const data = await apiAction<Record<string, unknown>[]>("list-open-kiosk-runs");
  return data ? data.map(mapKioskRunFromDb) : null;
}

export async function listClosedKioskRunsFromDb(input?: {
  desde?: string;
  hasta?: string;
}) {
  const data = await apiAction<Record<string, unknown>[]>("list-closed-kiosk-runs", input);
  return data ? data.map(mapKioskRunFromDb) : null;
}

export async function createAssignmentInDb(assignment: SupplyAssignment) {
  const data = await apiAction<Record<string, unknown>>(
    "create-assignment",
    assignment
  );
  return data ? mapAssignmentFromDb(data) : null;
}

export async function listAssignmentsFromDb() {
  const data = await apiAction<Record<string, unknown>[]>("list-assignments");
  return data ? data.map(mapAssignmentFromDb) : null;
}

export async function closeCurrentAssignmentInDb(input: {
  almacenistaId: string;
  vigenteHasta: string;
}) {
  await apiAction("close-current-assignment", input);
}

export async function updateAssignmentShiftInDb(input: {
  id: string;
  turnoId: string;
  supervisorId?: string;
}) {
  await apiAction("update-assignment-shift", input);
}

async function apiAction<T>(action: string, payload?: unknown) {
  const result = await apiActionResult<T>(action, payload);

  if (result.error) {
    console.warn("Supabase warning", result.error);
    return null;
  }

  return result.data ?? null;
}

async function apiActionResult<T>(
  action: string,
  payload?: unknown
): Promise<ApiActionResult<T>> {
  const ttl = READ_ACTION_TTL_MS[action] ?? 0;
  const cacheKey = ttl ? getApiActionCacheKey(action, payload) : "";
  const now = Date.now();

  if (ttl) {
    const cached = apiActionCache.get(cacheKey);

    if (cached?.result && cached.expiresAt > now) {
      return cached.result as ApiActionResult<T>;
    }

    if (cached?.promise) {
      return (await cached.promise) as ApiActionResult<T>;
    }
  }

  const request = requestApiAction<T>(action, payload);

  if (ttl) {
    apiActionCache.set(cacheKey, {
      expiresAt: now + ttl,
      promise: request as Promise<ApiActionResult<unknown>>,
    });
  }

  const result = await request;

  if (ttl) {
    apiActionCache.set(cacheKey, {
      expiresAt: Date.now() + ttl,
      result: result as ApiActionResult<unknown>,
    });
  } else if (!result.error) {
    clearApiActionCache();
  }

  return result;
}

async function requestApiAction<T>(
  action: string,
  payload?: unknown
): Promise<ApiActionResult<T>> {
  try {
    const response = await fetch("/api/abastecimiento", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ action, payload }),
    });

    const result = (await response.json()) as { data?: T; error?: string };

    if (!response.ok) {
      return {
        data: null,
        error: result.error ?? response.statusText,
      };
    }

    return {
      data: result.data ?? null,
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: getErrorMessage(error),
    };
  }
}

function mapLineFromDb(row: Record<string, unknown>): SupplyLine {
  return {
    id: String(row.id),
    codigo: String(row.codigo),
    nombre: String(row.nombre),
    celdaId: String(row.celda_id ?? ""),
    activa: Boolean(row.activa),
  };
}

function mapLineGroupFromDb(row: Record<string, unknown>): SupplyTimeParameter {
  return {
    id: String(row.id),
    codigoBarras: String(row.codigo_barras),
    tienda: String(row.tienda),
    lineas: Array.isArray(row.lineas) ? row.lineas.map(String) : [],
    tiempoObjetivoMin: Number(row.tiempo_objetivo_min),
    toleranciaRapidoMin: Number(row.tolerancia_rapido_min),
    toleranciaTardeMin: Number(row.tolerancia_tarde_min),
  };
}

function mapPersonFromDb(row: Record<string, unknown>): SupplyPerson {
  return {
    id: String(row.id),
    sapId: String(row.sap_id),
    codigoBarras: String(row.codigo_barras),
    nombre: String(row.nombre),
    puesto: row.puesto as SupplyPerson["puesto"],
    grupo: row.grupo as SupplyPerson["grupo"],
    turnoId: String(row.turno_id),
    activo: Boolean(row.activo),
  };
}

function mapCellFromDb(row: Record<string, unknown>): SupplyCell {
  return {
    id: String(row.id),
    codigo: String(row.codigo),
    nombre: String(row.nombre),
    activa: Boolean(row.activa),
  };
}

function mapAccessUserFromDb(row: Record<string, unknown>): AccessUser {
  return {
    id: String(row.id),
    sapId: String(row.sap_id),
    nombre: String(row.nombre),
    email: String(row.email),
    rol: row.rol as AccessRole,
    grupo: row.grupo ? (row.grupo as SupplyCrewGroup) : undefined,
    activo: Boolean(row.activo),
  };
}

function mapAssignmentFromDb(row: Record<string, unknown>): SupplyAssignment {
  return {
    id: String(row.id),
    almacenistaId: String(row.almacenista_id),
    supervisorId: String(row.supervisor_id ?? ""),
    facilitadorId: row.facilitador_id ? String(row.facilitador_id) : undefined,
    cubreAusenciaDeId: row.cubre_ausencia_de_id
      ? String(row.cubre_ausencia_de_id)
      : undefined,
    turnoId: String(row.turno_id),
    lineas: Array.isArray(row.lineas) ? row.lineas.map(String) : [],
    tienda: String(row.tienda),
    vigenteDesde: String(row.vigente_desde),
    vigenteHasta: row.vigente_hasta ? String(row.vigente_hasta) : undefined,
  };
}

function mapKioskRunFromDb(row: Record<string, unknown>): DbKioskRun {
  return {
    id: String(row.id),
    lineGroupId: String(row.line_group_id),
    codigoBarras: String(row.codigo_barras),
    lineas: Array.isArray(row.lineas) ? row.lineas.map(String) : [],
    tienda: String(row.tienda),
    tolvas: Number(row.tolvas),
    entradaAt: String(row.entrada_at),
    salidaAt: row.salida_at ? String(row.salida_at) : undefined,
    retornoAt: row.retorno_at ? String(row.retorno_at) : undefined,
    estado: row.estado as KioskRunState,
    tiempoObjetivoMin: Number(row.tiempo_objetivo_min),
    tiempoLlenadoMin: row.tiempo_llenado_min
      ? Number(row.tiempo_llenado_min)
      : undefined,
    tiempoRepartoMin: row.tiempo_reparto_min
      ? Number(row.tiempo_reparto_min)
      : undefined,
    tiempoTotalMin: row.tiempo_total_min ? Number(row.tiempo_total_min) : undefined,
    cumplimiento: row.cumplimiento
      ? (row.cumplimiento as DbKioskRun["cumplimiento"])
      : undefined,
    cierreAutomatico: Boolean(row.cierre_automatico),
    cierreMotivo: row.cierre_motivo ? String(row.cierre_motivo) : undefined,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }

  return String(error);
}

