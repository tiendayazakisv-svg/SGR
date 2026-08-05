"use client";

import type { MouseEvent } from "react";
import {
  DarkMode,
  LightMode,
  PaletteOutlined,
} from "@mui/icons-material";
import {
  Box,
  Chip,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { AppColorMode } from "@/providers/ThemeProvider";
import { useAppTheme } from "@/providers/ThemeProvider";

export default function AppearanceSettings() {
  const { mode, setMode } = useAppTheme();

  function handleModeChange(
    _event: MouseEvent<HTMLElement>,
    nextMode: AppColorMode | null
  ) {
    if (nextMode) {
      setMode(nextMode);
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, mb: 3 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
          gap: 2,
          alignItems: "center",
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <PaletteOutlined color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Apariencia del sistema
            </Typography>
            <Typography color="text.secondary">
              El modo claro u oscuro se guarda solo en este navegador.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            color={mode === "dark" ? "primary" : "default"}
            label={mode === "dark" ? "Modo oscuro activo" : "Modo claro activo"}
          />
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={handleModeChange}
            size="small"
          >
            <ToggleButton value="light" aria-label="Modo claro">
              <LightMode fontSize="small" />
            </ToggleButton>
            <ToggleButton value="dark" aria-label="Modo oscuro">
              <DarkMode fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Box>
    </Paper>
  );
}
