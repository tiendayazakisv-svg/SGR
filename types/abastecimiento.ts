export type SupplyRunStatus = "rapido" | "en_rango" | "tarde";

export type SupplyPosition = "almacenista" | "facilitador" | "supervisor";

export type SupplyCrewGroup = "grupo-1" | "grupo-2";

export type SupplyKioskStep =
  | "entrada_tienda"
  | "salida_tienda"
  | "retorno_tienda";

export interface SupplyShift {
  id: string;
  nombre: string;
  inicio: string;
  fin: string;
  timezone: "America/El_Salvador";
}

export interface SupplySupervisor {
  id: string;
  sapId: string;
  nombre: string;
  turnoId: string;
}

export interface SupplyWarehouseKeeper {
  id: string;
  sapId: string;
  codigoBarras: string;
  nombre: string;
  puesto: SupplyPosition;
  grupo: SupplyCrewGroup;
  turnoId: string;
  activo: boolean;
}

export interface SupplyPerson {
  id: string;
  sapId: string;
  codigoBarras: string;
  nombre: string;
  puesto: SupplyPosition;
  grupo: SupplyCrewGroup;
  turnoId: string;
  activo: boolean;
}

export interface SupplyLine {
  id: string;
  codigo: string;
  nombre: string;
  celdaId: string;
  activa: boolean;
}

export interface SupplyCell {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

export interface SupplyTimeParameter {
  id: string;
  codigoBarras: string;
  tienda: string;
  lineas: string[];
  tiempoObjetivoMin: number;
  toleranciaRapidoMin: number;
  toleranciaTardeMin: number;
}

export interface SupplyAssignment {
  id: string;
  almacenistaId: string;
  supervisorId: string;
  facilitadorId?: string;
  cubreAusenciaDeId?: string;
  turnoId: string;
  lineas: string[];
  tienda: string;
  vigenteDesde: string;
  vigenteHasta?: string;
}

export interface SupplyRotationPlan {
  id: string;
  nombre: string;
  duracionDias: number;
  ultimoCambio: string;
  proximoCambio: string;
}

export interface SupplyRun {
  id: string;
  fecha: string;
  turnoId: string;
  almacenistaId: string;
  supervisorId: string;
  assignmentId: string;
  lineas: string[];
  tienda: string;
  tolvas: number;
  entradaTienda: string;
  salidaTienda: string;
  retornoTienda: string;
  tiempoPreparacionMin: number;
  tiempoRecorridoMin: number;
  tiempoTotalMin: number;
  tiempoObjetivoMin: number;
  estado: SupplyRunStatus;
}

export interface SupplyKeeperEfficiency {
  almacenistaId: string;
  nombre: string;
  turno: string;
  supervisor: string;
  recorridos: number;
  tolvas: number;
  tiempoPromedioMin: number;
  dentroRango: number;
  eficiencia: number;
}

export interface SupplyLinePerformance {
  lineas: string[];
  tienda: string;
  recorridos: number;
  tiempoObjetivoMin: number;
  tiempoPromedioMin: number;
  variacionPromedioMin: number;
  atrasoMaximoMin: number;
  cumplimiento: number;
}

export interface SupplyCellPerformance {
  celdaId: string;
  celda: string;
  recorridos: number;
  tolvas: number;
  tiempoPromedioMin: number;
  variacionPromedioMin: number;
  atrasoMaximoMin: number;
  cumplimiento: number;
}

export interface SupplyReport {
  fecha: string;
  totalRecorridos: number;
  totalTolvas: number;
  cumplimiento: number;
  horaPicoTolvas: string;
  tolvasHoraPico: number;
  eficienciaPorAlmacenista: SupplyKeeperEfficiency[];
  desempenoPorLinea: SupplyLinePerformance[];
  desempenoPorCelda: SupplyCellPerformance[];
  lineaMayorVariacion?: SupplyLinePerformance;
  lineaMasAtrasada?: SupplyLinePerformance;
  lineaMejorCumplimiento?: SupplyLinePerformance;
  recorridos: SupplyRun[];
}
