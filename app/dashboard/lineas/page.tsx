import { Box, Typography } from "@mui/material";
import LinesCrud from "@/modules/abastecimiento/components/LinesCrud";

export default function Page() {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Líneas y equipos
        </Typography>
        <Typography color="text.secondary">
          Líneas enlazadas a celdas y equipos de líneas con código de barras para kiosko.
        </Typography>
      </Box>

      <LinesCrud />
    </>
  );
}
