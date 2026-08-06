import {
  Dashboard,
  People,
  GridView,
  AccountTree,
  CalendarMonth,
  QrCodeScanner,
  Monitor,
  BarChart,
  Settings,
  AdminPanelSettings,
  SupervisorAccount,
  Info,
} from "@mui/icons-material";

export interface MenuItem {
  title: string;
  path: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

export const MENU: MenuItem[] = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: Dashboard,
  },
  {
    title: "Personal Operativo",
    path: "/dashboard/usuarios",
    icon: People,
  },
  {
    title: "Accesos",
    path: "/dashboard/accesos",
    icon: AdminPanelSettings,
    adminOnly: true,
  },
  {
    title: "Celdas",
    path: "/dashboard/celdas",
    icon: GridView,
  },
  {
    title: "Líneas y equipos",
    path: "/dashboard/lineas",
    icon: AccountTree,
  },
  {
    title: "Asignación semanal",
    path: "/dashboard/asignaciones",
    icon: CalendarMonth,
  },
  {
    title: "Supervisor",
    path: "/dashboard/supervisor",
    icon: SupervisorAccount,
  },
  {
    title: "Kiosko",
    path: "/kiosko",
    icon: QrCodeScanner,
  },
  {
    title: "Monitoreo",
    path: "/dashboard/monitoreo",
    icon: Monitor,
  },
  {
    title: "Reportes",
    path: "/dashboard/reportes",
    icon: BarChart,
  },
  {
    title: "Configuración",
    path: "/dashboard/configuracion",
    icon: Settings,
  },
  {
    title: "Acerca de",
    path: "/dashboard/about",
    icon: Info,
  },
];
