import type { ReactElement } from "react";
import {
  Engineering,
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

const labels = {
  systemInfo: "Informaci\u00f3n del sistema",
  appTitle: "Sistema de Gesti\u00f3n de Recorridos",
  appDescription:
    "Control de abastecimiento de componentes, recorridos, tolvas, turnos, equipos de l\u00edneas y cumplimiento operativo.",
  currentVersion: "Versi\u00f3n actual",
  development: "Desarrollo",
  developmentSubtitle: "Responsable t\u00e9cnico del sistema.",
  developedBy: "Desarrollado por",
  area: "\u00c1rea",
  engineering: "Ingenier\u00eda",
  activePatch: "Parche vigente",
  activePatchSubtitle: "\u00daltima actualizaci\u00f3n registrada.",
  patch: "Parche",
  version: "Versi\u00f3n",
  date: "Fecha",
  patchHistory: "Historial de parches",
  patchHistorySubtitle: "Ordenado del m\u00e1s reciente al m\u00e1s antiguo.",
  registered: "registrados",
  operationalScope: "Alcance operativo",
  operationalScopeSubtitle: "M\u00f3dulos principales del sistema.",
  modules: ["Kiosko", "L\u00edneas y equipos", "Grupos y supervisores", "Reportes y cumplimiento"],
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
  .map((item) => ({
    ...item,
    description: cleanText(item.description),
  }))
  .sort((left, right) => {
    const dateDiff = right.updatedAt.localeCompare(left.updatedAt);
    return dateDiff || patchNumber(right.label) - patchNumber(left.label);
  });

export default function AboutPage() {
  const currentPatch = patchHistory[0] ?? {
    label: patchInfo.label,
    version: patchInfo.version,
    updatedAt: patchInfo.updatedAt,
    description: cleanText(patchInfo.description),
  };

  return (
    <Stack spacing={2.5}>
      <Paper elevation={0} sx={heroSx}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            alignItems: { xs: "flex-start", md: "center" },
            justifyContent: "space-between",
          }}
        >
          <Box>
            <Chip
              icon={<Info />}
              label={labels.systemInfo}
              size="small"
              sx={{
                mb: 1.5,
                bgcolor: "rgba(255,255,255,0.14)",
                color: "common.white",
                fontWeight: 800,
                ".MuiChip-icon": { color: "common.white" },
              }}
            />
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 34, md: 46 },
                lineHeight: 1.04,
                fontWeight: 950,
              }}
            >
              {labels.appTitle}
            </Typography>
            <Typography
              sx={{
                mt: 1,
                maxWidth: 680,
                color: "rgba(255,255,255,0.78)",
                fontSize: 16,
              }}
            >
              {labels.appDescription}
            </Typography>
          </Box>

          <Box sx={versionBadgeSx}>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {labels.currentVersion}
            </Typography>
            <Typography sx={{ fontWeight: 950, fontSize: 22 }}>
              {patchInfo.version}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {patchInfo.label} - {formatPatchDate(patchInfo.updatedAt)}
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "0.9fr 1.1fr" },
          gap: 2.5,
        }}
      >
        <Paper elevation={0} sx={panelSx}>
          <SectionTitle
            icon={<Engineering />}
            title={labels.development}
            subtitle={labels.developmentSubtitle}
          />
          <Divider sx={{ my: 2 }} />
          <Stack spacing={1.5}>
            <InfoLine
              icon={<Verified />}
              label={labels.developedBy}
              value="Ing. Marvin Ruiz Santos"
            />
            <InfoLine
              icon={<Engineering />}
              label={labels.area}
              value={labels.engineering}
            />
          </Stack>
        </Paper>

        <Paper elevation={0} sx={panelSx}>
          <SectionTitle
            icon={<SystemUpdateAlt />}
            title={labels.activePatch}
            subtitle={labels.activePatchSubtitle}
          />
          <Divider sx={{ my: 2 }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
              gap: 1.25,
            }}
          >
            <Metric label={labels.patch} value={currentPatch.label} highlight />
            <Metric label={labels.version} value={currentPatch.version} />
            <Metric label={labels.date} value={formatPatchDate(currentPatch.updatedAt)} />
          </Box>
          <Typography color="text.secondary" sx={{ mt: 1.75 }}>
            {currentPatch.description}
          </Typography>
        </Paper>
      </Box>

      <Paper elevation={0} sx={panelSx}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", sm: "center" },
            mb: 2,
          }}
        >
          <SectionTitle
            icon={<Timeline />}
            title={labels.patchHistory}
            subtitle={labels.patchHistorySubtitle}
          />
          <Chip
            color="primary"
            size="small"
            label={patchHistory.length + " " + labels.registered}
          />
        </Stack>

        <Stack spacing={1}>
          {patchHistory.map((item, index) => (
            <PatchItem
              key={[item.label, item.updatedAt, index].join("-")}
              item={item}
              current={item.label === currentPatch.label}
            />
          ))}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={panelSx}>
        <SectionTitle
          icon={<QrCodeScanner />}
          title={labels.operationalScope}
          subtitle={labels.operationalScopeSubtitle}
        />
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1.25, mt: 2 }}>
          {labels.modules.map((item) => (
            <Chip key={item} label={item} variant="outlined" sx={{ fontWeight: 800 }} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

const heroSx = {
  p: { xs: 2.5, md: 3.5 },
  borderRadius: 2,
  color: "common.white",
  background: "linear-gradient(135deg, #073b4c 0%, #0a5c70 46%, #1976d2 100%)",
};

const panelSx = {
  p: { xs: 2.25, md: 2.75 },
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
};

const versionBadgeSx = {
  minWidth: { xs: "100%", md: 190 },
  p: 2,
  borderRadius: 2,
  bgcolor: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.18)",
};

const iconSx = {
  width: 42,
  height: 42,
  display: "grid",
  placeItems: "center",
  borderRadius: 1.5,
  color: "primary.main",
  bgcolor: "action.hover",
  flex: "0 0 auto",
};

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: ReactElement;
  title: string;
  subtitle: string;
}) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Box sx={iconSx}>{icon}</Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 950 }}>
          {title}
        </Typography>
        <Typography color="text.secondary">{subtitle}</Typography>
      </Box>
    </Stack>
  );
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: ReactElement;
  label: string;
  value: string;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "36px 1fr",
        gap: 1.25,
        alignItems: "center",
      }}
    >
      <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography sx={{ fontWeight: 900 }}>{value}</Typography>
      </Box>
    </Box>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: highlight ? "primary.main" : "action.hover",
        color: highlight ? "primary.contrastText" : "text.primary",
      }}
    >
      <Typography
        variant="caption"
        sx={{ color: highlight ? "inherit" : "text.secondary" }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 950 }}>{value}</Typography>
    </Box>
  );
}

