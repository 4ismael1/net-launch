import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = { themeColor: "#0b0b0a", colorScheme: "dark", viewportFit: "cover" };

// Preferencia de la barra lateral aplicada antes del primer pintado (evita que se vea abierta y se cierre).
const SIDEBAR_PREF = `try{if(localStorage.getItem("net:sidebar")==="1")document.documentElement.dataset.sb="c"}catch(e){}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://net-launch.vercel.app"),
  applicationName: "NET",
  title: { default: "NET · Monitor mundial de lanzamientos", template: "%s · NET" },
  description:
    "Plataforma que centraliza la actividad mundial de lanzamientos espaciales: próximos lanzamientos, mapa de bases, organizaciones, histórico y estadísticas con datos públicos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_PREF }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
