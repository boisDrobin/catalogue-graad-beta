let formations = [];
let filteredFormations = [];
let activePublicFamily = "medecins";
let activeView = "catalogue";

const CSV_PATH = "./data/data.csv";

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
  if (status === "complete" || status === "complet") return "complète";
  if (status === "ouverte" || status === "ouvert") return "ouverte";

  return status;
}

function shouldKeepSession(row) {
  return normalizeStatus(getField(row, ["Etat de la session"])) !== "fermée";
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

function getSessionMainDate(session) {
  return (
    session.dateClasseVirtuelle ||
    session.datePremierJourPresentiel ||
    session.dateDebut ||
    session.debutU1 ||
    ""
  );
}

function getSessionMainDateObject(session) {
  return parseDate(getSessionMainDate(session));
}

function getSessionMainDateLabel(session) {
  const main = getSessionMainDate(session);
  if (!main) return "Date à préciser";

  return formatDateTimeFr(main);
}

function getSessionMainTimeLabel(session) {
  const main = getSessionMainDate(session);
  const date = parseDate(main);

  if (!date) return "";

  return formatTimeFr(date);
}

function getDateKey(date) {
  if (!date) return "9999-99-99";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateLabelFromKey(key) {
  if (!key || key === "9999-99-99") return "Date à préciser";

  const [year, month, day] = key.split("-");
  const date = new Date(`${year}-${month}-${day}T00:00:00`);

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

/* ----------------------------- */
/* PUBLICS */
/* ----------------------------- */

function getPublicFamily(rawPublic) {
  const normalized = cleanSearch(rawPublic);

  const medecinsKeywords = [
    "allergologie",
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
    "anesthesie reanimation",
    "anesthesiste",
    "anesthesistes",
    "immunologie",
    "immunologue",
    "immunologues",
    "medecine interne",
    "medecine interne et immunologie clinique",
    "endocrinologie",
    "endocrinologie diabetologie nutrition",
    "endocrinologue",
    "endocrinologues",
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
    "maladies infectieuses et tropicales",
    "medecine d'urgence",
    "medecine d urgence",
    "medecine physique et de readaptation",
    "medecine vasculaire",
    "neurologie",
    "nephrologie",
    "pneumologie",
    "radiologie et imagerie medicale",
    "rhumatologie"
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
    "anesthesie reanimation": "Médecin - Anesthésie-réanimation",
    "anesthesiste": "Médecin - Anesthésie-réanimation",
    "anesthesistes": "Médecin - Anesthésie-réanimation",
    "immunologie": "Médecin - Immunologie",
    "medecine interne": "Médecin - Médecine interne",
    "medecine interne et immunologie clinique": "Médecin - Médecine interne et immunologie clinique",
    "endocrinologie": "Médecin - Endocrinologie",
    "endocrinologie diabetologie nutrition": "Médecin - Endocrinologie-diabétologie-nutrition",
    "oncologie": "Médecin - Oncologie",
    "psychiatrie": "Médecin - Psychiatrie",
    "hepato gastro enterologie": "Médecin - Hépato-gastro-entérologie",
    "geriatrie": "Médecin - Gériatrie",
    "geriatrie gerontologie": "Médecin - Gériatrie / Gérontologie",
    "maladies infectieuses et tropicales": "Médecin - Maladies infectieuses et tropicales",
    "medecine d'urgence": "Médecin - Médecine d'urgence",
    "medecine d urgence": "Médecin - Médecine d'urgence",
    "medecine physique et de readaptation": "Médecin - Médecine physique et de réadaptation",
    "medecine vasculaire": "Médecin - Médecine vasculaire",
    "neurologie": "Médecin - Neurologie",
    "nephrologie": "Médecin - Néphrologie",
    "pneumologie": "Médecin - Pneumologie",
    "radiologie et imagerie medicale": "Médecin - Radiologie et imagerie médicale",
    "rhumatologie": "Médecin - Rhumatologie"
  };

  return map[normalized] || "";
}

function getPublicLabel(publicSpecialite) {
  const medical = getMedicalSpecialtyLabel(publicSpecialite);
  return medical || publicSpecialite || "Public non renseigné";
}

/* ----------------------------- */
/* FORMAT / BADGES */
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
    "programme integre": "Programme intégré",
    "evaluation des pratiques professionnelles": "Évaluation des Pratiques Professionnelles",
    "audit clinique": "Audit clinique",
    "vignette clinique": "Vignette clinique",
    "vignettes cliniques": "Vignettes cliniques",
    "ouverte": "Ouverte",
    "complete": "Complète",
    "fermee": "Fermée"
  };

  return map[normalized] || raw;
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

function getStatusBadgeClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "complète") return "badge-status-full";
  if (normalized === "ouverte") return "badge-status-open";

  return "badge-session-count";
}

