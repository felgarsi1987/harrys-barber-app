/**
 * Post-procesa dist/index.html para agregar los meta tags de PWA necesarios
 * en iOS Safari (apple-touch-icon, apple-mobile-web-app-capable, etc.)
 * y vincula el manifest.json.
 * Ejecutar después de: expo export --platform web
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const indexPath = join(dist, "index.html");

// ── 1. Copiar ícono de la app como apple-touch-icon ──────────────────────────
const iconSrc = join(root, "assets", "icon.png");
const iconDst = join(dist, "apple-touch-icon.png");
if (existsSync(iconSrc)) copyFileSync(iconSrc, iconDst);

// ── 2. Escribir manifest.json ─────────────────────────────────────────────────
const manifest = {
  name: "Harry's Barber Shop",
  short_name: "Harry's",
  description: "Gestión integral para Harry's Barber Shop",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  theme_color: "#F2B90C",
  background_color: "#0D0D0D",
  lang: "es",
  icons: [
    { src: "/apple-touch-icon.png", sizes: "1024x1024", type: "image/png", purpose: "any maskable" },
    { src: "/favicon.ico",           sizes: "48x48",     type: "image/x-icon" },
  ],
};
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));

// ── 3. Inyectar meta tags de PWA en index.html ────────────────────────────────
let html = readFileSync(indexPath, "utf8");

const pwaTags = `
  <link rel="manifest" href="/manifest.json">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Harry's Barber">
  <meta name="mobile-web-app-capable" content="yes">`;

// Insertar justo antes de </head>
html = html.replace("</head>", `${pwaTags}\n</head>`);

writeFileSync(indexPath, html);

console.log("✅ PWA: manifest.json, apple-touch-icon y meta tags inyectados en dist/index.html");
