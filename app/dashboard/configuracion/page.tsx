import { Box, Typography } from "@mui/material";
import AppearanceSettings from "@/components/settings/AppearanceSettings";
import PasswordSettings from "@/components/settings/PasswordSettings";

export default function Page() {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Configuración
        </Typography>

        <Typography color="text.secondary">
          Preferencias visuales guardadas en este navegador.
        </Typography>
      </Box>

      <PasswordSettings />
      <AppearanceSettings />
    </>
  );
}
