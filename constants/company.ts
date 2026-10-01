/**
 * Stammdaten des Projektteams. Bewusst nicht in den Übersetzungen: Namen,
 * Anschrift und Telefonnummern sind in jeder Sprache gleich. Kontaktseite
 * und Impressum lesen aus derselben Quelle, damit sie nie auseinanderlaufen.
 */
export const COMPANY_NAME = "LSC - ITSolutions";

export const COMPANY_SUBTITLE = "Projektteam der HAK Judenburg";

export const ADDRESS = ["Bundesstraße 24a", "A-8770 Stadlhof (Stmk)"];

export interface TeamMember {
  name: string;
  tel: string;
  email: string;
}

export const TEAM: TeamMember[] = [
  { name: "Simon Reiter", tel: "+43 670 201 51 35", email: "simon.reiter@hakju.at" },
  { name: "Christian Hochreiter", tel: "+43 664 154 74 79", email: "christian.hochreiter@hakju.at" },
  { name: "Leon Wedam", tel: "+43 676 432 20 20", email: "leon.wedam@hakju.at" },
];

/** Leerzeichen und Trennzeichen raus — tel: verträgt nur die reine Nummer. */
export const toDialable = (number: string) => number.replace(/[^+\d]/g, "");

/** Letzte inhaltliche Änderung an Impressum und Datenschutzerklärung. */
export const LEGAL_LAST_UPDATED = "Oktober 2026";
