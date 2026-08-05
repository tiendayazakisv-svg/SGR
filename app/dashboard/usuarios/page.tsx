import { Box, Typography } from "@mui/material";
import PersonnelCrud from "@/modules/abastecimiento/components/PersonnelCrud";

export default function Page() {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Personal Operativo
        </Typography>
        <Typography color="text.secondary">
          Almacenistas y facilitadores con SAP ID, grupo, turno y codigo de barras.
        </Typography>
      </Box>

      <PersonnelCrud />
    </>
  );
}
