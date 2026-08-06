"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  LinearProgress,
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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  SupplyAssignment,
  SupplyCell,
  SupplyCrewGroup,
  SupplyLine,
  SupplyPerson,
  SupplyRunStatus,
} from "@/types/abastecimiento";
import {
  formatRunStatus,
  getShiftName,
  getStatusColor,
  SUPPLY_TIMEZONE,
} from "@/services/abastecimiento/abastecimiento.service";
import type {
  AccessUser,
  DbKioskRun,
} from "@/services/abastecimiento/abastecimiento-db.service";
import {
  listAccessUsersFromDb,
  listAssignmentsFromDb,
  listCellsFromDb,
  listClosedKioskRunsFromDb,
  listLineCatalogFromDb,
  listOpenKioskRunsFromDb,
  listPersonnelFromDb,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import {
  findCurrentAccess,
  getSessionGroupScope,
  type GroupScope,
} from "@/services/auth/current-access";

type GroupFilter = GroupScope;
type TeamFilter = "todos" | string;

interface ReportRun {
  id: string;
  fecha: string;
  codigoBarras: string;
  lineas: string[];
  tienda: string;
  tolvas: number;
  entradaAt: string;
  salidaAt: string;
  retornoAt: string;
  tiempoLlenadoMin: number;
  tiempoRepartoMin: number;
  tiempoTotalMin: number;
  tiempoObjetivoMin: number;
  estado: SupplyRunStatus;
  turnoId: string;
  grupo?: SupplyCrewGroup;
  grupoLabel: string;
  almacenista: string;
  supervisor: string;
  recorridoSecuencia?: number;
  cierreAutomatico?: boolean;
  cierreMotivo?: string;
}

interface TimeChartRun {
  id: string;
  orden: number;
  label: string;
  chartLabel: string;
  equipo: string;
  almacenista: string;
  grupoLabel: string;
  recorrido: number;
  tolvas: number;
  tiempo: number;
  objetivo: number;
  variacion: number;
  estado: "bueno" | "malo";
  recorridoLabel: string;
  enProceso?: boolean;
}

interface CompliancePieRow {
  name: string;
  value: number;
  color: string;
}

interface ComplianceBarRow {
  celda: string;
  recorridos: number;
  buenos: number;
  malos: number;
  tolvas: number;
}

interface OpenReportRun {
  id: string;
  fecha: string;
  codigoBarras: string;
  lineas: string[];
  tolvas: number;
  entradaAt: string;
  salidaAt?: string;
  estado: "llenando_carro" | "repartiendo_tolvas";
  turnoId: string;
  grupo?: SupplyCrewGroup;
  grupoLabel: string;
  almacenista: string;
  tiempoTotalMin: number;
  tiempoObjetivoMin: number;
  variacionMin: number;
}

export default function Page() {
  const today = getToday();
  const [filters, setFilters] = useState({
    desde: today,
    hasta: today,
    grupo: "todos" as GroupFilter,
    equipo: "todos" as TeamFilter,
  });
  const [runs, setRuns] = useState<DbKioskRun[]>([]);
  const [openRuns, setOpenRuns] = useState<DbKioskRun[]>([]);
  const [assignments, setAssignments] = useState<SupplyAssignment[]>([]);
  const [people, setPeople] = useState<SupplyPerson[]>([]);
  const [currentAccess, setCurrentAccess] = useState<AccessUser | null>(null);
  const [lines, setLines] = useState<SupplyLine[]>([]);
  const [cells, setCells] = useState<SupplyCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportNow, setReportNow] = useState<Date | null>(null);

  useEffect(() => {
    setReportNow(new Date());
    const reportClock = window.setInterval(() => setReportNow(new Date()), 60000);
    return () => window.clearInterval(reportClock);
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([
      listClosedKioskRunsFromDb({
        desde: startOfLocalDay(filters.desde).toISOString(),
        hasta: nextLocalDay(filters.hasta).toISOString(),
      }),
      listOpenKioskRunsFromDb(),
      listAssignmentsFromDb(),
      listPersonnelFromDb(),
      listLineCatalogFromDb(),
      listCellsFromDb(),
      listAccessUsersFromDb(),
      getCurrentUser(),
    ])
      .then(
        ([
          dbRuns,
          dbOpenRuns,
          dbAssignments,
          dbPeople,
          catalog,
          dbCells,
          dbAccessUsers,
          auth,
        ]) => {
        if (!active) {
          return;
        }

        const access = findCurrentAccess(dbAccessUsers, auth);

        setRuns(dbRuns ?? []);
        setOpenRuns(dbOpenRuns ?? []);
        setAssignments(dbAssignments ?? []);
        setPeople(dbPeople ?? []);
        setCurrentAccess(access);
        setLines(catalog?.lines ?? []);
        setCells(dbCells ?? []);
        const scope = getSessionGroupScope(access);
        if (scope !== "todos") {
          setFilters((current) => ({ ...current, grupo: scope }));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [filters.desde, filters.hasta]);

  const forcedGroup =
    currentAccess?.rol === "supervisor" ? currentAccess.grupo : undefined;
  const selectedGroup = forcedGroup ?? filters.grupo;
  const baseReportRuns = useMemo(() => {
    const enriched = runs
      .map((run) => enrichRun(run, assignments, people))
      .filter((run): run is ReportRun => Boolean(run));
    const scopedRuns =
      selectedGroup === "todos" || !selectedGroup
        ? enriched
        : enriched.filter((run) => run.grupo === selectedGroup);

    return assignRunSequence(scopedRuns);
  }, [assignments, people, runs, selectedGroup]);
  const teamOptions = useMemo(() => buildTeamOptions(baseReportRuns), [baseReportRuns]);
  const selectedTeam = filters.equipo;
  const reportRuns = useMemo(
    () =>
      selectedTeam === "todos"
        ? baseReportRuns
        : baseReportRuns.filter((run) => getTeamKey(run) === selectedTeam),
    [baseReportRuns, selectedTeam]
  );
  const complianceBarRows = useMemo(
    () => buildComplianceBarRows(reportRuns, lines, cells),
    [cells, lines, reportRuns]
  );

  const report = useMemo(
    () => buildReport(reportRuns, lines, cells),
    [cells, lines, reportRuns]
  );
  const visibleOpenRuns = useMemo(() => {
    const fromDate = filters.desde;
    const toDate = filters.hasta;

    return openRuns
      .map((run) => enrichOpenRun(run, assignments, people, reportNow))
      .filter((run): run is OpenReportRun => Boolean(run))
      .filter((run) => run.fecha >= fromDate && run.fecha <= toDate)
      .filter((run) =>
        selectedGroup === "todos"
          ? true
          : selectedGroup === "sin-grupo"
            ? false
            : run.grupo === selectedGroup
      )
      .filter((run) =>
        selectedTeam === "todos" ? true : run.lineas.join("/") === selectedTeam
      );
  }, [assignments, filters.desde, filters.hasta, openRuns, people, reportNow, selectedGroup, selectedTeam]);
  const chartRuns = useMemo(
    () => buildTimeChartRuns(reportRuns, visibleOpenRuns),
    [reportRuns, visibleOpenRuns]
  );
  const compliancePieRows = useMemo(
    () => buildCompliancePieRows(chartRuns),
    [chartRuns]
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Reportes de abastecimiento
        </Typography>
        <Typography color="text.secondary">
          HistÃ³rico por fecha, grupo de personal, turno, desempeno por celda y equipos de lÃ­neas.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" },
            gap: 2,
          }}
        >
          <TextField
            type="date"
            label="Desde"
            value={filters.desde}
            onChange={(event) => {
              setLoading(true);
              setFilters((current) => ({ ...current, desde: event.target.value }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            label="Hasta"
            value={filters.hasta}
            onChange={(event) => {
              setLoading(true);
              setFilters((current) => ({ ...current, hasta: event.target.value }));
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label="Grupo"
            value={selectedGroup ?? "todos"}
            disabled={Boolean(forcedGroup)}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                grupo: event.target.value as GroupFilter,
              }))
            }
          >
            <MenuItem value="todos">Todos</MenuItem>
            <MenuItem value="sin-grupo">Sin grupo asignado</MenuItem>
            <MenuItem value="grupo-1">Grupo 1</MenuItem>
            <MenuItem value="grupo-2">Grupo 2</MenuItem>
          </TextField>
          <TextField
            select
            label="Celda"
            value={selectedTeam}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                equipo: event.target.value as TeamFilter,
              }))
            }
          >
            <MenuItem value="todos">Todos los equipos</MenuItem>
            {teamOptions.map((team) => (
              <MenuItem key={team.key} value={team.key}>
                {team.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={() =>
              setFilters({
                desde: today,
                hasta: today,
                grupo: forcedGroup ?? "todos",
                equipo: "todos",
              })
            }
          >
            Hoy
          </Button>
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(5, 1fr)" },
          gap: 2,
        }}
      >
        <Kpi title="Recorridos" value={String(report.totalRecorridos)} />
        <Kpi title="En proceso" value={String(visibleOpenRuns.length)} />
        <Kpi title="Tolvas" value={String(report.totalTolvas)} />
        <Kpi title="Cumplimiento" value={`${report.cumplimiento}%`} />
        <Kpi
          title="Hora pico"
          value={report.horaPicoTolvas}
          detail={`${report.tolvasHoraPico} tolvas`}
        />
      </Box>

      <TimeComplianceChart
        rows={chartRuns}
        loading={loading}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "minmax(0, 1fr) minmax(0, 1fr)" },
          gap: 2,
          alignItems: "stretch",
        }}
      >
        <CompliancePieChart rows={compliancePieRows} loading={loading} />
        <ComplianceBarChart rows={complianceBarRows} loading={loading} />
      </Box>

      <HopperVolumeTable rows={report.tolvasPorEquipo} loading={loading} />

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Recorridos en proceso
        </Typography>
        <DataState loading={loading} empty={!visibleOpenRuns.length} />
        {!!visibleOpenRuns.length && (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 920 }}>
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>CÃ³digo equipo</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Almacenista</TableCell>
                <TableCell>LÃ­neas</TableCell>
                <TableCell>Tolvas</TableCell>
                <TableCell>Entrada</TableCell>
                <TableCell>Salida</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Cierre</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleOpenRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.fecha}</TableCell>
                  <TableCell>{run.codigoBarras}</TableCell>
                  <TableCell>{run.grupoLabel}</TableCell>
                  <TableCell>{getShiftName(run.turnoId)}</TableCell>
                  <TableCell>{run.almacenista}</TableCell>
                  <TableCell>{formatLines(run.lineas)}</TableCell>
                  <TableCell>{run.tolvas}</TableCell>
                  <TableCell>{formatTime(run.entradaAt)}</TableCell>
                  <TableCell>{run.salidaAt ? formatTime(run.salidaAt) : "Pendiente"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={run.estado === "repartiendo_tolvas" ? "primary" : "warning"}
                      label={run.estado === "repartiendo_tolvas" ? "Repartiendo" : "Llenando carro"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Box>
        )}
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
        }}
      >
        <Kpi
          title="Mayor variacion"
          value={formatLines(report.lineaMayorVariacion?.lineas)}
          detail={`${report.lineaMayorVariacion?.variacionPromedioMin ?? 0} min promedio`}
        />
        <Kpi
          title="MÃ¡s atrasada"
          value={formatLines(report.lineaMasAtrasada?.lineas)}
          detail={`${report.lineaMasAtrasada?.atrasoMaximoMin ?? 0} min sobre objetivo`}
        />
        <Kpi
          title="Mejor cumplimiento"
          value={formatLines(report.lineaMejorCumplimiento?.lineas)}
          detail={`${report.lineaMejorCumplimiento?.cumplimiento ?? 0}% cumplimiento`}
        />
      </Box>

      <ComparisonTable
        title="Comparativo por grupos"
        firstHeader="Grupo"
        rows={report.comparativoPorGrupo}
      />

      <ComparisonTable
        title="Comparativo por equipos"
        firstHeader="Celda"
        rows={report.comparativoPorEquipo}
      />

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Cumplimiento por almacenista
        </Typography>
        <DataState loading={loading} empty={!report.cumplimientoPorAlmacenista.length} />
        {!!report.cumplimientoPorAlmacenista.length && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Almacenista</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Recorridos</TableCell>
                <TableCell>Tolvas</TableCell>
                <TableCell>Tiempo prom.</TableCell>
                <TableCell>RÃ¡pido</TableCell>
                <TableCell>En rango</TableCell>
                <TableCell>Tarde</TableCell>
                <TableCell>Cumplimiento</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.cumplimientoPorAlmacenista.map((row) => (
                <TableRow key={`${row.almacenista}-${row.grupoLabel}-${row.turno}`}>
                  <TableCell>{row.almacenista}</TableCell>
                  <TableCell>{row.grupoLabel}</TableCell>
                  <TableCell>{row.turno}</TableCell>
                  <TableCell>{row.recorridos}</TableCell>
                  <TableCell>{row.tolvas}</TableCell>
                  <TableCell>{row.tiempoPromedioMin} min</TableCell>
                  <TableCell>{row.rapido}</TableCell>
                  <TableCell>{row.enRango}</TableCell>
                  <TableCell>{row.tarde}</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {row.cumplimiento}%
                      </Typography>
                      <LinearProgress variant="determinate" value={row.cumplimiento} />
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <PerformanceTable
        title="DesempeÃ±o por celda"
        rows={report.desempenoPorCelda}
        firstHeader="Celda"
      />
      <PerformanceTable
        title="DesempeÃ±o por equipo de lÃ­neas"
        rows={report.desempenoPorLinea}
        firstHeader="LÃ­neas"
      />

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{
            alignItems: { xs: "stretch", md: "center" },
            justifyContent: "space-between",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Bitacora historica de recorridos
            </Typography>
            <Typography color="text.secondary">
              Descarga exactamente los recorridos visibles con los filtros actuales.
            </Typography>
          </Box>
          <Button
            variant="contained"
            disabled={!reportRuns.length}
            onClick={() => exportBitacoraToExcel(reportRuns, filters.desde, filters.hasta)}
          >
            Descargar Excel
          </Button>
        </Stack>
        <DataState loading={loading} empty={!reportRuns.length} />
        {!!reportRuns.length && (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell>CÃ³digo equipo</TableCell>
                <TableCell>Grupo</TableCell>
                <TableCell>Turno</TableCell>
                <TableCell>Almacenista</TableCell>
                <TableCell>LÃ­neas</TableCell>
                <TableCell>Tolvas</TableCell>
                <TableCell>Entrada</TableCell>
                <TableCell>Salida</TableCell>
                <TableCell>Retorno</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Objetivo</TableCell>
                <TableCell>Variacion</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell>Cierre</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportRuns.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>{run.fecha}</TableCell>
                  <TableCell>{run.codigoBarras}</TableCell>
                  <TableCell>{run.grupoLabel}</TableCell>
                  <TableCell>{getShiftName(run.turnoId)}</TableCell>
                  <TableCell>{run.almacenista}</TableCell>
                  <TableCell>{formatLines(run.lineas)}</TableCell>
                  <TableCell>{run.tolvas}</TableCell>
                  <TableCell>{formatTime(run.entradaAt)}</TableCell>
                  <TableCell>{formatTime(run.salidaAt)}</TableCell>
                  <TableCell>{formatTime(run.retornoAt)}</TableCell>
                  <TableCell>{run.tiempoTotalMin} min</TableCell>
                  <TableCell>{run.tiempoObjetivoMin} min</TableCell>
                  <TableCell>{run.tiempoTotalMin - run.tiempoObjetivoMin} min</TableCell>
                                    <TableCell>
                    <Chip
                      size="small"
                      color={getStatusColor(run.estado)}
                      label={formatRunStatus(run.estado)}
                    />
                  </TableCell>
                  <TableCell>
                    {run.cierreAutomatico ? (
                      <Chip
                        size="small"
                        color="warning"
                        label="Sistema cerrÃ³ automÃ¡ticamente"
                        title={run.cierreMotivo}
                      />
                    ) : (
                      <Chip size="small" variant="outlined" label="Escaneo manual" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </Box>
        )}
      </Paper>

    </Stack>
  );
}

function Kpi({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
      {detail && <Typography color="text.secondary">{detail}</Typography>}
    </Paper>
  );
}


function CompliancePieChart({
  rows,
  loading,
}: {
  rows: CompliancePieRow[];
  loading: boolean;
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            DistribuciÃ³n de cumplimiento
          </Typography>
          <Typography color="text.secondary">
            Recorridos dentro y fuera del tiempo segÃºn los filtros activos.
          </Typography>
        </Box>
        <Chip color="primary" label={`${total} recorridos filtrados`} />
      </Box>

      <DataState loading={loading} empty={!total} />
      {!!total && (
        <Box sx={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={rows}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={4}
                label={({ name, percent }) =>
                  `${name} ${Math.round((percent ?? 0) * 100)}%`
                }
              >
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${value} recorridos`, "Cantidad"]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
function ComplianceBarChart({
  rows,
  loading,
}: {
  rows: ComplianceBarRow[];
  loading: boolean;
}) {
  const total = rows.reduce((sum, row) => sum + row.recorridos, 0);

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, height: "100%" }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Recorridos por celda
          </Typography>
          <Typography color="text.secondary">
            Cantidad de recorridos agrupados por celda segÃºn los filtros activos.
          </Typography>
        </Box>
        <Chip color="warning" label={`${total} recorridos`} />
      </Box>

      <DataState loading={loading} empty={!rows.length} />
      {!!rows.length && (
        <Box sx={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              data={rows}
              margin={{ top: 18, right: 20, left: 0, bottom: 34 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="celda"
                interval={0}
                angle={-18}
                textAnchor="end"
                height={58}
              />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value, name, props) => {
                  const row = props.payload as ComplianceBarRow | undefined;
                  if (name === "recorridos" && row) {
                    return [
                      `${value} recorridos | ${row.buenos} buenos | ${row.malos} malos | ${row.tolvas} tolvas`,
                      "Celda",
                    ];
                  }

                  return [`${value}`, String(name)];
                }}
              />
              <Bar
                dataKey="recorridos"
                name="recorridos"
                fill="#ffb300"
                radius={[6, 6, 0, 0]}
                maxBarSize={72}
              >
                <LabelList dataKey="recorridos" position="top" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}
function TimeComplianceChart({
  rows,
  loading,
}: {
  rows: TimeChartRun[];
  loading: boolean;
}) {
  const goodRows = rows.filter((row) => row.estado === "bueno");
  const badRows = rows.filter((row) => row.estado === "malo");
  const compliance = toPercent(goodRows.length, rows.length);

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          alignItems: "start",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            GrÃ¡fica de cumplimiento por recorrido
          </Typography>
          <Typography color="text.secondary">
            La linea punteada marca el tiempo ideal parametrizado por cada
            equipo. Verde cumple, rojo sobrepasa el objetivo.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Chip color="success" label={`Buenos ${goodRows.length}`} />
          <Chip color="error" label={`Malos ${badRows.length}`} />
          <Chip color="primary" label={`${compliance}% cumplimiento`} />
        </Stack>
      </Box>

      <DataState loading={loading} empty={!rows.length} />
      {!!rows.length && (
        <>
          <Box sx={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <LineChart
                data={rows}
                margin={{ top: 28, right: 28, left: 8, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Minutos",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${value} ${name === "tolvas" ? "tolvas" : "min"}`,
                    name === "tiempo"
                      ? "Tiempo real"
                      : name === "objetivo"
                        ? "Objetivo"
                        : "Tolvas",
                  ]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as TimeChartRun | undefined;
                    return row
                      ? `Recorrido ${row.recorrido} | ${row.equipo} | ${row.almacenista}`
                      : "Recorrido";
                  }}
                />
                <Legend />
                <Line
                  type="stepAfter"
                  dataKey="objetivo"
                  name="Objetivo equipo"
                  stroke="#64748b"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="tiempo"
                  name="Tiempo real"
                  stroke="#0f6b9b"
                  strokeWidth={2}
                  dot={<TimeDot />}
                  activeDot={{ r: 7 }}
                >
                  <LabelList
                    dataKey="chartLabel"
                    position="top"
                    fontSize={12}
                    formatter={(value) => String(value ?? "")}
                  />
                </Line>
                <Line
                  type="monotone"
                  dataKey="tolvas"
                  name="Tolvas"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  hide
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 2,
              mt: 2,
            }}
          >
            <RunStatusTable
              title="Buenos"
              color="success"
              rows={goodRows}
              emptyLabel="Sin recorridos dentro del tiempo."
            />
            <RunStatusTable
              title="Malos"
              color="error"
              rows={badRows}
              emptyLabel="Sin recorridos fuera del tiempo."
            />
          </Box>
        </>
      )}
    </Paper>
  );
}

function TimeDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: TimeChartRun;
}) {
  if (cx === undefined || cy === undefined || !payload) {
    return null;
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={payload.estado === "bueno" ? "#00a651" : "#e91e63"}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

function RunStatusTable({
  title,
  color,
  rows,
  emptyLabel,
}: {
  title: string;
  color: "success" | "error";
  rows: TimeChartRun[];
  emptyLabel: string;
}) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: color === "success" ? "success.main" : "error.main",
          color: color === "success" ? "success.contrastText" : "error.contrastText",
        }}
      >
        <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
      </Box>
      {!rows.length ? (
        <Typography sx={{ p: 2 }} color="text.secondary">
          {emptyLabel}
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Recorrido</TableCell>
              <TableCell>Equipo</TableCell>
              <TableCell>Almacenista</TableCell>
              <TableCell>Tolvas</TableCell>
              <TableCell>Tiempo</TableCell>
              <TableCell>Objetivo</TableCell>
              <TableCell>Variacion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>R{row.recorrido}</TableCell>
                <TableCell>{row.equipo}</TableCell>
                <TableCell>{row.almacenista}</TableCell>
                <TableCell>{row.tolvas}</TableCell>
                <TableCell>{row.tiempo} min</TableCell>
                <TableCell>{row.objetivo} min</TableCell>
                <TableCell>{row.variacion} min</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

function HopperVolumeTable({
  rows,
  loading,
}: {
  rows: HopperVolumeRow[];
  loading: boolean;
}) {
  const topRow = rows[0];

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          alignItems: "center",
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Tolvas por equipo de lÃ­neas
          </Typography>
          <Typography color="text.secondary">
            Ranking final de equipos por total de tolvas movidas en los filtros
            seleccionados.
          </Typography>
        </Box>

        {topRow ? (
          <Chip
            color="primary"
            label={`Mayor volumen: ${topRow.label} | ${topRow.tolvasTotal} tolvas`}
          />
        ) : null}
      </Box>

      <DataState loading={loading} empty={!rows.length} />
      {!!rows.length && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Equipo / lÃ­neas</TableCell>
              <TableCell>Recorridos</TableCell>
              <TableCell>Total tolvas</TableCell>
              <TableCell>Prom. tolvas por recorrido</TableCell>
              <TableCell>Recorrido con mas tolvas</TableCell>
              <TableCell>Almacenista</TableCell>
              <TableCell>Tiempo</TableCell>
              <TableCell>Objetivo</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.recorridos}</TableCell>
                <TableCell>{row.tolvasTotal}</TableCell>
                <TableCell>{row.tolvasPromedio}</TableCell>
                <TableCell>
                  R{row.recorridoPico} | {row.tolvasPico} tolvas
                </TableCell>
                <TableCell>{row.almacenistaPico}</TableCell>
                <TableCell>{row.tiempoPicoMin} min</TableCell>
                <TableCell>{row.objetivoPicoMin} min</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

function PerformanceTable({
  title,
  rows,
  firstHeader,
}: {
  title: string;
  rows: PerformanceRow[];
  firstHeader: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      {!rows.length ? (
        <Typography color="text.secondary">Sin recorridos para este filtro.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{firstHeader}</TableCell>
              <TableCell>Recorridos</TableCell>
              <TableCell>Tolvas</TableCell>
              <TableCell>Objetivo</TableCell>
              <TableCell>Promedio real</TableCell>
              <TableCell>Variacion prom.</TableCell>
              <TableCell>Atraso max.</TableCell>
              <TableCell>Cumplimiento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.recorridos}</TableCell>
                <TableCell>{row.tolvas}</TableCell>
                <TableCell>{row.tiempoObjetivoMin} min</TableCell>
                <TableCell>{row.tiempoPromedioMin} min</TableCell>
                <TableCell>{row.variacionPromedioMin} min</TableCell>
                <TableCell>{row.atrasoMaximoMin} min</TableCell>
                <TableCell>{row.cumplimiento}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

function ComparisonTable({
  title,
  rows,
  firstHeader,
}: {
  title: string;
  rows: ComparisonRow[];
  firstHeader: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {title}
      </Typography>
      {!rows.length ? (
        <Typography color="text.secondary">Sin recorridos para este filtro.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{firstHeader}</TableCell>
              <TableCell>Recorridos</TableCell>
              <TableCell>Tolvas</TableCell>
              <TableCell>Tiempo prom.</TableCell>
              <TableCell>RÃ¡pido</TableCell>
              <TableCell>En rango</TableCell>
              <TableCell>Tarde</TableCell>
              <TableCell>Cumplimiento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.recorridos}</TableCell>
                <TableCell>{row.tolvas}</TableCell>
                <TableCell>{row.tiempoPromedioMin} min</TableCell>
                <TableCell>{row.rapido}</TableCell>
                <TableCell>{row.enRango}</TableCell>
                <TableCell>{row.tarde}</TableCell>
                <TableCell>{row.cumplimiento}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

function DataState({ loading, empty }: { loading: boolean; empty: boolean }) {
  if (loading) {
    return <Typography color="text.secondary">Cargando datos de Supabase...</Typography>;
  }

  if (empty) {
    return <Typography color="text.secondary">Sin recorridos para este filtro.</Typography>;
  }

  return null;
}

interface PerformanceRow {
  key: string;
  label: string;
  lineas: string[];
  recorridos: number;
  tolvas: number;
  tiempoObjetivoMin: number;
  tiempoPromedioMin: number;
  variacionPromedioMin: number;
  atrasoMaximoMin: number;
  cumplimiento: number;
}

interface ComparisonRow {
  key: string;
  label: string;
  recorridos: number;
  tolvas: number;
  tiempoPromedioMin: number;
  rapido: number;
  enRango: number;
  tarde: number;
  cumplimiento: number;
}

interface HopperVolumeRow {
  key: string;
  label: string;
  recorridos: number;
  tolvasTotal: number;
  tolvasPromedio: number;
  recorridoPico: number;
  tolvasPico: number;
  almacenistaPico: string;
  tiempoPicoMin: number;
  objetivoPicoMin: number;
}

function buildTeamOptions(runs: ReportRun[]) {
  const teams = new Map<string, string>();

  runs.forEach((run) => {
    teams.set(getTeamKey(run), formatLines(run.lineas));
  });

  return [...teams.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}


function buildCompliancePieRows(rows: TimeChartRun[]): CompliancePieRow[] {
  const good = rows.filter((row) => row.estado === "bueno").length;
  const bad = rows.filter((row) => row.estado === "malo").length;

  return [
    { name: "Buenos", value: good, color: "#2e7d32" },
    { name: "Malos", value: bad, color: "#d32f2f" },
  ].filter((row) => row.value > 0);
}
function buildComplianceBarRows(
  runs: ReportRun[],
  lines: SupplyLine[],
  cells: SupplyCell[]
): ComplianceBarRow[] {
  const grouped = new Map<string, ComplianceBarRow>();

  runs.forEach((run) => {
    const celda = getCellLabelForRun(run, lines, cells);
    const current =
      grouped.get(celda) ?? {
        celda,
        recorridos: 0,
        buenos: 0,
        malos: 0,
        tolvas: 0,
      };

    current.recorridos += 1;
    current.tolvas += run.tolvas;

    if (isRunCompliant(run)) {
      current.buenos += 1;
    } else {
      current.malos += 1;
    }

    grouped.set(celda, current);
  });

  return [...grouped.values()].sort((a, b) => b.recorridos - a.recorridos);
}

function getCellLabelForRun(
  run: ReportRun,
  lines: SupplyLine[],
  cells: SupplyCell[]
) {
  const cellIds = [
    ...new Set(
      run.lineas
        .map((codigo) => lines.find((line) => line.codigo === codigo)?.celdaId)
        .filter((cellId): cellId is string => Boolean(cellId))
    ),
  ];

  if (!cellIds.length) {
    return "Sin celda";
  }

  return cellIds
    .map((cellId) => cells.find((cell) => cell.id === cellId)?.nombre ?? "Sin celda")
    .sort()
    .join(" / ");
}
function buildTimeChartRuns(
  runs: ReportRun[],
  openRuns: OpenReportRun[] = []
): TimeChartRun[] {
  const closedRows = [...runs]
    .sort(compareRunsByAssignedSequence)
    .map((run, index) => {
      const equipo = formatLines(run.lineas);
      const tiempo = round(run.tiempoTotalMin);
      const objetivo = round(run.tiempoObjetivoMin);
      const recorrido = run.recorridoSecuencia ?? index + 1;

      return {
        id: run.id,
        orden: recorrido,
        label: `R${recorrido}`,
        chartLabel: `R${recorrido} ${equipo} (${run.tolvas} tolvas)`,
        equipo,
        almacenista: run.almacenista,
        grupoLabel: run.grupoLabel,
        recorrido,
        recorridoLabel: `R${recorrido}`,
        tolvas: run.tolvas,
        tiempo,
        objetivo,
        variacion: round(tiempo - objetivo),
        estado: tiempo <= objetivo ? "bueno" : "malo",
      } satisfies TimeChartRun;
    });

  const overdueOpenRows = openRuns
    .filter((run) => run.tiempoTotalMin > run.tiempoObjetivoMin)
    .map((run, index) => {
      const equipo = formatLines(run.lineas);
      const tiempo = round(run.tiempoTotalMin);
      const objetivo = round(run.tiempoObjetivoMin);
      const recorrido = closedRows.length + index + 1;

      return {
        id: `open-${run.id}`,
        orden: recorrido,
        label: `Activo ${index + 1}`,
        chartLabel: `Activo ${equipo} (${run.tolvas} tolvas)`,
        equipo,
        almacenista: run.almacenista,
        grupoLabel: run.grupoLabel,
        recorrido,
        recorridoLabel: "En proceso",
        tolvas: run.tolvas,
        tiempo,
        objetivo,
        variacion: round(tiempo - objetivo),
        estado: "malo",
        enProceso: true,
      } satisfies TimeChartRun;
    });

  return [...closedRows, ...overdueOpenRows];
}

function assignRunSequence(runs: ReportRun[]) {
  const indexedRuns = runs.map((run, index) => ({ run, originalIndex: index }));
  const chronologicalRuns = [...indexedRuns].sort((left, right) => {
    const timeComparison = compareRunsByTimestamp(left.run, right.run);

    if (timeComparison !== 0) {
      return timeComparison;
    }

    // Supabase entrega cerrados de mas reciente a mas antiguo; si la fecha no
    // desempata, invertir el indice original mantiene R1 como el recorrido mas viejo.
    return right.originalIndex - left.originalIndex;
  });
  const sequenceById = new Map(
    chronologicalRuns.map(({ run }, index) => [run.id, index + 1])
  );

  return runs.map((run) => ({
    ...run,
    recorridoSecuencia: sequenceById.get(run.id) ?? 1,
  }));
}

function compareRunsByAssignedSequence(left: ReportRun, right: ReportRun) {
  const leftSequence = left.recorridoSecuencia ?? 0;
  const rightSequence = right.recorridoSecuencia ?? 0;

  if (leftSequence !== rightSequence) {
    return leftSequence - rightSequence;
  }

  return compareRunsByTimestamp(left, right);
}

function compareRunsByTimestamp(left: ReportRun, right: ReportRun) {
  const leftTime = getRunSequenceTime(left);
  const rightTime = getRunSequenceTime(right);
  const leftValid = Number.isFinite(leftTime);
  const rightValid = Number.isFinite(rightTime);

  if (leftValid && rightValid && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  if (leftValid !== rightValid) {
    return leftValid ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

function getRunSequenceTime(run: ReportRun) {
  return Date.parse(run.retornoAt || run.salidaAt || run.entradaAt);
}
function getTeamKey(run: ReportRun) {
  return run.lineas.join("/");
}

function buildReport(runs: ReportRun[], lines: SupplyLine[], cells: SupplyCell[]) {
  const recorridosCumplidos = runs.filter(isRunCompliant).length;
  const totalTolvas = runs.reduce((total, run) => total + run.tolvas, 0);
  const desempenoPorLinea = buildLinePerformance(runs);
  const desempenoPorCelda = buildCellPerformance(runs, lines, cells);

  return {
    totalRecorridos: runs.length,
    totalTolvas,
    cumplimiento: toPercent(recorridosCumplidos, runs.length),
    ...getPeakHopperHour(runs),
    comparativoPorGrupo: buildComparison(
      runs,
      (run) => run.grupo ?? "sin-grupo",
      (run) => run.grupoLabel
    ),
    comparativoPorEquipo: buildComparison(
      runs,
      (run) => run.lineas.join("/"),
      (run) => formatLines(run.lineas)
    ),
    cumplimientoPorAlmacenista: buildKeeperCompliance(runs),
    tolvasPorEquipo: buildHopperVolumeRows(runs),
    desempenoPorLinea,
    desempenoPorCelda,
    lineaMayorVariacion: maxBy(desempenoPorLinea, "variacionPromedioMin"),
    lineaMasAtrasada: maxBy(desempenoPorLinea, "atrasoMaximoMin"),
    lineaMejorCumplimiento: maxBy(desempenoPorLinea, "cumplimiento"),
  };
}

function enrichRun(
  run: DbKioskRun,
  assignments: SupplyAssignment[],
  people: SupplyPerson[]
): ReportRun | null {
  if (!run.salidaAt || !run.retornoAt || !run.tiempoTotalMin) {
    return null;
  }

  const fecha = formatDate(run.entradaAt);
  const turnoId = getShiftForTimestamp(run.entradaAt);
  const assignment = findHistoricalAssignment(run, assignments, fecha, turnoId);
  const person = assignment
    ? people.find((item) => item.id === assignment.almacenistaId)
    : undefined;
  const supervisor = assignment
    ? people.find((item) => item.id === assignment.supervisorId)
    : undefined;

  return {
    id: run.id,
    fecha,
    codigoBarras: run.codigoBarras,
    lineas: run.lineas,
    tienda: run.tienda,
    tolvas: run.tolvas,
    entradaAt: run.entradaAt,
    salidaAt: run.salidaAt,
    retornoAt: run.retornoAt,
    tiempoLlenadoMin: run.tiempoLlenadoMin ?? 0,
    tiempoRepartoMin: run.tiempoRepartoMin ?? 0,
    tiempoTotalMin: run.tiempoTotalMin,
    tiempoObjetivoMin: run.tiempoObjetivoMin,
    estado: run.cumplimiento ?? "en_rango",
    turnoId,
    grupo: person?.grupo,
    grupoLabel: person ? formatGroup(person.grupo) : "Sin asignaciÃ³n",
    almacenista: person?.nombre ?? "Sin asignaciÃ³n",
    supervisor: supervisor?.nombre ?? "Sin supervisor",
    cierreAutomatico: run.cierreAutomatico,
    cierreMotivo: run.cierreMotivo,
  };
}

function enrichOpenRun(
  run: DbKioskRun,
  assignments: SupplyAssignment[],
  people: SupplyPerson[],
  now: Date | null
): OpenReportRun | null {
  if (run.estado === "cerrado") {
    return null;
  }

  const fecha = formatDate(run.entradaAt);
  const turnoId = getShiftForTimestamp(run.entradaAt);
  const assignment = findHistoricalAssignment(run, assignments, fecha, turnoId);
  const person = assignment
    ? people.find((item) => item.id === assignment.almacenistaId)
    : undefined;
  const tiempoTotalMin = now ? diffMinutes(new Date(run.entradaAt), now) : 0;
  const tiempoObjetivoMin = run.tiempoObjetivoMin;

  return {
    id: run.id,
    fecha,
    codigoBarras: run.codigoBarras,
    lineas: run.lineas,
    tolvas: run.tolvas,
    entradaAt: run.entradaAt,
    salidaAt: run.salidaAt,
    estado: run.estado,
    turnoId,
    grupo: person?.grupo,
    grupoLabel: person ? formatGroup(person.grupo) : "Sin asignaciÃ³n",
    almacenista: person?.nombre ?? "Sin asignaciÃ³n",
    tiempoTotalMin,
    tiempoObjetivoMin,
    variacionMin: tiempoTotalMin - tiempoObjetivoMin,
  };
}

function findHistoricalAssignment(
  run: DbKioskRun,
  assignments: SupplyAssignment[],
  fecha: string,
  turnoId: string
) {
  const candidates = assignments
    .filter((assignment) => {
      const startsBefore = assignment.vigenteDesde <= fecha;
      const endsAfter = !assignment.vigenteHasta || assignment.vigenteHasta >= fecha;
      const sameShift = assignment.turnoId === turnoId;
      const hasLine = run.lineas.some((line) => assignment.lineas.includes(line));

      return startsBefore && endsAfter && sameShift && hasLine;
    })
    .sort((a, b) => matchingLines(b, run.lineas) - matchingLines(a, run.lineas));

  return candidates[0];
}

function matchingLines(assignment: SupplyAssignment, lineas: string[]) {
  return lineas.filter((line) => assignment.lineas.includes(line)).length;
}

function buildKeeperCompliance(runs: ReportRun[]) {
  const grouped = groupBy(
    runs,
    (run) => `${run.almacenista}|${run.grupoLabel}|${run.turnoId}`
  );

  return Object.values(grouped).map((items) => {
    const first = items[0];
    const dentroRango = items.filter((run) => run.estado === "en_rango").length;
    const cumplidos = items.filter(isRunCompliant).length;
    const totalTiempo = items.reduce((total, run) => total + run.tiempoTotalMin, 0);

    return {
      almacenista: first.almacenista,
      grupoLabel: first.grupoLabel,
      turno: getShiftName(first.turnoId),
      recorridos: items.length,
      tolvas: items.reduce((total, run) => total + run.tolvas, 0),
      tiempoPromedioMin: round(totalTiempo / items.length),
      rapido: items.filter((run) => run.estado === "rapido").length,
      enRango: dentroRango,
      tarde: items.filter((run) => run.estado === "tarde").length,
      cumplimiento: toPercent(cumplidos, items.length),
    };
  });
}

function buildComparison(
  runs: ReportRun[],
  keyFn: (run: ReportRun) => string,
  labelFn: (run: ReportRun) => string
): ComparisonRow[] {
  const grouped = groupBy(runs, keyFn);

  return Object.entries(grouped).map(([key, items]) => {
    const totalTiempo = items.reduce((total, run) => total + run.tiempoTotalMin, 0);
    const enRango = items.filter((run) => run.estado === "en_rango").length;
    const cumplidos = items.filter(isRunCompliant).length;

    return {
      key,
      label: labelFn(items[0]),
      recorridos: items.length,
      tolvas: items.reduce((total, run) => total + run.tolvas, 0),
      tiempoPromedioMin: round(totalTiempo / items.length),
      rapido: items.filter((run) => run.estado === "rapido").length,
      enRango,
      tarde: items.filter((run) => run.estado === "tarde").length,
      cumplimiento: toPercent(cumplidos, items.length),
    };
  });
}

function buildHopperVolumeRows(runs: ReportRun[]): HopperVolumeRow[] {
  const grouped = groupBy(runs, getTeamKey);

  return Object.entries(grouped)
    .map(([key, items]) => {
      const tolvasTotal = items.reduce((total, run) => total + run.tolvas, 0);
      const peakRun = items.reduce((selected, run) =>
        run.tolvas > selected.tolvas ? run : selected
      );
      const peakIndex = runs.findIndex((run) => run.id === peakRun.id);

      return {
        key,
        label: formatLines(items[0].lineas),
        recorridos: items.length,
        tolvasTotal,
        tolvasPromedio: round(tolvasTotal / items.length),
        recorridoPico: peakRun.recorridoSecuencia ?? (peakIndex >= 0 ? peakIndex + 1 : 1),
        tolvasPico: peakRun.tolvas,
        almacenistaPico: peakRun.almacenista,
        tiempoPicoMin: round(peakRun.tiempoTotalMin),
        objetivoPicoMin: round(peakRun.tiempoObjetivoMin),
      };
    })
    .sort((a, b) => b.tolvasTotal - a.tolvasTotal);
}

function buildLinePerformance(runs: ReportRun[]): PerformanceRow[] {
  const grouped = groupBy(runs, (run) => `${run.tienda}|${run.lineas.join("/")}`);
  return Object.values(grouped).map((items) => buildPerformanceRow(items, formatLines(items[0].lineas)));
}

function buildCellPerformance(
  runs: ReportRun[],
  lines: SupplyLine[],
  cells: SupplyCell[]
): PerformanceRow[] {
  const grouped = groupBy(runs, (run) => {
    const firstLine = lines.find((line) => line.codigo === run.lineas[0]);
    return firstLine?.celdaId ?? "sin-celda";
  });

  return Object.entries(grouped).map(([cellId, items]) => {
    const cell = cells.find((item) => item.id === cellId);
    return buildPerformanceRow(items, cell?.nombre ?? "Sin celda", cellId);
  });
}

function buildPerformanceRow(items: ReportRun[], label: string, key = label): PerformanceRow {
  const first = items[0];
  const totalTiempo = items.reduce((total, run) => total + run.tiempoTotalMin, 0);
  const totalVariacion = items.reduce(
    (total, run) => total + Math.abs(run.tiempoTotalMin - run.tiempoObjetivoMin),
    0
  );
  const atrasoMaximoMin = items.reduce(
    (max, run) => Math.max(max, run.tiempoTotalMin - run.tiempoObjetivoMin),
    0
  );
  const cumplidos = items.filter(isRunCompliant).length;

  return {
    key,
    label,
    lineas: first.lineas,
    recorridos: items.length,
    tolvas: items.reduce((total, run) => total + run.tolvas, 0),
    tiempoObjetivoMin: first.tiempoObjetivoMin,
    tiempoPromedioMin: round(totalTiempo / items.length),
    variacionPromedioMin: round(totalVariacion / items.length),
    atrasoMaximoMin,
    cumplimiento: toPercent(cumplidos, items.length),
  };
}

function isRunCompliant(run: ReportRun) {
  return run.estado === "rapido" || run.estado === "en_rango";
}

function getPeakHopperHour(runs: ReportRun[]) {
  const buckets = runs.reduce<Record<string, number>>((acc, run) => {
    const hour = `${formatTime(run.entradaAt).slice(0, 2)}:00`;
    acc[hour] = (acc[hour] ?? 0) + run.tolvas;
    return acc;
  }, {});

  const peak = Object.entries(buckets).reduce(
    (selected, [hora, tolvas]) =>
      tolvas > selected.tolvasHoraPico ? { horaPicoTolvas: hora, tolvasHoraPico: tolvas } : selected,
    { horaPicoTolvas: "Sin datos", tolvasHoraPico: 0 }
  );

  return peak;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = keyFn(item);
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});
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

function formatLines(lineas?: string[]) {
  return lineas?.join("/") ?? "Sin datos";
}

function formatGroup(group: SupplyCrewGroup) {
  return group === "grupo-1" ? "Grupo 1" : "Grupo 2";
}

function diffMinutes(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

function toPercent(value: number, total: number) {
  if (!total) {
    return 0;
  }

  return Math.round((value / total) * 1000) / 10;
}


function exportBitacoraToExcel(runs: ReportRun[], desde: string, hasta: string) {
  const headers = [
    "Fecha",
    "CÃ³digo equipo",
    "Grupo",
    "Turno",
    "Almacenista",
    "Supervisor",
    "LÃ­neas",
    "Tolvas",
    "Entrada",
    "Salida",
    "Retorno",
    "Llenado min",
    "Reparto min",
    "Total min",
    "Objetivo min",
    "Variacion min",
    "Estado",
    "Cierre",
    "Motivo cierre",
  ];

  const rows = runs.map((run) => [
    run.fecha,
    run.codigoBarras,
    run.grupoLabel,
    getShiftName(run.turnoId),
    run.almacenista,
    run.supervisor,
    formatLines(run.lineas),
    run.tolvas,
    formatTime(run.entradaAt),
    formatTime(run.salidaAt),
    formatTime(run.retornoAt),
    run.tiempoLlenadoMin,
    run.tiempoRepartoMin,
    run.tiempoTotalMin,
    run.tiempoObjetivoMin,
    run.tiempoTotalMin - run.tiempoObjetivoMin,
    formatRunStatus(run.estado),
    run.cierreAutomatico ? "Sistema cerrÃ³ automÃ¡ticamente" : "Escaneo manual",
    run.cierreMotivo ?? "",
  ]);

  const blob = createXlsxBlob("Bitacora", [headers, ...rows]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `bitacora-recorridos-${desde}-a-${hasta}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createXlsxBlob(sheetName: string, rows: unknown[][]) {
  const worksheet = buildWorksheetXml(sheetName, rows);
  const files = [
    {
      path: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        "</Types>",
    },
    {
      path: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        "</Relationships>",
    },
    {
      path: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        "<sheets>" +
        `<sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>` +
        "</sheets>" +
        "</workbook>",
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>",
    },
    {
      path: "xl/styles.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF156082"/><bgColor indexed="64"/></patternFill></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
        "</styleSheet>",
    },
    { path: "xl/worksheets/sheet1.xml", content: worksheet },
  ];

  return createZipBlob(files);
}

function buildWorksheetXml(sheetName: string, rows: unknown[][]) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) => buildCellXml(value, rowIndex, colIndex))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const lastCell = `${columnName(Math.max(rows[0]?.length ?? 1, 1))}${Math.max(rows.length, 1)}`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${lastCell}"/>` +
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    '<cols><col min="1" max="17" width="18" customWidth="1"/></cols>' +
    `<sheetData>${body}</sheetData>` +
    `<autoFilter ref="A1:${lastCell}"/>` +
    `<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>` +
    "</worksheet>"
  );
}

function buildCellXml(value: unknown, rowIndex: number, colIndex: number) {
  const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
  const style = rowIndex === 0 ? ' s="1"' : "";

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }

  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(String(value ?? ""))}</t></is></c>`;
}

function columnName(index: number) {
  let name = "";
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }

  return name;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createZipBlob(files: Array<{ path: string; content: string }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.path);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);

    localParts.push(localHeader, nameBytes, data);

    const centralHeader = new Uint8Array(46);
    const centralView = new DataView(centralHeader.buffer);

    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);

    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);

  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const zipParts: BlobPart[] = [...localParts, ...centralParts, end].map((part) => new Uint8Array(part).buffer);

  return new Blob(zipParts, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;

  data.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });

  return (crc ^ 0xffffffff) >>> 0;
}

function maxBy<T>(items: T[], key: keyof T) {
  return items.reduce<T | undefined>((selected, item) => {
    if (!selected) {
      return item;
    }

    return Number(item[key]) > Number(selected[key]) ? item : selected;
  }, undefined);
}