/* ----------------------------- */
/* TRANSFORMATION CSV → FORMATIONS */
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

function groupRowsByReferenceAction(rows) {
  const map = new Map();

  rows
    .filter(shouldKeepSession)
    .forEach(row => {
      const referenceAction = getField(row, ["Référence d'action"]);

      if (!referenceAction) return;

      if (!map.has(referenceAction)) {
        map.set(referenceAction, {
          referenceAction,
          titre: getField(row, ["Thématique session", "Titre", "Intitulé"]),
          publicSpecialite: getField(row, ["Cible", "Public / Spécialité", "Public concerné"]),
          format: formatLabel(getField(row, ["Format DPC", "Format"])),
          typeAction: formatLabel(getField(row, ["Type d'action"])),
          typologie: formatLabel(getField(row, ["Typologie"])),
          dureeTotale: formatHours(getField(row, [
            "Durée totale",
            "Duree totale",
            "Nbre d'heures 1er jour présentiel"
          ])),
          numeroDepot: referenceAction,
          produitAssocie: getField(row, ["Produit associé"]),
          formateurs: [],
          priseEnCharge: formatMoney(getField(row, ["Prise en charge"])),
          indemnitesPs: formatMoney(getField(row, ["Indemnité PS", "Indemnités PS"])),
          contexte: getField(row, ["Contexte"]),
          ficheMemoPdf: getField(row, [
            "Fiche mémo PDF",
            "Fiche memo PDF",
            "Fiche mémo pdf",
            "Fiche memo pdf"
          ]),
          sessions: []
        });
      }

      const formation = map.get(referenceAction);
      const session = createSessionFromRow(row);

      formation.sessions.push(session);

      if (session.intervenant1) {
        formation.formateurs.push(session.intervenant1);
        formation.formateurs = uniqueValues(formation.formateurs);
      }
    });

  const grouped = Array.from(map.values());

  grouped.forEach(formation => {
    formation.sessions.sort((a, b) => {
      const dateA = getSessionMainDateObject(a);
      const dateB = getSessionMainDateObject(b);

      if (!dateA && !dateB) return a.nomSession.localeCompare(b.nomSession, "fr");
      if (!dateA) return 1;
      if (!dateB) return -1;

      return dateA - dateB;
    });
  });

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
      <span class="info-label">${escapeHtml(label)}</span>
      <div class="info-value">${escapeHtml(value)}</div>
    </div>
  `;
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

function createMemoButton(url) {
  if (!hasValue(url)) return "";

  return `
    <a
      class="memo-button"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      Voir la fiche mémo PDF
    </a>
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

function createSessionCard(session) {
  const inscrits = hasValue(session.nombreInscrits)
    ? formatNumber(session.nombreInscrits)
    : "0";

  const effectif = hasValue(session.effectifMaximum)
    ? formatNumber(session.effectifMaximum)
    : "-";

  const mainDateLabel = getSessionMainDateLabel(session);

  return `
    <article class="session-card">
      <div class="session-card-header">
        <div>
          <h4 class="session-name">${escapeHtml(session.nomSession || "Session sans nom")}</h4>
          <div class="session-main-date">${escapeHtml(mainDateLabel)}</div>
        </div>

        ${session.etat ? `
          <span class="badge ${getStatusBadgeClass(session.etat)}">
            ${escapeHtml(session.etat)}
          </span>
        ` : ""}
      </div>

      <div class="session-grid">
        ${createSessionField("Inscrits", `${inscrits} / ${effectif}`)}
        ${createSessionField("Intervenant", session.intervenant1)}
        ${createSessionField("Date de début", formatDateShort(session.dateDebut) || session.dateDebut)}
        ${createSessionField("Date de fin", formatDateShort(session.dateFin) || session.dateFin)}
        ${createSessionField("Classe virtuelle", formatDateTimeFr(session.dateClasseVirtuelle))}
        ${createSessionField("1er jour présentiel", formatDateTimeFr(session.datePremierJourPresentiel))}
        ${createSessionField("U1", formatPeriod(session.debutU1, session.finU1))}
        ${createSessionField("U2", formatPeriod(session.debutU2, session.finU2))}
        ${createSessionField("U3", formatPeriod(session.debutU3, session.finU3))}
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
    const publicLabel = getPublicLabel(formation.publicSpecialite);
    const formateurs = formation.formateurs.length
      ? formation.formateurs.join(", ")
      : "";

    return `
      <article class="formation-card ${formatClass}">
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
              <span class="badge badge-public">${escapeHtml(publicLabel)}</span>

              ${formation.format ? `
                <span class="badge badge-format ${formatClass.replace("format-", "badge-format-")}">
                  ${escapeHtml(formation.format)}
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
            <div class="info-grid">
              ${createInfoBlock("Numéro de dépôt", formation.numeroDepot)}
              ${createInfoBlock("Public / Spécialité", formation.publicSpecialite)}
              ${createInfoBlock("Format", formation.format)}
              ${createInfoBlock("Type d’action", formation.typeAction)}
              ${createInfoBlock("Typologie", formation.typologie)}
              ${createInfoBlock("Durée totale", formation.dureeTotale)}
              ${createInfoBlock("Formateur(s)", formateurs)}
              ${createInfoBlock("Prise en charge", formation.priseEnCharge)}
              ${createInfoBlock("Indemnités PS", formation.indemnitesPs)}
            </div>

            ${createContextBlock(formation.contexte)}
            ${createSessionsBlock(formation.sessions)}
            ${createMemoButton(formation.ficheMemoPdf)}
          </div>
        </div>
      </article>
    `;
  }).join("");

  bindFormationToggles();
}

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

