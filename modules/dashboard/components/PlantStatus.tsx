"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type {
  SupplyAssignment,
  SupplyCrewGroup,
  SupplyPerson,
  SupplyTimeParameter,
} from "@/types/abastecimiento";
import {
  listAssignmentsFromDb,
  listAccessUsersFromDb,
  listLineCatalogFromDb,
  listPersonnelFromDb,
} from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import {
  belongsToGroupScope,
  findCurrentAccess,
  formatGroupScope,
  getSessionGroupScope,
  type GroupScope,
} from "@/services/auth/current-access";

export default function PlantStatus() {
  const [assignments, setAssignments] = useState<SupplyAssignment[]>([]);
  const [people, setPeople] = useState<SupplyPerson[]>([]);
  const [lineGroups, setLineGroups] = useState<SupplyTimeParameter[]>([]);
  const [visibleGroup, setVisibleGroup] = useState<GroupScope>("sin-grupo");

  useEffect(() => {
    let active = true;

    Promise.all([
      listAssignmentsFromDb(),
      listPersonnelFromDb(),
      listLineCatalogFromDb(),
      listAccessUsersFromDb(),
      getCurrentUser(),
    ]).then(([dbAssignments, dbPeople, catalog, accessUsers, auth]) => {
      if (!active) {
        return;
      }

      const access = findCurrentAccess(accessUsers, auth);

      setVisibleGroup(getSessionGroupScope(access));
    });

    return () => {
      active = false;
    };
  }, []);

  const visibleAssignments = useMemo(
    () =>
      assignments.filter((assignment) => {
        const person = people.find((item) => item.id === assignment.almacenistaId);
        return belongsToGroupScope(person?.grupo, visibleGroup);
      }),
    [assignments, people, visibleGroup]
  );

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
        Estado de planta
      </Typography>

      <Typography variant="subtitle2" sx={{ mb: 2 }} color="text.secondary">
        Cobertura por equipo de líneas asignado y estado del almacenista. Vista: {formatGroupScope(visibleGroup)}.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {visibleAssignments.map((assignment) => {
          const person = people.find((item) => item.id === assignment.almacenistaId);
          const lineGroup = lineGroups.find((group) =>
            sameLineSet(group.lineas, assignment.lineas)
          );

          return (
            <Chip
              key={assignment.id}
              label={`${formatTeam(lineGroup, assignment)} | ${
                person?.nombre ?? "Sin persona"
              }${person?.activo ? "" : " | Pausa"}`}
              color={person?.activo ? "success" : "warning"}
              variant="filled"
            />
          );
        })}
        {!visibleAssignments.length && <Chip label="Sin asignaciónes vigentes" />}
      </Box>
    </Paper>
  );
}

function formatTeam(
  group: SupplyTimeParameter | undefined,
  assignment: SupplyAssignment
) {
  const lines = group?.lineas ?? assignment.lineas;
  return `Equipo ${lines.join("/")}`;
}

function sameLineSet(left: string[], right: string[]) {
  return normalizeLines(left) === normalizeLines(right);
}

function normalizeLines(lineas: string[]) {
  return [...lineas]
    .map((line) => line.trim().toUpperCase())
    .sort()
    .join("|");
}
