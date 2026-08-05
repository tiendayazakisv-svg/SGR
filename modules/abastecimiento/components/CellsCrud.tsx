"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import type { SupplyCell } from "@/types/abastecimiento";
import { supplyCells } from "@/services/abastecimiento/abastecimiento.service";
import {
  createCellInDb,
  listCellsFromDb,
  updateCellActiveInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";

export default function CellsCrud() {
  const [cells, setCells] = useState(supplyCells);
  const [draft, setDraft] = useState({ codigo: "", nombre: "" });

  useEffect(() => {
    let active = true;

    listCellsFromDb().then((result) => {
      if (active && result) {
        setCells(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function addCell() {
    if (!draft.codigo.trim() || !draft.nombre.trim()) {
      return;
    }

    const cell: SupplyCell = {
      id: `celda-${Date.now()}`,
      codigo: draft.codigo.trim().toUpperCase(),
      nombre: draft.nombre.trim(),
      activa: true,
    };

    const saved = await createCellInDb(cell);
    setCells((current) => [saved ?? cell, ...current]);
    setDraft({ codigo: "", nombre: "" });
  }

  async function toggleCell(id: string, activa: boolean) {
    await updateCellActiveInDb(id, activa);
    setCells((current) =>
      current.map((cell) => (cell.id === id ? { ...cell, activa } : cell))
    );
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Adicionar celda
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 2fr auto" },
            gap: 2,
          }}
        >
          <TextField
            label="Codigo"
            value={draft.codigo}
            onChange={(event) =>
              setDraft((current) => ({ ...current, codigo: event.target.value }))
            }
          />
          <TextField
            label="Nombre"
            value={draft.nombre}
            onChange={(event) =>
              setDraft((current) => ({ ...current, nombre: event.target.value }))
            }
          />
          <Button variant="contained" onClick={addCell}>
            Agregar
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Celdas registradas
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Codigo</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {cells.map((cell) => (
              <TableRow key={cell.id}>
                <TableCell>{cell.codigo}</TableCell>
                <TableCell>{cell.nombre}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={cell.activa ? "success" : "default"}
                    label={cell.activa ? "Activa" : "Inactiva"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => toggleCell(cell.id, !cell.activa)}
                  >
                    {cell.activa ? "Desactivar" : "Activar"}
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
