"use client";

import { useEffect, useState } from "react";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import type { AccessUser } from "@/services/abastecimiento/abastecimiento-db.service";
import { listAccessUsersFromDb } from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser, logout } from "@/services/auth/auth.service";

export default function AppNavbar() {
  const [access, setAccess] = useState<AccessUser | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([getCurrentUser(), listAccessUsersFromDb()]).then(([auth, users]) => {
      if (!active) {
        return;
      }

      const email = auth.data.user?.email?.toLowerCase();
      setAccess(users?.find((user) => user.email.toLowerCase() === email) ?? null);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  const name = access?.nombre ?? "Usuario";

  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.paper",
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <Typography
          variant="h6"
          component="h1"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            color: "text.primary",
          }}
        >
          Sistema de Gestion de Recorridos
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 1, md: 2 },
            minWidth: 0,
          }}
        >
          <Typography
            variant="body1"
            component="span"
            sx={{ color: "text.primary", display: { xs: "none", sm: "inline" } }}
          >
            {name}
          </Typography>

          <Avatar sx={{ width: 40, height: 40 }}>
            {name.slice(0, 1).toUpperCase()}
          </Avatar>

          <Button variant="outlined" size="small" onClick={handleLogout}>
            Salir
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}