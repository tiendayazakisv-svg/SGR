"use client";

import { Box } from "@mui/material";

interface Props {
  children: React.ReactNode;
}

export default function AppContent({
  children,
}: Props) {
  return (
    <Box
      sx={{
        p: 3,
      }}
    >
      {children}
    </Box>
  );
}