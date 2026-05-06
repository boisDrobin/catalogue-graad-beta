let formations = [];
let filteredFormations = [];
let activePublicFamily = "medecins";
let activeSpecialty = "";

const CSV_PATH = "./data/data.csv";
const CSV_IMPORT_DATE = "2026-05-04";

const multiFilterState = {
  format: [],
  "type-action": [],
  financement: []
};

/* ----------------------------- */
/* UTILITAIRES */
/* ----------------------------- */

function normalize(value) {
  return String(value ?? "").trim();
}

function cleanText(value) {
  return normalize(value)
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSearch(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitPublics(value) {
  return cleanText(value)
    .split(";")
    .map(item => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getField(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && cleanText(row[key]) !== "") {
      return cleanText(row[key]);
    }
  }

  return "";
}

function getFirstNonEmptyValue(rows, keys) {
  for (const row of rows) {
    const value = getField(row, keys);
    if (hasValue(value)) return value;
  }

  return "";
}

function getBestGroupValue(visibleRows, allRows, keys) {
  return getFirstNonEmptyValue(visibleRows, keys) || getFirstNonEmptyValue(allRows, keys);
}

function hasValue(value) {
  return cleanText(value) !== "";
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function stripBracketPrefix(title) {
  return cleanText(title).replace(/^\s*\[[^\]]+\]\s*/g, "").trim();
}

function formatMoney(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  const number = Number(raw.replace(",", "."));
  if (Number.isNaN(number)) return raw;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: Number.isInteger(number) ? 0 : 2
  }).format(number);
}

function formatNumber(value) {
  const raw = cleanText(value);
  if (!raw) return "0";

  const number = Number(raw.replace(",", "."));
  if (Number.isNaN(number)) return raw;

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: Number.isInteger(number) ? 0 : 2
  }).format(number);
}

function formatHours(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  if (raw.toLowerCase().includes("h") || raw.toLowerCase().includes("heure")) {
    return raw;
  }

  const number = Number(raw.replace(",", "."));
  if (Number.isNaN(number)) return raw;

  const label = number > 1 ? "heures" : "heure";
  return `${String(number).replace(".", ",")} ${label}`;
}

function normalizeStatus(value) {
  const status = cleanSearch(value);

  if (status === "fermee" || status === "ferme") return "fermée";
  if (status === "complete" || status === "complet" || status === "completee") return "complète";
  if (status === "ouverte" || status === "ouvert") return "ouverte";

  return status;
}

function shouldKeepSession(row) {
  const status = normalizeStatus(getField(row, ["Etat de la session"]));
  return status === "ouverte" || status === "complète";
}

function getShortSessionName(sessionName) {
  const raw = cleanText(sessionName);
  if (!raw) return "";

  const parts = raw.split("-");
  if (parts.length <= 1) return raw;

  return parts[parts.length - 1].trim();
}

/* ----------------------------- */
/* FINANCEMENT */
/* ----------------------------- */

function getFinancementShortLabel(value) {
  const normalized = cleanSearch(value);

  if (normalized.includes("fifpl")) return "FIFPL";
  if (normalized.includes("dpc")) return "DPC";

  return cleanText(value);
}

function getFinancementBadgeClass(value) {
  const shortLabel = getFinancementShortLabel(value);

  if (shortLabel === "FIFPL") return "badge-financement-fifpl";
  if (shortLabel === "DPC") return "badge-financement-dpc";

  return "badge-financement-default";
}

/* ----------------------------- */
/* ICÔNES INFO-GRID */
/* ----------------------------- */

