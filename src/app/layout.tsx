import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Club de Audio Ibero",
  description: "Organización del laboratorio y proyectos del Club de Audio Ibero",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
