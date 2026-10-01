import { LegalPage, type LegalSection } from "@/components/legal-page";
import { ADDRESS, COMPANY_NAME, COMPANY_SUBTITLE, TEAM } from "@/constants/company";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Datenschutzerklärung nach DSGVO. Beschrieben ist, was die Anwendung
 * tatsächlich verarbeitet: Konten und Rollen, Auftrags- und Fahrzeugdaten,
 * hochgeladene Dokumente sowie die lokale Speicherung der Einstellungen.
 * Es gibt keine Analyse- oder Werbedienste und keinen E-Mail-Versand.
 */
export default function DatenschutzScreen() {
  const { t } = useTranslation();

  const sections: LegalSection[] = [
    {
      heading: "1. Verantwortlicher",
      lines: [
        COMPANY_NAME,
        COMPANY_SUBTITLE,
        ...ADDRESS,
        "Österreich",
        TEAM.map((p) => p.email).join(" · "),
      ],
    },
    {
      heading: "2. Überblick",
      paragraphs: [
        "Diese Website besteht aus zwei Bereichen: den öffentlich zugänglichen Seiten (Startseite, Über uns, Ziele, Kontakt, Impressum, Datenschutz) und einem geschlossenen Bereich, den nur angemeldete Benutzerinnen und Benutzer sehen.",
        "Auf den öffentlichen Seiten werden keine Konten benötigt und keine Daten von Ihnen abgefragt. Personenbezogene Daten in nennenswertem Umfang entstehen erst im angemeldeten Bereich.",
      ],
    },
    {
      heading: "3. Aufruf der Website (Server-Logdateien)",
      paragraphs: [
        "Beim Aufruf der Website übermittelt Ihr Browser technisch notwendige Daten an unseren Hostingdienstleister. Dazu zählen IP-Adresse, Datum und Uhrzeit des Zugriffs, die aufgerufene Adresse sowie Angaben zu Browser und Betriebssystem.",
        "Zweck ist die Auslieferung der Seite, die Stabilität und die Abwehr von Angriffen. Rechtsgrundlage ist unser berechtigtes Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). Diese Daten werden nicht mit anderen Daten zusammengeführt und nach kurzer Zeit automatisch gelöscht.",
      ],
    },
    {
      heading: "4. Speicherung auf Ihrem Gerät",
      paragraphs: [
        "Wir setzen keine Cookies zu Werbe- oder Analysezwecken ein und binden keine Analyse-Werkzeuge, Social-Media-Plugins oder externen Schriftarten ein.",
        "Für den Betrieb speichert die Anwendung einige Angaben lokal in Ihrem Browser beziehungsweise auf Ihrem Gerät:",
      ],
      bullets: [
        "Ihre Einstellungen: Design (hell, dunkel, System), Sprache und ob Benachrichtigungen aktiv sind",
        "Ihre Anmeldung, damit Sie sich nicht bei jedem Start neu anmelden müssen",
      ],
    },
    {
      heading: "5. Benutzerkonto und Anmeldung",
      paragraphs: [
        "Konten werden nicht selbst angelegt, sondern vom Unternehmen vergeben. Verarbeitet werden dabei Benutzername, eine daraus intern abgeleitete Kennung, das Passwort ausschließlich als nicht rückrechenbarer Hashwert sowie die Rolle (Disposition, Fahrer oder zeitlich begrenzter Zugang für fremde Fahrer).",
        "Zweck ist die Anmeldung und die Steuerung, wer welche Daten sehen darf. Rechtsgrundlage ist die Erfüllung des Nutzungsverhältnisses (Art. 6 Abs. 1 lit. b DSGVO) sowie unser berechtigtes Interesse an einem geschützten Zugang (Art. 6 Abs. 1 lit. f DSGVO).",
      ],
    },
    {
      heading: "6. Daten im angemeldeten Bereich",
      paragraphs: [
        "Im geschlossenen Bereich werden die Daten des Transportbetriebs verarbeitet. Dazu gehören insbesondere:",
      ],
      bullets: [
        "Aufträge: Lade- und Entladestelle, Firmen und Anschriften, Termine und Zeitfenster, Lademeter, Ladungsart und Status",
        "Zuteilung von Aufträgen an Fahrerinnen und Fahrer sowie deren Erledigungsvermerke",
        "Fahrzeugdaten: Kennzeichen, Marke, Baujahr, Kilometerstände und Serviceintervalle",
        "Tankeinträge: Datum, Kennzeichen, Liter, Preise und Tankstelle",
        "Rechnungen und Umsatzlisten einschließlich der zugehörigen Beträge",
        "Hochgeladene Dokumente zu einem Auftrag, etwa Frachtbriefe (CMR)",
      ],
    },
    {
      heading: "7. Hinweis zu Beschäftigtendaten",
      paragraphs: [
        "Soweit die Anwendung im laufenden Betrieb eines Unternehmens eingesetzt wird, verarbeitet dieses Unternehmen die Daten seiner Beschäftigten in eigener Verantwortung. Wir stellen in diesem Fall nur die Software bereit. Die Daten werden ausschließlich für die Abwicklung der Transporte verwendet, nicht zur Verhaltens- oder Leistungskontrolle.",
      ],
    },
    {
      heading: "8. Empfänger und Dienstleister",
      paragraphs: [
        "Wir geben Daten nicht zu Werbezwecken weiter und verkaufen keine Daten. Für den technischen Betrieb setzen wir folgende Dienstleister als Auftragsverarbeiter ein:",
      ],
      bullets: [
        "Supabase (Datenbank, Anmeldung, Dateispeicher und Serverfunktionen). Die Daten liegen in einem Rechenzentrum innerhalb der Europäischen Union.",
        "Vercel (Auslieferung der Website). Die Auslieferung erfolgt über Server in der Europäischen Union. Da die Muttergesellschaft ihren Sitz in den USA hat, ist ein Zugriff aus einem Drittland nicht völlig auszuschließen; abgesichert wird dies über die Standardvertragsklauseln der EU-Kommission.",
      ],
    },
    {
      heading: "9. Speicherdauer",
      paragraphs: [
        "Wir speichern personenbezogene Daten nur so lange, wie es für den jeweiligen Zweck erforderlich ist. Konten werden gelöscht, sobald der Zugang nicht mehr benötigt wird; Zugänge für fremde Fahrer laufen automatisch ab.",
        "Daten, die der gesetzlichen Aufbewahrungspflicht unterliegen (insbesondere Rechnungen nach § 132 BAO), bewahren wir für die vorgeschriebene Dauer von sieben Jahren auf und löschen sie danach.",
      ],
    },
    {
      heading: "10. Ihre Rechte",
      paragraphs: ["Ihnen stehen gegenüber uns folgende Rechte zu:"],
      bullets: [
        "Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)",
        "Berichtigung unrichtiger Daten (Art. 16 DSGVO)",
        "Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)",
        "Datenübertragbarkeit (Art. 20 DSGVO)",
        "Widerspruch gegen eine Verarbeitung auf Grundlage berechtigter Interessen (Art. 21 DSGVO)",
      ],
    },
    {
      heading: "11. Beschwerderecht",
      paragraphs: [
        "Wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer Daten gegen das Datenschutzrecht verstößt, können Sie sich bei der Aufsichtsbehörde beschweren:",
      ],
      lines: [
        "Österreichische Datenschutzbehörde",
        "Barichgasse 40-42, 1030 Wien",
        "dsb@dsb.gv.at · www.dsb.gv.at",
      ],
    },
    {
      heading: "12. Keine automatisierte Entscheidungsfindung",
      paragraphs: [
        "Eine automatisierte Entscheidungsfindung einschließlich Profiling im Sinne des Art. 22 DSGVO findet nicht statt.",
      ],
    },
  ];

  return (
    <LegalPage
      metaTitle={t("seo", "privacyTitle")}
      metaDescription={t("seo", "privacyDescription")}
      title={t("legal", "privacyTitle")}
      intro={t("legal", "privacyIntro")}
      sections={sections}
    />
  );
}
