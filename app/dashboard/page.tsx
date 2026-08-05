"use client";

import Box from "@mui/material/Box";

import DashboardHeader from "@/modules/dashboard/components/DashboardHeader";
import KpiCard from "@/modules/dashboard/components/KpiCard";
import PlantStatus from "@/modules/dashboard/components/PlantStatus";
import ActivityTable from "@/modules/dashboard/components/ActivityTable";

import { useDashboard } from "@/modules/dashboard/hooks/useDashboard";

export default function DashboardPage() {
  const { data, loading } = useDashboard();

  if (loading || !data) {
    return <p>Cargando...</p>;
  }

  return (
    <Box>
      <DashboardHeader />

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(3,1fr)",
            xl: "repeat(6,1fr)",
          },
          gap: 2,
          mb: 4,
        }}
      >
        <KpiCard title="Cerrados hoy" value={data.recorridos} />
        <KpiCard title="En proceso" value={data.enProceso} />
        <KpiCard title="Cumplimiento" value={`${data.cumplimiento}%`} />
        <KpiCard title="Tolvas" value={data.tolvas} />
        <KpiCard title="Tiempo Prom." value={`${data.tiempoPromedio} min`} />
        <KpiCard title="Pausados" value={data.almacenistasPausados} />
      </Box>

      <Box sx={{ mb: 4 }}>
        <PlantStatus />
      </Box>

      <ActivityTable />
    </Box>
  );
}
