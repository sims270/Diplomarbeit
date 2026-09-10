import Head from "expo-router/head";

type PageMetaProps = {
  /** Seitentitel; der Sitename wird angehängt, falls er nicht schon vorkommt. */
  title: string;
  description: string;
};

const SITE_NAME = "TRANSLOG PRO";

/**
 * Setzt Titel und Beschreibung einer einzelnen Seite. Die Werte landen beim
 * statischen Web-Export im `<head>` der jeweiligen HTML-Datei und überschreiben
 * die Standardwerte aus `app/+html.tsx`.
 */
export function PageMeta({ title, description }: PageMetaProps) {
  const fullTitle = title.startsWith(SITE_NAME)
    ? title
    : `${title} — ${SITE_NAME}`;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
}
