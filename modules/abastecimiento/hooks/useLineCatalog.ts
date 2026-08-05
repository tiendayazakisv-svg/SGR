"use client";

import { useEffect, useState } from "react";
import type { SupplyLine, SupplyTimeParameter } from "@/types/abastecimiento";
import {
  supplyLines,
  supplyTimeParameters,
} from "@/services/abastecimiento/abastecimiento.service";
import {
  createLineGroupInDb,
  createLineInDb,
  listLineCatalogFromDb,
  removeLineGroupInDb,
  updateLineActiveInDb,
  updateLineGroupInDb,
  updateLineInDb,
} from "@/services/abastecimiento/abastecimiento-db.service";

export function useLineCatalog() {
  const [lines, setLinesState] = useState<SupplyLine[]>(supplyLines);
  const [lineGroups, setLineGroupsState] = useState<SupplyTimeParameter[]>(() =>
    supplyTimeParameters
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    listLineCatalogFromDb()
      .then((catalog) => {
        if (!active || !catalog) {
          return;
        }

        setLinesState(catalog.lines);
        setLineGroupsState(catalog.lineGroups);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  function setLines(nextLines: SupplyLine[]) {
    setLinesState(nextLines);
  }

  function setLineGroups(nextGroups: SupplyTimeParameter[]) {
    setLineGroupsState(nextGroups);
  }

  function findLineGroupByBarcode(codigoBarras: string) {
    return lineGroups.find(
      (group) => group.codigoBarras === codigoBarras.trim()
    );
  }

  async function createLine(line: SupplyLine) {
    const saved = await createLineInDb(line);
    if (!saved) {
      return null;
    }

    const nextLine = saved ?? line;
    const nextLines = [nextLine, ...lines];
    setLines(nextLines);
    return nextLine;
  }

  async function toggleLine(id: string, activa: boolean) {
    await updateLineActiveInDb(id, activa);
    setLines(
      lines.map((line) => (line.id === id ? { ...line, activa } : line))
    );
  }

  async function updateLine(line: SupplyLine) {
    const saved = await updateLineInDb(line);
    if (!saved) {
      return null;
    }

    setLines(lines.map((item) => (item.id === saved.id ? saved : item)));
    return saved;
  }

  async function createLineGroup(group: SupplyTimeParameter) {
    const saved = await createLineGroupInDb(group);
    if (!saved) {
      return null;
    }

    const nextGroup = saved ?? group;
    const nextGroups = [nextGroup, ...lineGroups];
    setLineGroups(nextGroups);
    return nextGroup;
  }

  async function updateLineGroup(group: SupplyTimeParameter) {
    const saved = await updateLineGroupInDb(group);
    if (!saved) {
      return null;
    }

    setLineGroups(
      lineGroups.map((item) => (item.id === saved.id ? saved : item))
    );
    return saved;
  }

  async function removeLineGroup(id: string) {
    await removeLineGroupInDb(id);
    setLineGroups(lineGroups.filter((group) => group.id !== id));
  }

  return {
    lines,
    lineGroups,
    loading,
    setLines,
    setLineGroups,
    createLine,
    toggleLine,
    updateLine,
    createLineGroup,
    updateLineGroup,
    removeLineGroup,
    findLineGroupByBarcode,
  };
}