function PatchItem({
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
        gridTemplateColumns: { xs: "1fr", md: "130px 120px 1fr auto" },
        gap: { xs: 0.75, md: 1.5 },
        alignItems: "center",
        p: 1.5,
        borderRadius: 1.5,
        bgcolor: current ? "action.selected" : "background.default",
        border: "1px solid",
        borderColor: current ? "primary.main" : "divider",
      }}
    >
      <Typography sx={{ fontWeight: 950, color: "primary.main" }}>
        {item.label}
      </Typography>
      <Typography sx={{ fontWeight: 850 }}>{item.version}</Typography>
      <Typography color="text.secondary">{item.description}</Typography>
      <Chip
        size="small"
        label={formatPatchDate(item.updatedAt)}
        color={current ? "primary" : "default"}
      />
    </Box>
  );
}

function patchNumber(label: string) {
  return Number(label.replace(/\D/g, "")) || 0;
}

function formatPatchDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? day + "/" + month + "/" + year : "Sin fecha";
}

function cleanText(value: string) {
  return [
    ["Versi\u00c3\u00b3n", "Versi\u00f3n"],
    ["Versi\u00c3\u0192\u00c2\u00b3n", "Versi\u00f3n"],
    ["Informaci\u00c3\u00b3n", "Informaci\u00f3n"],
    ["Gesti\u00c3\u00b3n", "Gesti\u00f3n"],
    ["l\u00c3\u00adneas", "l\u00edneas"],
    ["Ingenier\u00c3\u00ada", "Ingenier\u00eda"],
    ["\u00c3\u0081rea", "\u00c1rea"],
    ["m\u00c3\u00a1s", "m\u00e1s"],
    ["\u00c3\u009altima", "\u00daltima"],
    ["actualizaci\u00c3\u00b3n", "actualizaci\u00f3n"],
  ].reduce((text, [from, to]) => text.split(from).join(to), value);
}
