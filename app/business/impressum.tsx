import { LegalPage, type LegalSection } from "@/components/legal-page";
import { ADDRESS, COMPANY_NAME, COMPANY_SUBTITLE, TEAM } from "@/constants/company";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Impressum nach § 5 ECG und § 25 MedienG. Die Angaben beziehen sich auf
 * das Diplomarbeitsprojekt — es steht keine gewerbliche Tätigkeit dahinter,
 * deshalb gibt es weder UID-Nummer noch Firmenbucheintrag.
 */
export default function ImpressumScreen() {
  const { t } = useTranslation();

  const sections: LegalSection[] = [
    {
      heading: "Medieninhaber, Herausgeber und Diensteanbieter",
      lines: [COMPANY_NAME, COMPANY_SUBTITLE, ...ADDRESS, "Österreich"],
    },
    {
      heading: "Kontakt",
      lines: TEAM.flatMap((person) => [`${person.name} — ${person.tel}`, person.email]),
    },
    {
      heading: "Für den Inhalt verantwortlich",
      paragraphs: [
        `Für die Inhalte dieser Website sind ${TEAM.map((p) => p.name).join(", ")} gemeinsam verantwortlich.`,
      ],
    },
    {
      heading: "Unternehmensgegenstand",
      paragraphs: [
        "TRANSLOG PRO ist eine Diplomarbeit an der Bundeshandelsakademie Judenburg. Die Website und die Anwendung dienen der Ausbildung und der Vorstellung des Projekts.",
        "Es wird keine gewerbliche Tätigkeit ausgeübt. Daher bestehen weder eine Umsatzsteuer-Identifikationsnummer noch eine Eintragung im Firmenbuch, und es besteht keine Zugehörigkeit zu einer Kammer oder einer gesetzlichen Berufsvertretung.",
      ],
    },
    {
      heading: "Blattlinie (§ 25 Abs. 4 MedienG)",
      paragraphs: [
        "Information über das Diplomarbeitsprojekt TRANSLOG PRO: Ziele, Funktionsumfang und Entwicklungsstand einer Anwendung für Disposition und Auftragsverwaltung im Transportwesen.",
      ],
    },
    {
      heading: "Haftung für Inhalte",
      paragraphs: [
        "Die Inhalte dieser Website wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität wird jedoch keine Gewähr übernommen. Hinweise auf Fehler nehmen wir gerne über die oben genannten Kontaktdaten entgegen und bessern sie aus.",
      ],
    },
    {
      heading: "Haftung für Links",
      paragraphs: [
        "Diese Website kann Verweise auf fremde Websites enthalten, auf deren Inhalte wir keinen Einfluss haben. Für diese Inhalte ist ausschließlich die jeweilige Betreiberin oder der jeweilige Betreiber verantwortlich. Werden uns Rechtsverletzungen bekannt, entfernen wir den betreffenden Verweis.",
      ],
    },
    {
      heading: "Einsatz von KI-Werkzeugen",
      paragraphs: [
        "Bei der Entwicklung dieses Projekts wurden KI-gestützte Werkzeuge eingesetzt, insbesondere für Teile des Quellcodes, der Gestaltung und der Texte dieser Website.",
        "Alle Ergebnisse wurden vom Projektteam geprüft und werden von ihm verantwortet. Die Anwendung selbst verarbeitet keine Daten mit KI-Systemen.",
      ],
    },
    {
      heading: "Urheberrecht",
      paragraphs: [
        "Die von uns erstellten Inhalte und Werke auf dieser Website unterliegen dem österreichischen Urheberrecht. Eine Verwendung außerhalb der Grenzen des Urheberrechts bedarf unserer vorherigen schriftlichen Zustimmung.",
        "Genannte Firmennamen, Marken und Logos Dritter gehören den jeweiligen Inhaberinnen und Inhabern.",
      ],
    },
  ];

  return (
    <LegalPage
      metaTitle={t("seo", "imprintTitle")}
      metaDescription={t("seo", "imprintDescription")}
      title={t("legal", "imprintTitle")}
      sections={sections}
    />
  );
}
