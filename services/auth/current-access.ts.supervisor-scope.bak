import type {
  AccessUser,
} from "@/services/abastecimiento/abastecimiento-db.service";
import type { SupplyCrewGroup } from "@/types/abastecimiento";

export type GroupScope = "todos" | "sin-grupo" | SupplyCrewGroup;

interface AuthLike {
  data: {
    user: {
      id?: string;
      email?: string;
      user_metadata?: {
        sap_id?: string;
      };
    } | null;
  };
}

export function findCurrentAccess(
  users: AccessUser[] | null | undefined,
  auth: AuthLike
) {
  const user = auth.data.user;
  const id = user?.id;
  const email = user?.email?.toLowerCase();
  const sapId = user?.user_metadata?.sap_id?.toUpperCase();

  return (
    users?.find(
      (candidate) =>
        candidate.id === id ||
        Boolean(sapId && candidate.sapId.toUpperCase() === sapId) ||
        Boolean(email && candidate.email.toLowerCase() === email)
    ) ?? null
  );
}

export function getSessionGroupScope(access: AccessUser | null): GroupScope {
  if (access?.rol === "administrador") {
    return "todos";
  }

  if (access?.rol === "supervisor" && access.grupo) {
    return access.grupo;
  }

  return "sin-grupo";
}

export function isAdminAccess(access: AccessUser | null) {
  return access?.rol === "administrador";
}

export function isSupervisorAccess(access: AccessUser | null) {
  return access?.rol === "supervisor";
}

export function formatGroupScope(scope: GroupScope) {
  if (scope === "todos") {
    return "Todos";
  }

  if (scope === "sin-grupo") {
    return "Sin grupo asignado";
  }

  return scope === "grupo-1" ? "Grupo 1" : "Grupo 2";
}

export function belongsToGroupScope(
  group: SupplyCrewGroup | undefined,
  scope: GroupScope
) {
  return scope === "todos" || Boolean(group && group === scope);
}