import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const SITE_NAME = "TRANSLOG PRO";
const TITLE = "TRANSLOG PRO — Logistik- und Transportmanagement";
const DESCRIPTION =
  "TRANSLOG PRO ist eine Plattform für Disposition und Auftragsverwaltung im Transportwesen: Aufträge zuweisen, Fahrer koordinieren und Transportdokumente erzeugen.";
const OG_IMAGE = "/og-image.jpg";

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
      </head>
      <body>{children}</body>
    </html>
  );
}
