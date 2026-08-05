"use client";

import { useEffect, useState } from "react";
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
} from "@mui/material";
import type {
  SupplyCrewGroup,
  SupplyPerson,
  SupplyPosition,
} from "@/types/abastecimiento";
import {
  getShiftName,
  supplyPersonnel,
  supplyShifts,
} from "@/services/abastecimiento/abastecimiento.service";
import {
  createPersonInDb,
  listPersonnelFromDb,
  updatePersonActiveInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";

const positions: SupplyPosition[] = ["almacenista", "facilitador"];
const crewGroups: SupplyCrewGroup[] = ["grupo-1", "grupo-2"];

export default function PersonnelCrud() {
  const [people, setPeople] = useState(supplyPersonnel);
  const [draft, setDraft] = useState({
    sapId: "",
    nombre: "",
    puesto: "almacenista" as SupplyPosition,
    grupo: "grupo-1" as SupplyCrewGroup,
    turnoId: "turno-a",
    codigoBarras: "",
  });

  useEffect(() => {
    let active = true;

    listPersonnelFromDb().then((result) => {
      if (active && result) {
        setPeople(result);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  async function addPerson() {
    if (!draft.sapId.trim() || !draft.nombre.trim()) {
      return;
    }

    const person: SupplyPerson = {
      id: `per-${Date.now()}`,
      sapId: draft.sapId.trim(),
      nombre: draft.nombre.trim(),
      puesto: draft.puesto,
      grupo: draft.grupo,
      turnoId: draft.turnoId,
      codigoBarras: draft.codigoBarras.trim() || `SGR-${draft.sapId.trim()}`,
      activo: true,
    };

    const saved = await createPersonInDb(person);
    setPeople((current) => [saved ?? person, ...current]);
    setDraft({
      sapId: "",
      nombre: "",
      puesto: "almacenista",
      grupo: "grupo-1",
      turnoId: "turno-a",
      codigoBarras: "",
    });
  }

  async function toggleActive(id: string, activo: boolean) {
    await updatePersonActiveInDb(id, activo);
    setPeople((current) =>
      current.map((person) =>
        person.id === id ? { ...person, activo } : person
      )
    );
  }

  return (
    <Stack spacing={3}>
      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Adicionar personal
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2,
          }}
        >
          <TextField
            label="SAP ID"
            value={draft.sapId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sapId: event.target.value }))
            }
          />
          <TextField
            label="Nombre"
            value={draft.nombre}
            onChange={(event) =>
              setDraft((current) => ({ ...current, nombre: event.target.value }))
            }
          />
          <TextField
            select
            label="Puesto"
            value={draft.puesto}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                puesto: event.target.value as SupplyPosition,
              }))
            }
          >
            {positions.map((position) => (
              <MenuItem key={position} value={position}>
                {position}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Turno"
            value={draft.turnoId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, turnoId: event.target.value }))
            }
          >
            {supplyShifts.map((shift) => (
              <MenuItem key={shift.id} value={shift.id}>
                {shift.nombre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Grupo"
            value={draft.grupo}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                grupo: event.target.value as SupplyCrewGroup,
              }))
            }
          >
            {crewGroups.map((group) => (
              <MenuItem key={group} value={group}>
                {formatGroup(group)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Codigo de barras"
            value={draft.codigoBarras}
            onChange={(event) =>
              setDraft((current) => ({ ...current, codigoBarras: event.target.value }))
            }
          />
          <Button variant="contained" onClick={addPerson}>
            Agregar
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Personal operativo registrado
        </Typography>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>SAP ID</TableCell>
              <TableCell>Nombre</TableCell>
              <TableCell>Puesto</TableCell>
              <TableCell>Grupo</TableCell>
              <TableCell>Turno</TableCell>
              <TableCell>Codigo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {people
              .filter((person) => person.puesto !== "supervisor")
              .map((person) => (
              <TableRow key={person.id}>
                <TableCell>{person.sapId}</TableCell>
                <TableCell>{person.nombre}</TableCell>
                <TableCell>{person.puesto}</TableCell>
                <TableCell>{formatGroup(person.grupo)}</TableCell>
                <TableCell>{getShiftName(person.turnoId)}</TableCell>
                <TableCell>{person.codigoBarras}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={person.activo ? "success" : "default"}
                    label={person.activo ? "Activo" : "Inactivo"}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    onClick={() => toggleActive(person.id, !person.activo)}
                  >
                    {person.activo ? "Desactivar" : "Activar"}
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

function formatGroup(group: SupplyCrewGroup) {
  return group === "grupo-1" ? "Grupo 1" : "Grupo 2";
}
