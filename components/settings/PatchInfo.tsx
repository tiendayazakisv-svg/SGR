import { SystemUpdateAlt } from "@mui/icons-material";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import patchInfo from "@/config/systemPatch.json";

export default function PatchInfo() {
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
          <SystemUpdateAlt color="primary" />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Parche del sistema
            </Typography>
            <Typography color="text.secondary">
              Control local de version para despliegues y cambios aplicados.
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Chip color="primary" label={patchInfo.label} />
          <Chip variant="outlined" label={`Versión ${patchInfo.version}`} />
          <Chip variant="outlined" label={`Actualizado ${patchInfo.updatedAt}`} />
        </Stack>
      </Box>

      <Typography sx={{ mt: 2 }} color="text.secondary">
        {patchInfo.description}
      </Typography>
    </Paper>
  );
}
