import { defineToolPack, defineTool } from "@tracht-digital-solutions/tds-tools-contract";

/**
 * Büro: three premium tools for the paperwork a small business actually has —
 * label sheets, a monthly timesheet, and text recognition for scanned documents.
 *
 * All three run entirely in the visitor's browser. That matters most for the OCR
 * tool, whose input is by definition a scanned document; its engine and language
 * data are served from the tools site itself rather than a third-party CDN, so
 * opening the tool contacts nobody.
 */
export default defineToolPack({
  id: "office",
  name: "Büro",
  version: "0.1.0",
  tools: [
    defineTool({
      id: "etiketten-drucken",
      slug: "etiketten-drucken",
      name: "Etiketten drucken",
      category: "business",
      description:
        "Adressaufkleber und Etiketten als druckfertiges PDF: gängige Bogenraster, eine Zeile je Etikett, wahlweise dieselbe Angabe auf allen Feldern.",
      icon: "tags",
      keywords: ["etiketten", "aufkleber", "adressen", "avery", "herma", "drucken"],
      component: "@tracht-digital-solutions/tds-tool-office/tools/LabelSheet.astro",
      premiumDefault: true,
      priceCentsDefault: 500,
      seo: {
        title: "Etiketten drucken — Adressaufkleber als PDF",
        description:
          "Etikettenbogen selbst erzeugen: Raster wählen, Adressen einfügen, PDF drucken. Passt auf gängige Bogen und läuft ohne Installation im Browser.",
      },
    }),
    defineTool({
      id: "stundenzettel",
      slug: "stundenzettel",
      name: "Stundenzettel",
      category: "business",
      description:
        "Arbeitszeitnachweis für einen Monat als PDF: Tage, Kommen und Gehen, Pause, Tages- und Monatssumme, Feld für beide Unterschriften.",
      icon: "clock",
      keywords: ["stundenzettel", "arbeitszeit", "nachweis", "zeiterfassung", "monat"],
      component: "@tracht-digital-solutions/tds-tool-office/tools/Timesheet.astro",
      premiumDefault: true,
      priceCentsDefault: 500,
      seo: {
        title: "Stundenzettel erstellen — Arbeitszeitnachweis",
        description:
          "Monatlichen Stundenzettel als PDF erstellen: Zeiten eintragen, Pausen abziehen, Summen werden gerechnet. Zum Ausdrucken und Unterschreiben.",
      },
    }),
    defineTool({
      id: "texterkennung",
      slug: "texterkennung",
      name: "Texterkennung (OCR)",
      category: "content",
      description:
        "Text aus Fotos, Screenshots und eingescannten Bildern herauslesen, auf Deutsch oder Englisch — zum Kopieren und Weiterverarbeiten.",
      icon: "scan-text",
      keywords: ["ocr", "texterkennung", "scan", "foto", "abtippen", "erkennen"],
      component: "@tracht-digital-solutions/tds-tool-office/tools/TextRecognition.astro",
      premiumDefault: true,
      priceCentsDefault: 500,
      seo: {
        title: "Texterkennung (OCR) — Text aus Bild auslesen",
        description:
          "Abgetippt wird nichts mehr: Texterkennung für Fotos und Bildscans, deutsch und englisch. Die Erkennung läuft auf Ihrem Gerät, das Bild bleibt dort.",
      },
    }),
  ],
  i18n: {
    de: {
      "office.labels": "Etiketten drucken",
      "office.timesheet": "Stundenzettel",
      "office.ocr": "Texterkennung (OCR)",
    },
    en: {
      "office.labels": "Print Labels",
      "office.timesheet": "Timesheet",
      "office.ocr": "Text Recognition (OCR)",
    },
  },
});
