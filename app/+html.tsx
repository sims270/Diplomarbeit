import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const SITE_NAME = "TRANSLOG PRO";
const TITLE = "TRANSLOG PRO — Logistik- und Transportmanagement";
const DESCRIPTION =
  "TRANSLOG PRO ist eine Plattform für Disposition und Auftragsverwaltung im Transportwesen: Aufträge zuweisen, Fahrer koordinieren und Transportdokumente erzeugen.";
const OG_IMAGE = "/og-image.jpg";

// Web-Grundstyles für ein natives Apple-Gefühl: Systemschrift, weiche
// Kantenglättung, kein grauer Tap-Blitz auf Mobilgeräten, kein
// automatisches Hochskalieren von Text beim Drehen.
const webBaseStyles = `
html, body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
  background-color: #F2F2F2;
}
@media (prefers-color-scheme: dark) {
  html, body { background-color: #000000; }
}
* { -webkit-tap-highlight-color: transparent; }
input, textarea, select, button { font-family: inherit; }
:focus-visible { outline: 2px solid #9b2321; outline-offset: 2px; }
`;

/**
 * Umschließt jede statisch exportierte Seite (`web.output: "static"`).
 * Hier stehen nur die seitenweiten Standardwerte — Titel und Beschreibung
 * der einzelnen öffentlichen Seiten setzt `components/page-meta.tsx`.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta name="author" content="LSC ITSolutions, HAK Judenburg" />
        <meta name="robots" content="index, follow" />
        <meta name="theme-color" content="#9b2321" />

        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="de_AT" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webBaseStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
