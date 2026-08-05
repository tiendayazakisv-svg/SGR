import { Box, Typography } from "@mui/material";
import CellsCrud from "@/modules/abastecimiento/components/CellsCrud";
import LinesCrud from "@/modules/abastecimiento/components/LinesCrud";

export default function Page() {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Celdas
        </Typography>
        <Typography color="text.secondary">
          CRUD de celdas para organizar líneas y reportes.
        </Typography>
      </Box>

      <CellsCrud />

      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
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