function getInfoIcon(label) {
  const icons = {
    "Numéro de dépôt": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 7h11"></path>
        <path d="M9 12h11"></path>
        <path d="M9 17h11"></path>
        <path d="M4 7h.01"></path>
        <path d="M4 12h.01"></path>
        <path d="M4 17h.01"></path>
      </svg>
    `,
    "Public / Spécialité": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
    `,
    "Format": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="14" rx="2"></rect>
        <path d="M8 20h8"></path>
        <path d="M12 18v2"></path>
      </svg>
    `,
    "Typologie": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 6h16"></path>
        <path d="M4 12h10"></path>
        <path d="M4 18h7"></path>
      </svg>
    `,
    "Type d’EPP": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"></path>
        <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"></path>
      </svg>
    `,
    "Durée totale": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M12 7v5l3 3"></path>
      </svg>
    `,
    "Formateur(s)": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 10v6"></path>
        <path d="M2 10v6"></path>
        <path d="M12 3 2 8l10 5 10-5-10-5Z"></path>
        <path d="M6 10.8V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.2"></path>
      </svg>
    `,
    "Prise en charge": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1v22"></path>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H15a3.5 3.5 0 0 1 0 7H6"></path>
      </svg>
    `,
    "Indemnités PS": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <circle cx="12" cy="12" r="2.5"></circle>
        <path d="M6 12h.01"></path>
        <path d="M18 12h.01"></path>
      </svg>
    `,
    "Financement": `
      <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <path d="M2 10h20"></path>
        <path d="M7 15h.01"></path>
        <path d="M11 15h4"></path>
      </svg>
    `
  };

  return icons[label] || `
    <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M12 8h.01"></path>
      <path d="M11 12h1v4h1"></path>
    </svg>
  `;
}

/* ----------------------------- */
/* DATES */
/* ----------------------------- */

function parseDate(value) {
  const raw = cleanText(value);
  if (!raw) return null;

  const normalized = raw.includes(" ") && !raw.includes("T")
    ? raw.replace(" ", "T")
    : raw;

  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) return date;

  const frMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (frMatch) {
    const [, d, m, y, hh = "00", mm = "00"] = frMatch;
    const parsed = new Date(
      `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${hh.padStart(2, "0")}:${mm}:00`
    );

    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function formatDateFr(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatDateShort(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatTimeFr(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateTimeFr(value) {
  const date = parseDate(value);
  if (!date) return cleanText(value);

  return `${formatDateFr(date)} à ${formatTimeFr(date)}`;
}

/* ----------------------------- */
/* PUBLICS */
/* ----------------------------- */

function getPublicFamily(rawPublic) {
  const normalized = cleanSearch(rawPublic);

  const medecinsKeywords = [
    "allergologie",
    "allergologue",
    "generaliste",
    "generalistes",
    "medecine generale",
    "cardiologie",
    "cardiologue",
    "cardiologues",
    "medecine cardiovasculaire",
    "gynecologie",
    "gynecologue",
    "gynecologues",
    "gynecologie medicale",
    "gynecologie obstetrique",
    "ophtalmologie",
    "ophtalmologue",
    "ophtalmologues",
    "pediatrie",
    "pediatre",
    "pediatres",
    "dermatologie",
    "dermatologie et venereologie",
    "dermatologue",
    "dermatologues",
    "dermatologue et venerologue",
    "dermatologues et venerologues",
    "anesthesie reanimation",
    "anesthesiste",
    "anesthesistes",
    "anesthesiste reanimateur",
    "anesthesiste reanimateurs",
    "immunologie",
    "immunologue",
    "immunologues",
    "medecine interne",
    "medecin interne",
    "medecins internes",
    "medecine interne et immunologie clinique",
    "endocrinologie",
    "endocrinologie diabetologie nutrition",
    "endocrinologue",
    "endocrinologues",
    "endocrinologue, diabetologue et metaboliste",
    "endocrinologues, diabetologues et metabolistes",
    "oncologie",
    "oncologue",
    "oncologues",
    "psychiatrie",
    "psychiatre",
    "psychiatres",
    "hepato gastro enterologie",
    "hepato gastro enterologue",
    "hepato gastro enterologues",
    "geriatrie",
    "geriatrie gerontologie",
    "geriatre",
    "geriatres",
    "geriatre, gerontologue",
    "geriatres, gerontologues",
    "maladies infectieuses et tropicales",
    "maladie infectieuse et tropicale",
    "medecine d'urgence",
    "medecine d urgence",
    "urgentiste",
    "urgentistes",
    "medecine physique et de readaptation",
    "medecin physique et de readaptation",
    "medecins physiques et de readaptation",
    "medecine vasculaire",
    "medecin vasculaire",
    "medecins vasculaires",
    "neurologie",
    "neurologue",
    "neurologues",
    "nephrologie",
    "nephrologue",
    "nephrologues",
    "pneumologie",
    "pneumologue",
    "pneumologues",
    "radiologie",
    "radiologue",
    "radiologues",
    "radiologie et imagerie medicale",
    "rhumatologie",
    "rhumatologue",
    "rhumatologues"
  ];

  if (medecinsKeywords.includes(normalized)) return "medecins";

  if (
    normalized.includes("infirmier") ||
    normalized.includes("infirmiere") ||
    normalized.includes("ide")
  ) {
    return "infirmiers";
  }

  if (normalized.includes("pharmacien")) return "pharmaciens";

  if (
    normalized.includes("sage femme") ||
    normalized.includes("sage-femme") ||
    normalized.includes("sages femmes") ||
    normalized.includes("sages-femmes")
  ) {
    return "sages-femmes";
  }

  if (
    normalized.includes("kinesitherapeute") ||
    normalized.includes("kine")
  ) {
    return "kines";
  }

  if (
    normalized.includes("chirurgie dentaire") ||
    normalized.includes("chirurgien dentiste") ||
    normalized.includes("dentiste")
  ) {
    return "dentistes";
  }

  return "";
}

function getMedicalSpecialtyLabel(rawPublic) {
  const normalized = cleanSearch(rawPublic);

  const map = {
    "allergologie": "Médecin - Allergologie",
    "allergologue": "Médecin - Allergologie",
    "generaliste": "Médecin - Généraliste",
    "generalistes": "Médecin - Généraliste",
    "medecine generale": "Médecin - Médecine générale",
    "cardiologie": "Médecin - Cardiologie",
    "cardiologue": "Médecin - Cardiologie",
    "cardiologues": "Médecin - Cardiologie",
    "medecine cardiovasculaire": "Médecin - Médecine cardiovasculaire",
    "gynecologie": "Médecin - Gynécologie",
    "gynecologue": "Médecin - Gynécologie",
    "gynecologues": "Médecin - Gynécologie",
    "gynecologie medicale": "Médecin - Gynécologie",
    "gynecologie obstetrique": "Médecin - Gynécologie",
    "ophtalmologie": "Médecin - Ophtalmologie",
    "ophtalmologue": "Médecin - Ophtalmologie",
    "ophtalmologues": "Médecin - Ophtalmologie",
    "pediatrie": "Médecin - Pédiatrie",
    "pediatre": "Médecin - Pédiatrie",
    "pediatres": "Médecin - Pédiatrie",
    "dermatologie": "Médecin - Dermatologie",
    "dermatologie et venereologie": "Médecin - Dermatologie et vénéréologie",
    "dermatologue": "Médecin - Dermatologie",
    "dermatologues": "Médecin - Dermatologie",
    "dermatologue et venerologue": "Médecin - Dermatologie et vénéréologie",
    "dermatologues et venerologues": "Médecin - Dermatologie et vénéréologie",
    "anesthesie reanimation": "Médecin - Anesthésie-réanimation",
    "anesthesiste": "Médecin - Anesthésie-réanimation",
    "anesthesistes": "Médecin - Anesthésie-réanimation",
    "anesthesiste reanimateur": "Médecin - Anesthésie-réanimation",
    "anesthesiste reanimateurs": "Médecin - Anesthésie-réanimation",
    "immunologie": "Médecin - Immunologie",
    "medecine interne": "Médecin - Médecine interne",
    "medecin interne": "Médecin - Médecine interne",
    "medecins internes": "Médecin - Médecine interne",
    "medecine interne et immunologie clinique": "Médecin - Médecine interne et immunologie clinique",
    "endocrinologie": "Médecin - Endocrinologie",
    "endocrinologie diabetologie nutrition": "Médecin - Endocrinologie-diabétologie-nutrition",
    "endocrinologue": "Médecin - Endocrinologie-diabétologie-nutrition",
    "endocrinologues": "Médecin - Endocrinologie-diabétologie-nutrition",
    "endocrinologue, diabetologue et metaboliste": "Médecin - Endocrinologie-diabétologie-nutrition",
    "endocrinologues, diabetologues et metabolistes": "Médecin - Endocrinologie-diabétologie-nutrition",
    "oncologie": "Médecin - Oncologie",
    "oncologue": "Médecin - Oncologie",
    "oncologues": "Médecin - Oncologie",
    "psychiatrie": "Médecin - Psychiatrie",
    "psychiatre": "Médecin - Psychiatrie",
    "psychiatres": "Médecin - Psychiatrie",
    "hepato gastro enterologie": "Médecin - Hépato-gastro-entérologie",
    "hepato gastro enterologue": "Médecin - Hépato-gastro-entérologie",
    "hepato gastro enterologues": "Médecin - Hépato-gastro-entérologie",
    "geriatrie": "Médecin - Gériatrie",
    "geriatrie gerontologie": "Médecin - Gériatrie / Gérontologie",
    "geriatre": "Médecin - Gériatrie / Gérontologie",
    "geriatres": "Médecin - Gériatrie / Gérontologie",
    "geriatre, gerontologue": "Médecin - Gériatrie / Gérontologie",
    "geriatres, gerontologues": "Médecin - Gériatrie / Gérontologie",
    "maladies infectieuses et tropicales": "Médecin - Maladies infectieuses et tropicales",
    "maladie infectieuse et tropicale": "Médecin - Maladies infectieuses et tropicales",
    "medecine d'urgence": "Médecin - Médecine d'urgence",
    "medecine d urgence": "Médecin - Médecine d'urgence",
    "urgentiste": "Médecin - Médecine d'urgence",
    "urgentistes": "Médecin - Médecine d'urgence",
    "medecine physique et de readaptation": "Médecin - Médecine physique et de réadaptation",
    "medecin physique et de readaptation": "Médecin - Médecine physique et de réadaptation",
    "medecins physiques et de readaptation": "Médecin - Médecine physique et de réadaptation",
    "medecine vasculaire": "Médecin - Médecine vasculaire",
    "medecin vasculaire": "Médecin - Médecine vasculaire",
    "medecins vasculaires": "Médecin - Médecine vasculaire",
    "neurologie": "Médecin - Neurologie",
    "neurologue": "Médecin - Neurologie",
    "neurologues": "Médecin - Neurologie",
    "nephrologie": "Médecin - Néphrologie",
    "nephrologue": "Médecin - Néphrologie",
    "nephrologues": "Médecin - Néphrologie",
    "pneumologie": "Médecin - Pneumologie",
    "pneumologue": "Médecin - Pneumologie",
    "pneumologues": "Médecin - Pneumologie",
    "radiologie": "Médecin - Radiologie et imagerie médicale",
    "radiologue": "Médecin - Radiologie et imagerie médicale",
    "radiologues": "Médecin - Radiologie et imagerie médicale",
    "radiologie et imagerie medicale": "Médecin - Radiologie et imagerie médicale",
    "rhumatologie": "Médecin - Rhumatologie",
    "rhumatologue": "Médecin - Rhumatologie",
    "rhumatologues": "Médecin - Rhumatologie"
  };

  return map[normalized] || "";
}

function getPublicLabel(publicSpecialite) {
  const medical = getMedicalSpecialtyLabel(publicSpecialite);
  return medical || publicSpecialite || "Public non renseigné";
}

function getPublicsForFormation(formation) {
  return splitPublics(formation.publicSpecialite);
}

function getPublicBadgeLabel(formation) {
  const publics = getPublicsForFormation(formation);

  if (publics.length > 1) return "Public Mixte";

  return getPublicLabel(publics[0] || formation.publicSpecialite);
}

function getPublicFamiliesForFormation(formation) {
  return uniqueValues(
    getPublicsForFormation(formation)
      .map(getPublicFamily)
      .filter(Boolean)
  );
}

function getMedicalSpecialtiesForFormation(formation) {
  return uniqueValues(
    getPublicsForFormation(formation)
      .map(getMedicalSpecialtyLabel)
      .filter(Boolean)
  );
}

function getPublicBadgeClass(formation) {
  const publicLabel = getPublicBadgeLabel(formation);
  const normalizedLabel = cleanSearch(publicLabel);
  const families = getPublicFamiliesForFormation(formation);

  if (normalizedLabel === "public mixte") return "badge-public-mixte";
  if (normalizedLabel === "public non renseigne") return "badge-public-empty";

  if (families.includes("medecins")) return "badge-public-medecins";
  if (families.includes("infirmiers")) return "badge-public-infirmiers";
  if (families.includes("pharmaciens")) return "badge-public-pharmaciens";
  if (families.includes("sages-femmes")) return "badge-public-sages-femmes";
  if (families.includes("kines")) return "badge-public-kines";
  if (families.includes("dentistes")) return "badge-public-dentistes";

  return "badge-public-empty";
}

function getPublicFamilyBadgeClass(value) {
  const map = {
    medecins: "badge-public-medecins",
    infirmiers: "badge-public-infirmiers",
    pharmaciens: "badge-public-pharmaciens",
    "sages-femmes": "badge-public-sages-femmes",
    kines: "badge-public-kines",
    dentistes: "badge-public-dentistes"
  };

  return map[value] || "badge-public-empty";
}

/* ----------------------------- */
/* FORMAT / TYPE D'ACTION / BADGES */
/* ----------------------------- */

function formatLabel(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  const normalized = cleanSearch(raw);

  const map = {
    "non presentiel": "E-learning",
    "e learning": "E-learning",
    "elearning": "E-learning",
    "classe virtuelle": "Classe virtuelle",
    "mixte presentiel": "Mixte présentiel",
    "mixte classe virtuelle": "Mixte classe virtuelle",
    "presentiel": "Présentiel",

    "formation continue": "Formation continue",
    "fc": "Formation continue",

    "programme integre": "Programme intégré",
    "pi": "Programme intégré",

    "evaluation des pratiques professionnelles": "Évaluation des Pratiques Professionnelles",
    "epp": "Évaluation des Pratiques Professionnelles",

    "audit clinique": "Audit clinique",
    "vignette clinique": "Vignette clinique",
    "vignettes cliniques": "Vignettes cliniques",
    "tcs": "TCS",

    "ouverte": "Ouverte",
    "complete": "Complète",
    "fermee": "Fermée"
  };

  return map[normalized] || raw;
}

function getTypeActionShortLabel(typeAction) {
  const normalized = cleanSearch(typeAction);

  if (normalized.includes("evaluation des pratiques professionnelles")) return "EPP";
  if (normalized.includes("formation continue")) return "FC";
  if (normalized.includes("programme integre")) return "PI";

  return "";
}

function getTypeActionFilterLabel(typeAction) {
  const normalized = cleanSearch(typeAction);

  if (normalized.includes("evaluation des pratiques professionnelles")) {
    return "Évaluation des Pratiques Professionnelles (EPP)";
  }

  if (normalized.includes("formation continue")) {
    return "Formation continue (FC)";
  }

  if (normalized.includes("programme integre")) {
    return "Programme intégré (PI)";
  }

  return typeAction;
}

function getTypeActionBadgeClass(typeAction) {
  const shortLabel = getTypeActionShortLabel(typeAction);

  if (shortLabel === "EPP") return "badge-type-epp";
  if (shortLabel === "FC") return "badge-type-fc";
  if (shortLabel === "PI") return "badge-type-pi";

  return "badge-type-default";
}

function getFormatClass(format) {
  const normalized = cleanSearch(format);

  if (normalized.includes("classe virtuelle") && normalized.includes("mixte")) {
    return "format-mixte-classe-virtuelle";
  }

  if (normalized.includes("classe virtuelle")) return "format-classe-virtuelle";
  if (normalized.includes("mixte presentiel")) return "format-mixte-presentiel";
  if (normalized.includes("presentiel")) return "format-presentiel";

  if (
    normalized.includes("non presentiel") ||
    normalized.includes("e learning") ||
    normalized.includes("elearning")
  ) {
    return "format-elearning";
  }

  return "format-default";
}

function getFormatBadgeClass(format) {
  return getFormatClass(format).replace("format-", "badge-format-");
}

function getStatusBadgeClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "complète") return "badge-status-full";
  if (normalized === "ouverte") return "badge-status-open";

  return "badge-session-count";
}

/* ----------------------------- */
/* CSV → FORMATIONS */
/* ----------------------------- */

function createSessionFromRow(row) {
  return {
    nomSession: getField(row, ["Nom de la session"]),
    etat: formatLabel(getField(row, ["Etat de la session"])),
    nombreInscrits: getField(row, ["Nombre d'inscrits"]),
    effectifMaximum: getField(row, ["Effectif maximum"]),
    intervenant1: getField(row, ["Intervenant 1"]),
    dateDebut: getField(row, ["Date de début"]),
    dateFin: getField(row, ["Date de fin"]),
    dateClasseVirtuelle: getField(row, ["Date classe virtuelle"]),
    datePremierJourPresentiel: getField(row, ["Date 1er jour présentiel"]),
    debutU1: getField(row, ["Début U1"]),
    finU1: getField(row, ["Fin U1"]),
    debutU2: getField(row, ["Début U2"]),
    finU2: getField(row, ["Fin U2"]),
    debutU3: getField(row, ["Début U3"]),
    finU3: getField(row, ["Fin U3"])
  };
}

function groupRawRowsByReferenceAction(rows) {
  const groupedRows = new Map();

  rows.forEach(row => {
    const referenceAction = getField(row, ["Référence d'action"]);
    if (!referenceAction) return;

    if (!groupedRows.has(referenceAction)) {
      groupedRows.set(referenceAction, []);
    }

    groupedRows.get(referenceAction).push(row);
  });

  return groupedRows;
}

function createFormationFromGroup(referenceAction, rows) {
  const visibleSessionRows = rows.filter(shouldKeepSession);

  if (!visibleSessionRows.length) return null;

  const sessions = visibleSessionRows
    .map(createSessionFromRow)
    .sort((a, b) => {
      const dateA = parseDate(a.dateClasseVirtuelle || a.datePremierJourPresentiel || a.dateDebut || a.debutU1 || "");
      const dateB = parseDate(b.dateClasseVirtuelle || b.datePremierJourPresentiel || b.dateDebut || b.debutU1 || "");

      if (!dateA && !dateB) return a.nomSession.localeCompare(b.nomSession, "fr");
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA - dateB;
    });

  const formateurs = uniqueValues(
    visibleSessionRows
      .map(row => getField(row, ["Intervenant 1"]))
      .filter(Boolean)
  );

  const categorieProduit = getBestGroupValue(visibleSessionRows, rows, [
    "Catégorie de Produit",
    "Catégorie produit",
    "Categorie de Produit",
    "Categorie produit"
  ]);

  return {
    referenceAction,

    titre: getBestGroupValue(visibleSessionRows, rows, [
      "Thématique session",
      "Titre",
      "Intitulé"
    ]),

    publicSpecialite: getBestGroupValue(visibleSessionRows, rows, [
      "Cible",
      "Public / Spécialité",
      "Public concerné"
    ]),

    format: formatLabel(getBestGroupValue(visibleSessionRows, rows, [
      "Format DPC",
      "Format"
    ])),

    typeAction: formatLabel(getBestGroupValue(visibleSessionRows, rows, [
      "Type d'action"
    ])),

    typologie: formatLabel(getBestGroupValue(visibleSessionRows, rows, [
      "Typologie"
    ])),

    categorieProduit,
    financement: getFinancementShortLabel(categorieProduit),

    dureeTotale: formatHours(getBestGroupValue(visibleSessionRows, rows, [
      "Durée totale",
      "Duree totale",
      "Nbre d'heures 1er jour présentiel"
    ])),

    numeroDepot: referenceAction,

    formateurs,

    priseEnCharge: formatMoney(getBestGroupValue(visibleSessionRows, rows, [
      "Prise en charge"
    ])),

    indemnitesPs: formatMoney(getBestGroupValue(visibleSessionRows, rows, [
      "Indemnité PS",
      "Indemnités PS"
    ])),

    contexte: getBestGroupValue(visibleSessionRows, rows, [
      "Contexte"
    ]),

    ficheMemoPdf: getBestGroupValue(visibleSessionRows, rows, [
      "Fiche memo",
      "Fiche mémo",
      "Fiche Mémo",
      "Fiche mémo PDF",
      "Fiche memo PDF",
      "Fiche mémo pdf",
      "Fiche memo pdf"
    ]),

    sessions
  };
}

function groupRowsByReferenceAction(rows) {
  const groupedRows = groupRawRowsByReferenceAction(rows);

  const grouped = Array.from(groupedRows.entries())
    .map(([referenceAction, groupRows]) => createFormationFromGroup(referenceAction, groupRows))
    .filter(Boolean);

  return grouped.sort((a, b) => {
    const titleA = stripBracketPrefix(a.titre);
    const titleB = stripBracketPrefix(b.titre);

    return titleA.localeCompare(titleB, "fr", { sensitivity: "base" });
  });
}

/* ----------------------------- */
/* RENDER HELPERS */
/* ----------------------------- */

function createInfoBlock(label, value) {
  if (!hasValue(value)) return "";

  return `
    <div class="info-block">
      <div class="info-icon" aria-hidden="true">
        ${getInfoIcon(label)}
      </div>

      <div class="info-content">
        <span class="info-label">${escapeHtml(label)}</span>
        <div class="info-value">${escapeHtml(value)}</div>
      </div>
    </div>
  `;
}

function createInfoBlockHtml(label, htmlValue) {
  if (!hasValue(htmlValue)) return "";

  return `
    <div class="info-block">
      <div class="info-icon" aria-hidden="true">
        ${getInfoIcon(label)}
      </div>

      <div class="info-content">
        <span class="info-label">${escapeHtml(label)}</span>
        <div class="info-value">${htmlValue}</div>
      </div>
    </div>
  `;
}

function createMemoInfoBlock(url) {
  if (!hasValue(url)) return "";

  return `
    <a
      class="info-block info-block-link memo-info-block"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <div class="info-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"></path>
          <path d="M14 3v6h6"></path>
          <path d="M9 15h6"></path>
          <path d="M9 11h3"></path>
        </svg>
      </div>

      <div class="info-content">
        <span class="info-label">Fiche mémo PDF</span>
        <div class="info-value">Voir la fiche</div>
      </div>
    </a>
  `;
}

function createPublicSpecialiteBlock(formation, index) {
  const publics = getPublicsForFormation(formation);

  if (!publics.length) {
    return createInfoBlock("Public / Spécialité", formation.publicSpecialite);
  }

  if (publics.length <= 2) {
    return createInfoBlock("Public / Spécialité", publics.join(" - "));
  }

  const visiblePublics = publics.slice(0, 2);
  const hiddenPublics = publics.slice(2);
  const targetId = `public-specialite-extra-${index}`;

  const htmlValue = `
    <span class="public-specialite-list">
      ${visiblePublics.map(escapeHtml).join(" - ")}
      <span id="${targetId}" class="public-specialite-extra" hidden>
        - ${hiddenPublics.map(escapeHtml).join(" - ")}
      </span>
    </span>

    <button
      type="button"
      class="inline-toggle"
      aria-expanded="false"
      data-target="${targetId}"
      data-more-label="Voir plus"
      data-less-label="Voir moins"
    >
      Voir plus
    </button>
  `;

  return createInfoBlockHtml("Public / Spécialité", htmlValue);
}

function createContextBlock(contexte) {
  if (!hasValue(contexte)) return "";

  return `
    <div class="section-block">
      <div class="section-inner">
        <span class="section-title">Contexte de la formation</span>
        <p class="context-text">${escapeHtml(contexte)}</p>
      </div>
    </div>
  `;
}

function createSessionField(label, value) {
  if (!hasValue(value)) return "";

  return `
    <div class="session-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function formatPeriod(start, end) {
  if (!hasValue(start) && !hasValue(end)) return "";

  const startLabel = formatDateShort(start) || start;
  const endLabel = formatDateShort(end) || end;

  if (startLabel && endLabel) return `${startLabel} → ${endLabel}`;
  return startLabel || endLabel;
}

function createSessionMetaBadge(label, value, className = "") {
  if (!hasValue(value)) return "";

  return `
    <span class="session-meta-badge ${className}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function createSessionCard(session) {
  const inscrits = hasValue(session.nombreInscrits)
    ? formatNumber(session.nombreInscrits)
    : "0";

  const effectif = hasValue(session.effectifMaximum)
    ? formatNumber(session.effectifMaximum)
    : "-";

  const sessionName = getShortSessionName(session.nomSession || "Session sans nom");
  const inscriptionLabel = `${inscrits} / ${effectif}`;
  const dateDebutLabel = formatDateShort(session.dateDebut) || session.dateDebut;
  const dateFinLabel = formatDateShort(session.dateFin) || session.dateFin;

  return `
    <article class="session-card">
      <div class="session-card-header">
        <div>
          <h4 class="session-name">${escapeHtml(sessionName || "Session sans nom")}</h4>
        </div>

        <div class="session-meta-row">
          ${session.etat ? `
            <span class="badge ${getStatusBadgeClass(session.etat)}">
              ${escapeHtml(session.etat)}
            </span>
          ` : ""}

          <span class="badge badge-session-count">
            ${escapeHtml(inscriptionLabel)}
          </span>

          ${createSessionMetaBadge("Début", dateDebutLabel, "session-date-badge")}
          ${createSessionMetaBadge("Fin", dateFinLabel, "session-date-badge")}
        </div>
      </div>

      <div class="session-grid">
        ${createSessionField("Intervenant", session.intervenant1)}
        ${createSessionField("Classe virtuelle", formatDateTimeFr(session.dateClasseVirtuelle))}
        ${createSessionField("1er jour présentiel", formatDateTimeFr(session.datePremierJourPresentiel))}
        ${createSessionField("Unité 1", formatPeriod(session.debutU1, session.finU1))}
        ${createSessionField("Unité 2", formatPeriod(session.debutU2, session.finU2))}
        ${createSessionField("Unité 3", formatPeriod(session.debutU3, session.finU3))}
      </div>
    </article>
  `;
}

function createSessionsBlock(sessions) {
  if (!sessions.length) return "";

  return `
    <div class="section-block">
      <div class="section-inner">
        <span class="section-title">
          Sessions disponibles
        </span>

        <div class="sessions-list">
          ${sessions.map(createSessionCard).join("")}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- */
/* RENDER CATALOGUE */
/* ----------------------------- */

function renderCatalogue(data) {
  const container = document.getElementById("catalogue-view");

  if (!data.length) {
    container.innerHTML = `
      <div class="empty-state">
        Aucune formation ne correspond aux filtres sélectionnés.
      </div>
    `;
    return;
  }

  container.innerHTML = data.map((formation, index) => {
    const formatClass = getFormatClass(formation.format);
    const publicLabel = getPublicBadgeLabel(formation);
    const publicBadgeClass = getPublicBadgeClass(formation);
    const typeActionShortLabel = getTypeActionShortLabel(formation.typeAction);
    const typeActionBadgeClass = getTypeActionBadgeClass(formation.typeAction);
    const financementLabel = formation.financement;
    const financementBadgeClass = getFinancementBadgeClass(formation.categorieProduit);
    const formateurs = formation.formateurs.length
      ? formation.formateurs.join(", ")
      : "";

    return `
      <article class="formation-card ${formatClass} card-public-${publicBadgeClass.replace("badge-public-", "")}">
        <div
          class="formation-header"
          role="button"
          tabindex="0"
          aria-expanded="false"
          data-card-index="${index}"
        >
          <div>
            <h2 class="formation-title">${escapeHtml(formation.titre || "Formation sans titre")}</h2>

            <div class="badges">
              <span class="badge badge-public ${publicBadgeClass}">
                ${escapeHtml(publicLabel)}
              </span>

              ${formation.format ? `
                <span class="badge badge-format ${getFormatBadgeClass(formation.format)}">
                  ${escapeHtml(formation.format)}
                </span>
              ` : ""}

              ${typeActionShortLabel ? `
                <span class="badge badge-type-action ${typeActionBadgeClass}">
                  ${escapeHtml(typeActionShortLabel)}
                </span>
              ` : ""}

              ${financementLabel ? `
                <span class="badge badge-financement ${financementBadgeClass}">
                  ${escapeHtml(financementLabel)}
                </span>
              ` : ""}

              ${formation.sessions.length ? `
                <span class="badge badge-session-count">
                  ${formation.sessions.length} session${formation.sessions.length > 1 ? "s" : ""}
                </span>
              ` : ""}
            </div>
          </div>

          <div class="toggle">
            <span class="toggle-text">Voir le détail</span>
            <span class="toggle-icon" aria-hidden="true">⌄</span>
          </div>
        </div>

        <div class="formation-details">
          <div class="formation-details-inner">
            <div class="formation-layout">
              <div class="formation-main">
                ${createContextBlock(formation.contexte)}
                ${createSessionsBlock(formation.sessions)}
              </div>

              <aside class="formation-sidebar">
                <div class="info-grid">
                  ${createInfoBlock("Numéro de dépôt", formation.numeroDepot)}
                  ${createPublicSpecialiteBlock(formation, index)}
                  ${createInfoBlock("Format", formation.format)}
                  ${createInfoBlock("Typologie", formation.typeAction)}
                  ${createInfoBlock("Type d’EPP", formation.typologie)}
                  ${createInfoBlock("Financement", formation.categorieProduit)}
                  ${createInfoBlock("Durée totale", formation.dureeTotale)}
                  ${createInfoBlock("Formateur(s)", formateurs)}
                  ${createInfoBlock("Prise en charge", formation.priseEnCharge)}
                  ${createInfoBlock("Indemnités PS", formation.indemnitesPs)}
                  ${createMemoInfoBlock(formation.ficheMemoPdf)}
                </div>
              </aside>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");

  bindFormationToggles();
  bindInlineToggles();
}

/* ----------------------------- */
/* INTERACTIONS CARTES */
/* ----------------------------- */

function bindFormationToggles() {
  const headers = document.querySelectorAll(".formation-header");

  headers.forEach(header => {
    header.addEventListener("click", event => {
      if (event.target.closest("a, button")) return;
      toggleFormationCard(header);
    });

    header.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleFormationCard(header);
      }
    });
  });
}

function toggleFormationCard(header) {
  const card = header.closest(".formation-card");
  if (!card) return;

  const isOpen = card.classList.contains("is-open");
  const toggleText = card.querySelector(".toggle-text");

  card.classList.toggle("is-open", !isOpen);
  header.setAttribute("aria-expanded", String(!isOpen));

  if (toggleText) {
    toggleText.textContent = isOpen ? "Voir le détail" : "Masquer le détail";
  }
}

function bindInlineToggles() {
  const buttons = document.querySelectorAll(".inline-toggle");

  buttons.forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const targetId = button.getAttribute("data-target");
      const target = document.getElementById(targetId);

      if (!target) return;

      const isHidden = target.hidden;
      const moreLabel = button.getAttribute("data-more-label") || "Voir plus";
      const lessLabel = button.getAttribute("data-less-label") || "Voir moins";

      target.hidden = !isHidden;
      button.textContent = isHidden ? lessLabel : moreLabel;
      button.setAttribute("aria-expanded", isHidden ? "true" : "false");
    });
  });
}

/* ----------------------------- */
/* SINGLE SELECT CUSTOM */
/* ----------------------------- */

function closeSingleFilterMenu() {
  const button = document.getElementById("filter-specialty-button");
  const menu = document.getElementById("filter-specialty-menu");

  if (button) button.setAttribute("aria-expanded", "false");
  if (menu) menu.hidden = true;
}

function toggleSingleFilterMenu() {
  const button = document.getElementById("filter-specialty-button");
  const menu = document.getElementById("filter-specialty-menu");

  if (!button || !menu || button.disabled) return;

  const isOpen = !menu.hidden;

  closeAllMultiFilterMenus();
  menu.hidden = isOpen;
  button.setAttribute("aria-expanded", String(!isOpen));
}

function updateSingleFilterButton(labelText) {
  const button = document.getElementById("filter-specialty-button");
  if (!button) return;

  const label = button.querySelector(".single-filter-label");
  if (!label) return;

  label.textContent = labelText;
}

function createSingleFilterOption(value, label, isActive = false) {
  return `
    <button
      type="button"
      class="single-filter-option ${isActive ? "is-selected" : ""}"
      data-value="${escapeHtml(value)}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function populateSingleFilter(values) {
  const container = document.getElementById("filter-specialty-options");
  if (!container) return;

  const optionsHtml = [
    createSingleFilterOption("", "Toutes", activeSpecialty === ""),
    ...values.map(value => createSingleFilterOption(
      value,
      value.replace(/^Médecin\s-\s/, ""),
      activeSpecialty === value
    ))
  ].join("");

  container.innerHTML = optionsHtml;

  container.querySelectorAll(".single-filter-option").forEach(option => {
    option.addEventListener("click", event => {
      event.stopPropagation();

      activeSpecialty = option.getAttribute("data-value") || "";

      updateSingleFilterButton(
        activeSpecialty
          ? activeSpecialty.replace(/^Médecin\s-\s/, "")
          : "Toutes"
      );

      populateSingleFilter(values);
      closeSingleFilterMenu();
      applyFilters();
    });
  });
}

function bindSingleFilterButton() {
  const button = document.getElementById("filter-specialty-button");
  const menu = document.getElementById("filter-specialty-menu");

  if (!button || !menu) return;

  button.addEventListener("click", event => {
    event.stopPropagation();
    toggleSingleFilterMenu();
  });

  menu.addEventListener("click", event => {
    event.stopPropagation();
  });
}

function disableSpecialtyFilter() {
  const button = document.getElementById("filter-specialty-button");
  const menu = document.getElementById("filter-specialty-menu");
  const options = document.getElementById("filter-specialty-options");

  activeSpecialty = "";

  if (button) {
    button.disabled = true;
    button.setAttribute("aria-expanded", "false");

    const label = button.querySelector(".single-filter-label");
    if (label) label.textContent = "Aucune";
  }

  if (menu) menu.hidden = true;
  if (options) options.innerHTML = "";
}

function enableSpecialtyFilter() {
  const button = document.getElementById("filter-specialty-button");

  if (button) {
    button.disabled = false;
  }
}

/* ----------------------------- */
/* MULTISELECT FILTERS */
/* ----------------------------- */

function getMultiFilterLabel(filterName, defaultLabel) {
  const selected = multiFilterState[filterName] || [];

  if (!selected.length) return defaultLabel;
  if (selected.length === 1) return selected[0];

  return `${selected.length} sélectionnés`;
}

function updateMultiFilterButton(filterName) {
  const button = document.getElementById(`filter-${filterName}-button`);
  if (!button) return;

  const label = button.querySelector(".multi-filter-label");
  if (!label) return;

  const defaults = {
    format: "Tous",
    "type-action": "Toutes",
    financement: "Tous"
  };

  label.textContent = getMultiFilterLabel(filterName, defaults[filterName] || "Tous");
}

function getSelectedMultiValues(filterName) {
  return multiFilterState[filterName] || [];
}

function closeAllMultiFilterMenus(exceptFilterName = "") {
  document.querySelectorAll(".multi-filter").forEach(filter => {
    const filterName = filter.getAttribute("data-filter");
    if (filterName === exceptFilterName) return;

    const button = document.getElementById(`filter-${filterName}-button`);
    const menu = document.getElementById(`filter-${filterName}-menu`);

    if (button) button.setAttribute("aria-expanded", "false");
    if (menu) menu.hidden = true;
  });
}

function toggleMultiFilterMenu(filterName) {
  const button = document.getElementById(`filter-${filterName}-button`);
  const menu = document.getElementById(`filter-${filterName}-menu`);

  if (!button || !menu) return;

  const isOpen = !menu.hidden;

  closeSingleFilterMenu();
  closeAllMultiFilterMenus(filterName);

  menu.hidden = isOpen;
  button.setAttribute("aria-expanded", String(!isOpen));
}

function createMultiFilterOption(filterName, value, label) {
  const id = `multi-${filterName}-${cleanSearch(value).replace(/[^a-z0-9]+/g, "-")}`;

  return `
    <label class="multi-filter-option" for="${escapeHtml(id)}">
      <input
        type="checkbox"
        id="${escapeHtml(id)}"
        value="${escapeHtml(value)}"
        data-filter-name="${escapeHtml(filterName)}"
      >
      <span>${escapeHtml(label || value)}</span>
    </label>
  `;
}

function populateMultiFilter(filterName, values, labelFormatter = null) {
  const container = document.getElementById(`filter-${filterName}-options`);
  if (!container) return;

  container.innerHTML = values
    .map(value => createMultiFilterOption(
      filterName,
      value,
      labelFormatter ? labelFormatter(value) : value
    ))
    .join("");

  container.querySelectorAll("input[type='checkbox']").forEach(input => {
    input.addEventListener("change", () => {
      const selected = Array.from(container.querySelectorAll("input[type='checkbox']:checked"))
        .map(item => item.value);

      multiFilterState[filterName] = selected;

      updateMultiFilterButton(filterName);
      applyFilters();
    });
  });

  updateMultiFilterButton(filterName);
}

function bindMultiFilterButtons() {
  document.querySelectorAll(".multi-filter-button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();

      const filter = button.closest(".multi-filter");
      if (!filter) return;

      const filterName = filter.getAttribute("data-filter");
      toggleMultiFilterMenu(filterName);
    });
  });

  document.querySelectorAll(".multi-filter-menu").forEach(menu => {
    menu.addEventListener("click", event => {
      event.stopPropagation();
    });
  });
}

function resetMultiFilters() {
  Object.keys(multiFilterState).forEach(filterName => {
    multiFilterState[filterName] = [];

    const container = document.getElementById(`filter-${filterName}-options`);
    if (container) {
      container.querySelectorAll("input[type='checkbox']").forEach(input => {
        input.checked = false;
      });
    }

    updateMultiFilterButton(filterName);
  });
}

/* ----------------------------- */
/* FILTRES ACTIFS */
/* ----------------------------- */

function getPublicFamilyLabel(value) {
  const labels = {
    medecins: "Médecins",
    infirmiers: "Infirmiers",
    pharmaciens: "Pharmaciens",
    "sages-femmes": "Sages-femmes",
    kines: "Kinésithérapeutes",
    dentistes: "Dentistes"
  };

  return labels[value] || value;
}

function getActiveTypeActionLabel(value) {
  return getTypeActionShortLabel(value) || getTypeActionFilterLabel(value) || value;
}

function createActiveFilterBadge(type, value, label, extraClass = "") {
  return `
    <button
      type="button"
      class="active-filter-badge ${extraClass}"
      data-filter-type="${escapeHtml(type)}"
      data-filter-value="${escapeHtml(value)}"
      aria-label="Retirer le filtre ${escapeHtml(label)}"
    >
      <span>${escapeHtml(label)}</span>
      <span class="active-filter-remove" aria-hidden="true">×</span>
    </button>
  `;
}

function renderActiveFilters() {
  const container = document.getElementById("active-filters");
  if (!container) return;

  const badges = [];

  if (activePublicFamily) {
    badges.push(createActiveFilterBadge(
      "public",
      activePublicFamily,
      getPublicFamilyLabel(activePublicFamily),
      `badge badge-public ${getPublicFamilyBadgeClass(activePublicFamily)}`
    ));
  }

  if (activeSpecialty) {
    badges.push(createActiveFilterBadge(
      "specialty",
      activeSpecialty,
      activeSpecialty.replace(/^Médecin\s-\s/, ""),
      "badge badge-public badge-public-medecins"
    ));
  }

  multiFilterState.format.forEach(value => {
    badges.push(createActiveFilterBadge(
      "format",
      value,
      value,
      `badge badge-format ${getFormatBadgeClass(value)}`
    ));
  });

  multiFilterState["type-action"].forEach(value => {
    badges.push(createActiveFilterBadge(
      "type-action",
      value,
      getActiveTypeActionLabel(value),
      `badge badge-type-action ${getTypeActionBadgeClass(value)}`
    ));
  });

  multiFilterState.financement.forEach(value => {
    badges.push(createActiveFilterBadge(
      "financement",
      value,
      value,
      `badge badge-financement ${getFinancementBadgeClass(value)}`
    ));
  });

  container.innerHTML = badges.join("");

  bindActiveFilterBadges();
}

function removeMultiFilterValue(filterName, value) {
  multiFilterState[filterName] = multiFilterState[filterName].filter(item => item !== value);

  const container = document.getElementById(`filter-${filterName}-options`);
  if (container) {
    container.querySelectorAll("input[type='checkbox']").forEach(input => {
      if (input.value === value) {
        input.checked = false;
      }
    });
  }

  updateMultiFilterButton(filterName);
}

function bindActiveFilterBadges() {
  document.querySelectorAll(".active-filter-badge").forEach(button => {
    button.addEventListener("click", () => {
      const type = button.getAttribute("data-filter-type");
      const value = button.getAttribute("data-filter-value");

      if (type === "public") {
        activePublicFamily = "";
        activeSpecialty = "";
        syncPublicButtons();
        updateSpecialtyFilterOptions();
      }

      if (type === "specialty") {
        activeSpecialty = "";
        updateSpecialtyFilterOptions();
      }

      if (type === "format") {
        removeMultiFilterValue("format", value);
      }

      if (type === "type-action") {
        removeMultiFilterValue("type-action", value);
      }

      if (type === "financement") {
        removeMultiFilterValue("financement", value);
      }

      applyFilters();
    });
  });
}

/* ----------------------------- */
/* FILTRES */
/* ----------------------------- */

function getFormationSearchHaystack(formation) {
  const sessionText = formation.sessions.map(session => [
    session.nomSession,
    getShortSessionName(session.nomSession),
    session.etat,
    session.intervenant1,
    session.dateDebut,
    session.dateFin,
    session.dateClasseVirtuelle,
    session.datePremierJourPresentiel
  ].join(" ")).join(" ");

  return cleanSearch([
    formation.titre,
    formation.referenceAction,
    formation.numeroDepot,
    formation.publicSpecialite,
    formation.format,
    formation.typeAction,
    formation.typologie,
    formation.categorieProduit,
    formation.financement,
    formation.dureeTotale,
    formation.priseEnCharge,
    formation.indemnitesPs,
    formation.contexte,
    formation.formateurs.join(" "),
    sessionText
  ].join(" "));
}

function applyFilters() {
  const searchValue = cleanSearch(document.getElementById("search").value);

  const selectedFormats = getSelectedMultiValues("format");
  const selectedTypeActions = getSelectedMultiValues("type-action");
  const selectedFinancements = getSelectedMultiValues("financement");

  filteredFormations = formations.filter(formation => {
    const families = getPublicFamiliesForFormation(formation);
    const specialties = getMedicalSpecialtiesForFormation(formation);
    const haystack = getFormationSearchHaystack(formation);

    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesFamily = !activePublicFamily || families.includes(activePublicFamily);

    const matchesSpecialty =
      activePublicFamily !== "medecins" ||
      !activeSpecialty ||
      specialties.includes(activeSpecialty);

    const matchesFormat =
      !selectedFormats.length ||
      selectedFormats.includes(formation.format);

    const matchesTypeAction =
      !selectedTypeActions.length ||
      selectedTypeActions.includes(formation.typeAction);

    const matchesFinancement =
      !selectedFinancements.length ||
      selectedFinancements.includes(formation.financement);

    return (
      matchesSearch &&
      matchesFamily &&
      matchesSpecialty &&
      matchesFormat &&
      matchesTypeAction &&
      matchesFinancement
    );
  });

  renderCurrentView();
}

function renderCurrentView() {
  const count = document.getElementById("results-count");

  const sessionCount = filteredFormations.reduce((sum, formation) => {
    return sum + formation.sessions.length;
  }, 0);

  count.textContent =
    `${filteredFormations.length} formation${filteredFormations.length > 1 ? "s" : ""} affichée${filteredFormations.length > 1 ? "s" : ""}` +
    ` · ${sessionCount} session${sessionCount > 1 ? "s" : ""}`;

  renderActiveFilters();
  renderCatalogue(filteredFormations);
}

function resetFilters() {
  activePublicFamily = "";
  activeSpecialty = "";

  document.getElementById("search").value = "";

  resetMultiFilters();

  syncPublicButtons();
  updateSpecialtyFilterOptions();
  applyFilters();
}

function syncPublicButtons() {
  document.querySelectorAll(".public-pill").forEach(button => {
    const value = button.getAttribute("data-public-value") || "";
    button.classList.toggle("is-active", value === activePublicFamily);
  });
}

function updateSpecialtyFilterOptions() {
  if (activePublicFamily !== "medecins") {
    disableSpecialtyFilter();
    return;
  }

  enableSpecialtyFilter();

  const specialties = uniqueValues(
    formations
      .flatMap(formation => getMedicalSpecialtiesForFormation(formation))
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b, "fr"));

  const specialtyExists = specialties.includes(activeSpecialty);

  if (!specialtyExists) {
    activeSpecialty = "";
  }

  updateSingleFilterButton(
    activeSpecialty
      ? activeSpecialty.replace(/^Médecin\s-\s/, "")
      : "Toutes"
  );

  populateSingleFilter(specialties);
}

