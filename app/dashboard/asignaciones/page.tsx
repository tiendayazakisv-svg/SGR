import { Box, Typography } from "@mui/material";
import AssignmentManager from "@/modules/abastecimiento/components/AssignmentManager";
import { getAssignmentHistory } from "@/services/abastecimiento/abastecimiento.service";

export default function Page() {
  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Asignacion semanal
        </Typography>
        <Typography color="text.secondary">
          Cambios de lineas, facilitadores, coberturas por ausencia y rotacion quincenal.
        </Typography>
      </Box>

      <AssignmentManager initialAssignments={getAssignmentHistory()} />
    </>
  );
}
