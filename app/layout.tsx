import type { Metadata } from "next";
import AppThemeProvider from "@/providers/ThemeProvider";
import MuiRegistry from "@/providers/MuiRegistry";

export const metadata: Metadata = {
  title: "Sistema de Gestión de Recorridos",
  description: "SGR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <MuiRegistry>
          <AppThemeProvider>{children}</AppThemeProvider>
        </MuiRegistry>
      </body>
    </html>
  );
}
