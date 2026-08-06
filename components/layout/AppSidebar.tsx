"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { MENU } from "@/config/menu";
import type { AccessRole } from "@/services/abastecimiento/abastecimiento-db.service";
import { listAccessUsersFromDb } from "@/services/abastecimiento/abastecimiento-db.service";
import { getCurrentUser } from "@/services/auth/auth.service";
import { findCurrentAccess } from "@/services/auth/current-access";

const expandedWidth = 260;
const collapsedWidth = 76;
const STORAGE_KEY = "sgr-sidebar-collapsed";

export default function AppSidebar() {
  const [role, setRole] = useState<AccessRole | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    let active = true;

    Promise.all([getCurrentUser(), listAccessUsersFromDb()]).then(([auth, users]) => {
      if (!active) {
        return;
      }

      const access = findCurrentAccess(users, auth);
      setRole(access?.rol ?? null);
    });

    return () => {
      active = false;
    };
  }, []);

  const visibleMenu = useMemo(
    () => MENU.filter((item) => !item.adminOnly || role === "administrador"),
    [role]
  );
  const drawerWidth = collapsed ? collapsedWidth : expandedWidth;

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: "width 180ms ease",
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
          borderRight: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.primary",
          overflowX: "hidden",
          transition: "width 180ms ease",
        },
      }}
    >
      <Toolbar
        sx={{
          px: collapsed ? 1 : 2,
          minHeight: 96,
          position: "relative",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {!collapsed ? (
          <Box
            sx={{
              width: "100%",
              minWidth: 0,
              textAlign: "center",
              display: "grid",
              justifyItems: "center",
              gap: 0.25,
              pr: 3,
              pl: 3,
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 900,
                color: "primary.main",
                lineHeight: 1,
                letterSpacing: 0,
              }}
            >
              SGR
            </Typography>

            <Typography
              variant="caption"
              component="p"
              color="text.secondary"
              sx={{
                maxWidth: 180,
                lineHeight: 1.35,
                textAlign: "center",
              }}
            >
              Sistema de Gestion de Recorridos
            </Typography>
          </Box>
        ) : null}

        <Tooltip title={collapsed ? "Expandir menu" : "Contraer menu"}>
          <IconButton
            onClick={toggleCollapsed}
            size="small"
            aria-label={collapsed ? "Expandir menu" : "Contraer menu"}
            sx={{
              position: collapsed ? "static" : "absolute",
              right: collapsed ? "auto" : 8,
              top: collapsed ? "auto" : "50%",
              transform: collapsed ? "none" : "translateY(-50%)",
            }}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      <List sx={{ mt: 1 }}>
        {visibleMenu.map((item) => {
          const Icon = item.icon;

          return (
            <Tooltip
              key={item.path}
              title={collapsed ? item.title : ""}
              placement="right"
            >
              <ListItemButton
                component={Link}
                href={item.path}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  mb: 0.5,
                  minHeight: 44,
                  justifyContent: collapsed ? "center" : "flex-start",
                  color: "text.primary",
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: collapsed ? 0 : 40,
                    justifyContent: "center",
                    color: "text.secondary",
                  }}
                >
                  <Icon fontSize="small" />
                </ListItemIcon>

                {!collapsed ? <ListItemText primary={item.title} /> : null}
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Drawer>
  );
}
