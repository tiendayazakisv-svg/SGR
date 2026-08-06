import {
  AccountTree,
  Engineering,
  Groups,
  Info,
  QrCodeScanner,
  SystemUpdateAlt,
  Timeline,
  Verified,
} from "@mui/icons-material";
import { Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import patchInfo from "@/config/systemPatch.json";

interface PatchHistoryItem {
  label: string;
  version: string;
  updatedAt: string;
  description: string;
}

type PatchJson = typeof patchInfo & {
  history?: PatchHistoryItem[];
};

const typedPatchInfo = patchInfo as PatchJson;
const patchHistory = (
  Array.isArray(typedPatchInfo.history)
    ? typedPatchInfo.history
    : [
        {
          label: patchInfo.label,
          version: patchInfo.version,
          updatedAt: patchInfo.updatedAt,
          description: patchInfo.description,
        },
      ]
)
  .filter((item) => item.label && item.version && item.updatedAt)
  .sort((left, right) => {
    const patchDiff = patchNumber(right.label) - patchNumber(left.label);
    return patchDiff || right.updatedAt.localeCompare(left.updatedAt);
  });

export default function AboutPage() {
  return (
    <Stack spacing={3}>
      <Paper
        elevation={0}
        sx={{
          position: "relative",
          overflow: "hidden",
          p: { xs: 2.5, md: 4 },
          borderRadius: 2,
          color: "common.white",
          bgcolor: "#073b4c",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(135deg, rgba(7,59,76,1), rgba(10,79,95,0.94), rgba(25,118,210,0.78))",
          }}
        />

        <Box sx={{ position: "relative", maxWidth: 880 }}>
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.55,
              mb: 2,
              borderRadius: 99,
              bgcolor: "rgba(255,255,255,0.14)",
            }}
          >
            <Info fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 800 }}>
              Informacion del sistema
            </Typography>
          </Box>

          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 34, md: 48 },
              lineHeight: 1.05,
              fontWeight: 950,
              maxWidth: 760,
            }}
          >
            Sistema de Gestion de Recorridos
          </Typography>
          <Typography
            sx={{
              mt: 1.5,
              maxWidth: 680,
              color: "rgba(255,255,255,0.78)",
              fontSize: 17,
            }}
          >
            Plataforma para control de abastecimiento de componentes, recorridos,
            tolvas, turnos, equipos de líneas y cumplimiento operativo.
          </Typography>
        </Box>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.05fr 0.95fr" },
          gap: 3,
          alignItems: "stretch",
        }}
      >
        <Paper elevation={0} sx={panelSx}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <IconFrame icon={<Engineering />} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Desarrollo
                </Typography>
                <Typography color="text.secondary">
                  Responsable tecnico y area propietaria del sistema.
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              <DetailCard
                icon={<Verified />}
                label="Desarrollado por"
                value="Ing. Marvin Ruiz Santos"
              />
              <DetailCard icon={<Groups />} label="Área" value="Ingeniería" />
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={panelSx}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <IconFrame icon={<SystemUpdateAlt />} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  Versión del sistema
                </Typography>
                <Typography color="text.secondary">
                  Ultimo parche aplicado y version vigente.
                </Typography>
              </Box>
            </Stack>

            <Divider />

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 1.25,
              }}
            >
              <PatchMetric label="Parche" value={patchInfo.label} strong />
              <PatchMetric label="Versión" value={patchInfo.version} />
              <PatchMetric label="Fecha" value={patchInfo.updatedAt} />
            </Box>

            <Typography color="text.secondary">{patchInfo.description}</Typography>
          </Stack>
        </Paper>
      </Box>

      <Paper elevation={0} sx={panelSx}>
        <Stack spacing={2}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                Historial de parches
              </Typography>
              <Typography color="text.secondary">
                Ordenado del parche mas reciente al mas antiguo. Se actualiza con los comandos de parche.
              </Typography>
            </Box>
            <Chip
              color="primary"
              label={`${patchHistory.length} parches registrados`}
            />
          </Box>

          <Box sx={{ overflowX: "auto" }}>
            <Box sx={{ minWidth: 780 }}>
              <PatchHeader />
              <Stack spacing={1}>
                {patchHistory.map((item, index) => (
                  <PatchRow
                    key={`${item.label}-${item.updatedAt}-${index}`}
                    item={item}
                    current={item.label === patchInfo.label}
                  />
                ))}
              </Stack>
            </Box>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={panelSx}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Alcance operativo
            </Typography>
            <Typography color="text.secondary">
              Modulos principales que soportan la medicion diaria de recorridos.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 1.5,
            }}
          >
            <ScopeItem icon={<QrCodeScanner />} title="Kiosko" />
            <ScopeItem icon={<AccountTree />} title="Líneas y equipos" />
            <ScopeItem icon={<Groups />} title="Grupos y supervisores" />
            <ScopeItem icon={<Timeline />} title="Reportes y cumplimiento" />
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}

const panelSx = {
  p: { xs: 2.5, md: 3 },
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
};

function PatchHeader() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "130px 120px 140px 1fr",
        gap: 1.5,
        px: 1.5,
        py: 1,
        color: "text.secondary",
        fontWeight: 800,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 900 }}>
        Parche
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 900 }}>
        Versión
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 900 }}>
        Fecha
      </Typography>
      <Typography variant="caption" sx={{ fontWeight: 900 }}>
        Descripción
      </Typography>
    </Box>
  );
}

function PatchRow({
  item,
  current,
}: {
  item: PatchHistoryItem;
  current: boolean;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "130px 120px 140px 1fr",
        gap: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: current ? "primary.main" : "divider",
        bgcolor: current ? "action.selected" : "background.default",
        alignItems: "center",
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography sx={{ fontWeight: 900, color: "primary.main" }}>
          {item.label}
        </Typography>
        {current ? <Chip size="small" color="primary" label="Actual" /> : null}
      </Stack>
      <Typography sx={{ fontWeight: 800 }}>{item.version}</Typography>
      <Typography color="text.secondary">{formatPatchDate(item.updatedAt)}</Typography>
      <Typography color="text.secondary">{item.description}</Typography>
    </Box>
  );
}

function IconFrame({ icon }: { icon: React.ReactElement }) {
  return (
    <Box
      sx={{
        width: 56,
        height: 56,
        display: "grid",
        placeItems: "center",
        borderRadius: 2,
        color: "primary.main",
        bgcolor: "action.hover",
      }}
    >
      {icon}
    </Box>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        p: 2,
        minHeight: 124,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Stack spacing={1.25}>
        <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>
          {value}
        </Typography>
      </Stack>
    </Box>
  );
}

function PatchMetric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: strong ? "primary.main" : "background.default",
        color: strong ? "primary.contrastText" : "text.primary",
        border: "1px solid",
        borderColor: strong ? "primary.main" : "divider",
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: strong ? "inherit" : "text.secondary" }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

function ScopeItem({
  icon,
  title,
}: {
  icon: React.ReactElement;
  title: string;
}) {
  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 1.5,
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
        <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
      </Stack>
    </Box>
  );
}

function patchNumber(label: string) {
  return Number(label.replace(/\D/g, "")) || 0;
}

function formatPatchDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}