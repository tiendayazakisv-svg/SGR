"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
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
import type {
  SupplyCell,
  SupplyLine,
  SupplyTimeParameter,
} from "@/types/abastecimiento";
import { useLineCatalog } from "@/modules/abastecimiento/hooks/useLineCatalog";
import {
  SUPPLY_STORE,
  supplyCells,
} from "@/services/abastecimiento/abastecimiento.service";
import { listCellsFromDb } from "@/services/abastecimiento/abastecimiento-db.service";

export default function LinesCrud() {
  const {
    lines,
    lineGroups,
    createLine,
    toggleLine,
    updateLine,
    createLineGroup,
    updateLineGroup,
    removeLineGroup,
  } = useLineCatalog();
  const [cells, setCells] = useState(supplyCells);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [lineDraft, setLineDraft] = useState({
    codigo: "",
    nombre: "",
    celdaId: supplyCells[0]?.id ?? "",
  });
  const [groupDraft, setGroupDraft] = useState({
    codigoBarras: "",
    lineas: "",
    tiempoObjetivoMin: "34",
    toleranciaRapidoMin: "5",
    toleranciaTardeMin: "4",
  });

  useEffect(() => {
    let active = true;

    listCellsFromDb().then((result) => {
      if (!active || !result) {
        return;
      }

      setCells(result);
      setLineDraft((current) => ({
        ...current,
        celdaId: result[0]?.id ?? current.celdaId,
      }));
    });

    return () => {
      active = false;
    };
  }, []);

  async function saveLine() {
    if (!lineDraft.codigo.trim() || !lineDraft.nombre.trim()) {
      return;
    }

    const line: SupplyLine = {
      id: `linea-${Date.now()}`,
      codigo: lineDraft.codigo.trim().toUpperCase(),
      nombre: lineDraft.nombre.trim(),
      celdaId: lineDraft.celdaId,
      activa: true,
    };

    if (editingLineId) {
      const currentLine = lines.find((item) => item.id === editingLineId);
      await updateLine({
        ...line,
        id: editingLineId,
        activa: currentLine?.activa ?? true,
      });
    } else {
      await createLine(line);
    }

    setEditingLineId(null);
    setLineDraft({ codigo: "", nombre: "", celdaId: cells[0]?.id ?? supplyCells[0]?.id ?? "" });
  }

  function editLine(line: SupplyLine) {
    setEditingLineId(line.id);
    setLineDraft({
      codigo: line.codigo,
      nombre: line.nombre,
      celdaId: line.celdaId,
    });
  }

  function cancelLineEdit() {
    setEditingLineId(null);
    setLineDraft({ codigo: "", nombre: "", celdaId: cells[0]?.id ?? supplyCells[0]?.id ?? "" });
  }

  async function saveLineGroup() {
    const parsedLines = groupDraft.lineas
      .split(",")
      .map((line) => line.trim().toUpperCase())
      .filter(Boolean);

    if (!groupDraft.codigoBarras.trim() || parsedLines.length === 0) {
      return;
    }

    const group: SupplyTimeParameter = {
      id: `param-${Date.now()}`,
      codigoBarras: groupDraft.codigoBarras.trim(),
      tienda: SUPPLY_STORE,
      lineas: parsedLines,
      tiempoObjetivoMin: Number(groupDraft.tiempoObjetivoMin),
      toleranciaRapidoMin: Number(groupDraft.toleranciaRapidoMin),
      toleranciaTardeMin: Number(groupDraft.toleranciaTardeMin),
    };

    if (editingGroupId) {
      await updateLineGroup({ ...group, id: editingGroupId });
    } else {
      await createLineGroup(group);
    }

    setEditingGroupId(null);
    setGroupDraft({
      codigoBarras: "",
      lineas: "",
      tiempoObjetivoMin: "34",
      toleranciaRapidoMin: "5",
      toleranciaTardeMin: "4",
    });
  }

  function editLineGroup(group: SupplyTimeParameter) {
    setEditingGroupId(group.id);
    setGroupDraft({
      codigoBarras: group.codigoBarras,
      lineas: group.lineas.join(","),
      tiempoObjetivoMin: String(group.tiempoObjetivoMin),
      toleranciaRapidoMin: String(group.toleranciaRapidoMin),
      toleranciaTardeMin: String(group.toleranciaTardeMin),
    });
  }

  function cancelGroupEdit() {
    setEditingGroupId(null);
    setGroupDraft({
      codigoBarras: "",
      lineas: "",
      tiempoObjetivoMin: "34",
      toleranciaRapidoMin: "5",
      toleranciaTardeMin: "4",
    });
  }

  function toggleGroupDraftLine(lineCode: string) {
    const selected = selectedLines(groupDraft.lineas);
    const nextLines = selected.includes(lineCode)
      ? selected.filter((line) => line !== lineCode)
      : [...selected, lineCode];

    setGroupDraft((current) => ({
      ...current,
      lineas: nextLines.join(","),
    }));
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {editingLineId ? "Editar línea" : "Adicionar línea"}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Cada línea pertenece a una celda. Esta relación se usa para reportes por celda.
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" },
            gap: 2,
          }}
        >
          <TextField
            label="Código"
            value={lineDraft.codigo}
            onChange={(event) =>
              setLineDraft((current) => ({ ...current, codigo: event.target.value }))
            }
          />
          <TextField
            label="Nombre"
            value={lineDraft.nombre}
            onChange={(event) =>
              setLineDraft((current) => ({ ...current, nombre: event.target.value }))
            }
          />
          <TextField
            select
            label="Celda"
            value={lineDraft.celdaId}
            onChange={(event) =>
              setLineDraft((current) => ({ ...current, celdaId: event.target.value }))
            }
          >
            <MenuItem value="">Seleccione celda</MenuItem>
            {cells.map((cell) => (
              <MenuItem key={cell.id} value={cell.id}>
                {cell.codigo} - {cell.nombre}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" sx={{ gap: 1 }}>
            <Button
              variant="contained"
              onClick={saveLine}
              disabled={
                !lineDraft.codigo.trim() ||
                !lineDraft.nombre.trim() ||
                !lineDraft.celdaId
              }
            >
              {editingLineId ? "Guardar" : "Agregar"}
            </Button>
            {editingLineId && (
              <Button variant="outlined" onClick={cancelLineEdit}>
                Cancelar
              </Button>
            )}
          </Stack>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          {editingGroupId
            ? "Editar equipo de líneas"
            : "Equipos de líneas para kiosko"}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Un equipo contiene una o varias líneas y tiene el código de barras que se escanea en kiosko. Tienda fija: {SUPPLY_STORE}
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
            mb: 2,
          }}
        >
          <TextField
            label="Código de barras del equipo"
            value={groupDraft.codigoBarras}
            onChange={(event) =>
              setGroupDraft((current) => ({
                ...current,
                codigoBarras: event.target.value,
              }))
            }
            placeholder="000001516"
          />
          <TextField
            label="Objetivo min"
            value={groupDraft.tiempoObjetivoMin}
            onChange={(event) =>
              setGroupDraft((current) => ({
                ...current,
                tiempoObjetivoMin: event.target.value,
              }))
            }
            inputMode="numeric"
          />
          <TextField
            label="Rápido min"
            value={groupDraft.toleranciaRapidoMin}
            onChange={(event) =>
              setGroupDraft((current) => ({
                ...current,
                toleranciaRapidoMin: event.target.value,
              }))
            }
            inputMode="numeric"
          />
          <TextField
            label="Tarde min"
            value={groupDraft.toleranciaTardeMin}
            onChange={(event) =>
              setGroupDraft((current) => ({
                ...current,
                toleranciaTardeMin: event.target.value,
              }))
            }
            inputMode="numeric"
          />
        </Box>

        <Box
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1.5,
            mb: 2,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
              gap: 1.5,
              alignItems: "start",
              mb: 1.5,
            }}
          >
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Asociar líneas al equipo
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Marque una o varias líneas previamente creadas. Esas líneas formarán el equipo que se escaneará en kiosko.
              </Typography>
            </Box>
            <Chip
              color={selectedLines(groupDraft.lineas).length ? "primary" : "default"}
              label={`${selectedLines(groupDraft.lineas).length} líneas seleccionadas`}
            />
          </Box>

          {lines.filter((line) => line.activa).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Primero cree líneas independientes para poder formar un equipo.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, 1fr)",
                  lg: "repeat(4, 1fr)",
                },
                gap: 0.5,
              }}
            >
              {lines
                .filter((line) => line.activa)
                .map((line) => (
                  <FormControlLabel
                    key={line.id}
                    control={
                      <Checkbox
                        checked={selectedLines(groupDraft.lineas).includes(line.codigo)}
                        onChange={() => toggleGroupDraftLine(line.codigo)}
                      />
                    }
                    label={`${line.codigo} - ${line.nombre} (${cellName(cells, line.celdaId)})`}
                  />
                ))}
            </Box>
          )}
        </Box>

        {selectedLines(groupDraft.lineas).length > 0 && (
          <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap", mb: 2 }}>
            {selectedLines(groupDraft.lineas).map((lineCode) => (
              <Chip
                key={lineCode}
                label={lineCode}
                onDelete={() => toggleGroupDraftLine(lineCode)}
              />
            ))}
          </Stack>
        )}

        <Stack direction="row" sx={{ gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            onClick={saveLineGroup}
            disabled={
              !groupDraft.codigoBarras.trim() ||
              selectedLines(groupDraft.lineas).length === 0
            }
          >
            {editingGroupId ? "Guardar" : "Agregar equipo"}
          </Button>
          {editingGroupId && (
            <Button variant="outlined" onClick={cancelGroupEdit}>
              Cancelar
            </Button>
          )}
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Equipo</TableCell>
              <TableCell>Código kiosko</TableCell>
              <TableCell>Líneas</TableCell>
              <TableCell>Tienda</TableCell>
              <TableCell>Objetivo</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {lineGroups.map((group) => (
              <TableRow key={group.id}>
                <TableCell>{formatTeamName(group.lineas)}</TableCell>
                <TableCell>{group.codigoBarras}</TableCell>
                <TableCell>{group.lineas.join("/")}</TableCell>
                <TableCell>{group.tienda}</TableCell>
                <TableCell>{group.tiempoObjetivoMin} min</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => editLineGroup(group)}>
                    Editar
                  </Button>
                  <Button size="small" onClick={() => removeLineGroup(group.id)}>
                    Quitar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Líneas registradas
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Código</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Celda</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>{line.codigo}</TableCell>
                <TableCell>{line.nombre}</TableCell>
                <TableCell>{cellName(cells, line.celdaId)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={line.activa ? "success" : "default"}
                    label={line.activa ? "Activa" : "Inactiva"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => editLine(line)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    onClick={() => toggleLine(line.id, !line.activa)}
                  >
                    {line.activa ? "Desactivar" : "Activar"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}

function cellName(cells: SupplyCell[], id: string) {
  return cells.find((cell) => cell.id === id)?.nombre ?? "Sin celda";
}

function selectedLines(value: string) {
  return value
    .split(",")
    .map((line) => line.trim().toUpperCase())
    .filter(Boolean);
}

function formatTeamName(lineas: string[]) {
  return lineas.join("-");
}