function initFilters() {
  const formats = uniqueValues(formations.map(item => item.format))
    .sort((a, b) => a.localeCompare(b, "fr"));

  const typeActions = uniqueValues(formations.map(item => item.typeAction))
    .sort((a, b) => a.localeCompare(b, "fr"));

  const financements = uniqueValues(formations.map(item => item.financement))
    .sort((a, b) => a.localeCompare(b, "fr"));

  populateMultiFilter("format", formats);
  populateMultiFilter("type-action", typeActions, getTypeActionFilterLabel);
  populateMultiFilter("financement", financements);

  bindSingleFilterButton();
  bindMultiFilterButtons();

  document.getElementById("search").addEventListener("input", applyFilters);
  document.getElementById("reset-filters").addEventListener("click", resetFilters);

  document.querySelectorAll(".public-pill").forEach(button => {
    button.addEventListener("click", () => {
      activePublicFamily = button.getAttribute("data-public-value") || "";
      activeSpecialty = "";

      syncPublicButtons();
      updateSpecialtyFilterOptions();
      applyFilters();
    });
  });

  document.addEventListener("click", () => {
    closeSingleFilterMenu();
    closeAllMultiFilterMenus();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSingleFilterMenu();
      closeAllMultiFilterMenus();
    }
  });

  syncPublicButtons();
  updateSpecialtyFilterOptions();
}

/* ----------------------------- */
/* CHARGEMENT */
/* ----------------------------- */

function setSubtitleFromCsvImportDate() {
  const subtitle = document.getElementById("subtitle-text");
  if (!subtitle) return;

  const date = parseDate(CSV_IMPORT_DATE);

  if (!date) {
    subtitle.textContent = "Données issues d’un export Zoho CRM";
    return;
  }

  subtitle.textContent = `Données issues d’un export Zoho CRM · Dernière mise à jour le ${formatDateFr(date)}`;
}

async function loadData() {
  try {
    const response = await fetch(CSV_PATH);

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    setSubtitleFromCsvImportDate();

    const csvText = await response.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    const rows = parsed.data || [];

    formations = groupRowsByReferenceAction(rows);
    filteredFormations = [...formations];

    initFilters();
    applyFilters();
  } catch (error) {
    console.error(error);

    document.getElementById("results-count").textContent = "Erreur de chargement";

    document.getElementById("catalogue-view").innerHTML = `
      <div class="empty-state">
        Impossible de charger le fichier CSV.<br>
        Vérifiez que le fichier est bien placé dans <strong>data/data.csv</strong>.
      </div>
    `;
  }
}

loadData();
