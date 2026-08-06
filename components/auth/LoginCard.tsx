import { AdminPanelSettings, Badge, ShieldOutlined } from "@mui/icons-material";
import { Box, Paper, Stack, Typography } from "@mui/material";
import LoginForm from "./LoginForm";

export default function LoginCard() {
  return (
    <Paper
      elevation={0}
      sx={{
        width: "100%",
        maxWidth: 460,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(15, 23, 42, 0.16)",
      }}
    >
      <Box
        sx={{
          p: 3,
          bgcolor: "#073b4c",
          color: "common.white",
        }}
      >
        <Stack direction="row" sx={{ alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: 1.5,
              bgcolor: "rgba(255,255,255,0.14)",
            }}
          >
            <Badge />
          </Box>
          <Box>
            <Typography variant="h5" component="h2" sx={{ fontWeight: 900 }}>
              Acceso operativo
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.74)" }}>
              Ingrese con SAP ID y contraseña
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
          <AccessPill icon={<ShieldOutlined fontSize="small" />}>
            Supervisor por grupo
          </AccessPill>
          <AccessPill icon={<AdminPanelSettings fontSize="small" />}>
            Administrador ambos grupos
          </AccessPill>
        </Stack>
      </Box>

      <Stack spacing={3} sx={{ p: 3 }}>
        <Box>
          <Typography variant="body2" color="text.secondary">
            El kiosko permanece libre. Este acceso controla dashboard,
            asignaciones, reportes y supervisor.
          </Typography>
        </Box>

        <LoginForm />

        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Administrador inicial: SAP ID ADMIN. Cambie la contraseña desde
            Accesos despues del primer ingreso.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function AccessPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.6,
        px: 1,
        py: 0.35,
        borderRadius: 99,
        color: "common.white",
        bgcolor: "rgba(255,255,255,0.13)",
      }}
    >
      {icon}
      <Typography variant="caption" sx={{ fontWeight: 800 }}>
        {children}
      </Typography>
    </Box>
  );
}