/* ----------------------------- */
/* RENDER CALENDRIER */
/* ----------------------------- */

function getCalendarSessions(data) {
  return data
    .flatMap(formation => {
      return formation.sessions.map(session => ({
        formation,
        session,
        date: getSessionMainDateObject(session)
      }));
    })
    .sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date - b.date;
    });
}

function renderCalendar(data) {
  const container = document.getElementById("calendar-view");
  const calendarSessions = getCalendarSessions(data);

  if (!calendarSessions.length) {
    container.innerHTML = `
      <div class="empty-state">
        Aucune session ne correspond aux filtres sélectionnés.
      </div>
    `;
    return;
  }

  const groups = new Map();

  calendarSessions.forEach(item => {
    const key = item.date ? getDateKey(item.date) : "9999-99-99";

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push(item);
  });

  container.innerHTML = Array.from(groups.entries()).map(([dateKey, items]) => {
    return `
      <article class="calendar-day">
        <div class="calendar-day-header">
          ${escapeHtml(getDateLabelFromKey(dateKey))}
        </div>

        <div class="calendar-sessions">
          ${items.map(({ formation, session }) => {
            const timeLabel = getSessionMainTimeLabel(session);
            const publicLabel = getPublicLabel(formation.publicSpecialite);
            const inscrits = hasValue(session.nombreInscrits)
              ? formatNumber(session.nombreInscrits)
              : "0";
            const effectif = hasValue(session.effectifMaximum)
              ? formatNumber(session.effectifMaximum)
              : "-";

            return `
              <div class="calendar-session">
                <div class="calendar-time">
                  ${escapeHtml(timeLabel || "—")}
                </div>

                <div>
                  <p class="calendar-title">
                    ${escapeHtml(formation.titre || "Formation sans titre")}
                  </p>
                  <p class="calendar-meta">
                    ${escapeHtml(publicLabel)}
                    ${formation.format ? ` · ${escapeHtml(formation.format)}` : ""}
                    ${session.nomSession ? ` · ${escapeHtml(session.nomSession)}` : ""}
                  </p>
                </div>

                <div class="badges">
                  ${session.etat ? `
                    <span class="badge ${getStatusBadgeClass(session.etat)}">
                      ${escapeHtml(session.etat)}
                    </span>
                  ` : ""}
                  <span class="badge badge-session-count">
                    ${escapeHtml(`${inscrits} / ${effectif}`)}
                  </span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

/* ----------------------------- */
/* FILTRES */
/* ----------------------------- */

function getFormationSearchHaystack(formation) {
  const sessionText = formation.sessions.map(session => [
    session.nomSession,
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
  const specialtyValue = cleanText(document.getElementById("filter-specialty").value);
  const formatValue = cleanText(document.getElementById("filter-format").value);
  const typeActionValue = cleanText(document.getElementById("filter-type-action").value);
  const typologieValue = cleanText(document.getElementById("filter-typologie").value);

  filteredFormations = formations.filter(formation => {
    const family = getPublicFamily(formation.publicSpecialite);
    const specialty = getMedicalSpecialtyLabel(formation.publicSpecialite);
    const haystack = getFormationSearchHaystack(formation);

    const matchesSearch = !searchValue || haystack.includes(searchValue);
    const matchesFamily = !activePublicFamily || family === activePublicFamily;
    const matchesSpecialty =
      activePublicFamily !== "medecins" ||
      !specialtyValue ||
      specialty === specialtyValue;

    const matchesFormat = !formatValue || formation.format === formatValue;
    const matchesTypeAction = !typeActionValue || formation.typeAction === typeActionValue;
    const matchesTypologie = !typologieValue || formation.typologie === typologieValue;

    return (
      matchesSearch &&
      matchesFamily &&
      matchesSpecialty &&
      matchesFormat &&
      matchesTypeAction &&
      matchesTypologie
    );
  });

  renderCurrentView();
}

function renderCurrentView() {
  const catalogueView = document.getElementById("catalogue-view");
  const calendarView = document.getElementById("calendar-view");
  const count = document.getElementById("results-count");

  const sessionCount = filteredFormations.reduce((sum, formation) => {
    return sum + formation.sessions.length;
  }, 0);

  count.textContent =
    `${filteredFormations.length} formation${filteredFormations.length > 1 ? "s" : ""} affichée${filteredFormations.length > 1 ? "s" : ""}` +
    ` · ${sessionCount} session${sessionCount > 1 ? "s" : ""}`;

  if (activeView === "catalogue") {
    catalogueView.classList.remove("is-hidden");
    calendarView.classList.add("is-hidden");

    renderCatalogue(filteredFormations);
    return;
  }

  if (activeView === "calendrier") {
    catalogueView.classList.add("is-hidden");
    calendarView.classList.remove("is-hidden");

    renderCalendar(filteredFormations);
  }
}

function resetFilters() {
  activePublicFamily = "";

  document.getElementById("search").value = "";
  document.getElementById("filter-specialty").value = "";
  document.getElementById("filter-format").value = "";
  document.getElementById("filter-type-action").value = "";
  document.getElementById("filter-typologie").value = "";

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

function syncViewTabs() {
  document.querySelectorAll(".view-tab").forEach(button => {
    const value = button.getAttribute("data-view") || "catalogue";
    button.classList.toggle("is-active", value === activeView);
  });
}

function updateSpecialtyFilterOptions() {
  const select = document.getElementById("filter-specialty");

  if (activePublicFamily !== "medecins") {
    select.disabled = true;
    select.innerHTML = `<option value="">Aucune</option>`;
    select.value = "";
    return;
  }

  const specialties = uniqueValues(
    formations
      .map(formation => getMedicalSpecialtyLabel(formation.publicSpecialite))
      .filter(Boolean)
  ).sort((a, b) => a.localeCompare(b, "fr"));

  select.disabled = false;
  select.innerHTML = `<option value="">Toutes</option>`;

  specialties.forEach(specialty => {
    const option = document.createElement("option");
    option.value = specialty;
    option.textContent = specialty.replace(/^Médecin\s-\s/, "");
    select.appendChild(option);
  });
}

function populateSelect(selectId, values, defaultLabel) {
  const select = document.getElementById(selectId);

  select.innerHTML = `<option value="">${defaultLabel}</option>`;

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function initFilters() {
  const formats = uniqueValues(formations.map(item => item.format))
    .sort((a, b) => a.localeCompare(b, "fr"));

  const typeActions = uniqueValues(formations.map(item => item.typeAction))
    .sort((a, b) => a.localeCompare(b, "fr"));

  const typologies = uniqueValues(formations.map(item => item.typologie))
    .sort((a, b) => a.localeCompare(b, "fr"));

  populateSelect("filter-format", formats, "Tous");
  populateSelect("filter-type-action", typeActions, "Tous");
  populateSelect("filter-typologie", typologies, "Toutes");

  document.getElementById("search").addEventListener("input", applyFilters);
  document.getElementById("filter-specialty").addEventListener("change", applyFilters);
  document.getElementById("filter-format").addEventListener("change", applyFilters);
  document.getElementById("filter-type-action").addEventListener("change", applyFilters);
  document.getElementById("filter-typologie").addEventListener("change", applyFilters);
  document.getElementById("reset-filters").addEventListener("click", resetFilters);

  document.querySelectorAll(".public-pill").forEach(button => {
    button.addEventListener("click", () => {
      activePublicFamily = button.getAttribute("data-public-value") || "";
      syncPublicButtons();
      updateSpecialtyFilterOptions();
      applyFilters();
    });
  });

  document.querySelectorAll(".view-tab").forEach(button => {
    button.addEventListener("click", () => {
      activeView = button.getAttribute("data-view") || "catalogue";
      syncViewTabs();
      renderCurrentView();
    });
  });

  syncPublicButtons();
  syncViewTabs();
  updateSpecialtyFilterOptions();
}

/* ----------------------------- */
/* CHARGEMENT */
/* ----------------------------- */

function setSubtitleFromResponse(response) {
  const subtitle = document.getElementById("subtitle-text");
  const lastModified = response.headers.get("last-modified");

  if (!lastModified) {
    subtitle.textContent = "Données issues d’un export Zoho CRM";
    return;
  }

  const date = new Date(lastModified);

  if (Number.isNaN(date.getTime())) {
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

    setSubtitleFromResponse(response);

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
