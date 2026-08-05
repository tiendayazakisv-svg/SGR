"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default function DashboardHeader() {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h4"
        component="h1"
        sx={{
          fontWeight: 700,
        }}
      >
        Dashboard
      </Typography>

      <Typography
        variant="body1"
        color="text.secondary"
      >
        Sistema de Gestión de Recorridos
      </Typography>
    </Box>
  );
}