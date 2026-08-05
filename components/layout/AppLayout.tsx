"use client";

import { Box } from "@mui/material";
import AutoLogout from "@/components/auth/AutoLogout";
import AppNavbar from "./AppNavbar";
import AppSidebar from "./AppSidebar";

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <AutoLogout />
      <AppSidebar />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppNavbar />

        <Box
          sx={{
            p: { xs: 2, md: 3 },
            backgroundColor: "background.default",
            color: "text.primary",
            minHeight: "calc(100vh - 64px)",
            overflowX: "hidden",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}