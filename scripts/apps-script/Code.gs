/**
 * Clarity — Google collector → « Ma journée »
 *
 * Reads Gmail, Google Calendar and Google Contacts of the Google account running this
 * script, then pushes a snapshot to Clarity through the `ingest_daily_snapshot` RPC
 * (contract: SPEC-MA-JOURNEE.md §4.1).
 *
 * Setup: SPEC-MA-JOURNEE.md §8 and scripts/apps-script/README.md.
 *   1. Script properties: CLARITY_SUPABASE_URL, CLARITY_PUBLIC_KEY, CLARITY_INGEST_TOKEN
 *   2. Run `previewPayload` (grants permissions, prints the payload without sending it)
 *   3. Run `setup` (hourly trigger + first sync)
 *
 * Works with Google accounts set to French or English: calendars provided by Google
 * (holidays, week numbers, contacts' birthdays…) are recognised by their ID, which does
 * not depend on the language, and birthday titles are parsed in both languages.
 */

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  // Emails surfaced in « Ma journée » (Gmail search syntax): unread mail of the
  // Primary tab from the last two days. Gmail's own "important" marker was dropped:
  // it let through account notifications (Steam, Digiposte…) while real people's
  // mail in the Primary tab is what deserves a look in the morning.
  GMAIL_QUERY: 'in:inbox category:primary is:unread newer_than:2d',
  MAX_EMAILS: 15,

  // Calendars ignored for appointments, by exact name (case and accents ignored).
  // Hidden or unchecked calendars in Google Calendar are always ignored, and so is
  // every calendar provided by Google (matched by ID below).
  EXCLUDED_CALENDARS: [
    'Anniversaires', 'Birthdays',
    'Jours fériés en France', 'Holidays in France',
  ],

  // Calendars where birthdays were entered by hand, by name: the first one found is
  // used. Empty list to disable.
  BIRTHDAY_CALENDARS: ['Anniversaires', 'Birthdays'],

  // Strips the birthday wording around a name, in French and English:
  //   « Anniversaire Marie », « Anniv de Marie », « Joyeux anniversaire Marie »,
  //   « 🎂 Marie », « Birthday of Marie », « Happy birthday Marie », « Bday Marie »
  // « de / d' / of » is only stripped right after a birthday word, so that a name such
  // as « De Gaulle » stays intact.
  BIRTHDAY_TITLE_PREFIX: /^\s*(?:🎂\s*)?(?:(?:(?:joyeux\s+)?anniversaire|anniv\.?|(?:happy\s+)?birthday|b-?day)\s*:?\s*(?:de\s+|d['’]\s*|of\s+)?)?/i,
  //   « Marie's birthday », « Marie’s bday », « Marie birthday », « Marie 🎂 »
  BIRTHDAY_TITLE_SUFFIX: /\s*(?:['’]s)?\s*(?:birthday|b-?day)\s*(?:🎂)?\s*$|\s*🎂\s*$/i,

  // Country code used to convert national-format numbers (06 12 …).
  DEFAULT_COUNTRY_CODE: '33',

  // Limits aligned with the RPC validation.
  MAX_EVENTS: 200,
  MAX_BIRTHDAYS: 2000,
  MAX_TEXT: 300,
};

// Calendars provided by Google (holidays, week numbers, contacts' birthdays, sports,
// moon phases…) all live under `@group.v.calendar.google.com`, e.g.
//   fr.french#holiday@group.v.calendar.google.com
//   e_2_fr#weeknum@group.v.calendar.google.com
//   addressbook#contacts@group.v.calendar.google.com
// Calendars created by the user live under `@group.calendar.google.com` (no `.v.`).
// Matching the ID rather than the name keeps this independent of the account language.
const GOOGLE_PROVIDED_CALENDAR_ID = /@group\.v\.calendar\.google\.com$/;

const PAYLOAD_VERSION = 1;
const SYNC_HANDLER = 'syncToClarity';

// ─── Entry points ─────────────────────────────────────────────────────────────

/** Run once: creates the hourly trigger, then performs a first sync. */
function setup() {
  getConfig_(); // fail early if a property is missing

  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === SYNC_HANDLER; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger(SYNC_HANDLER).timeBased().everyHours(1).create();
  console.log('Déclencheur horaire créé.');

  syncToClarity();
}

/** Builds and sends the snapshot. Called by the hourly trigger. */
function syncToClarity() {
  const payload = buildPayload_();
  const result = sendToClarity_(payload);
  console.log(
    'Synchro OK — ' + payload.events.length + ' événements, ' +
    payload.emails.length + ' mails, ' + payload.birthdays.length + ' anniversaires. ' +
    'Réponse : ' + JSON.stringify(result)
  );
}

/** Builds the snapshot and prints it to the logs, WITHOUT sending it. */
function previewPayload() {
  const payload = buildPayload_();
  console.log(JSON.stringify(payload, null, 2));
}

/**
 * Troubleshooting: lists every calendar the script can see, whether it is used for
 * appointments (and why not), and how many events it holds today and tomorrow.
 * Sends nothing.
 */
function diagnoseCalendars() {
  const start = startOfDay_(new Date());
  const end = addDays_(start, 2);
  const excluded = excludedCalendars_();

  CalendarApp.getAllCalendars().forEach(function (cal) {
    const reason = calendarSkipReason_(cal, excluded);
    const count = cal.getEvents(start, end).length;
    console.log(
      (reason ? '✗ ' : '✓ ') + cal.getName() + ' — ' + count + ' événement(s) aujourd’hui/demain' +
      (reason ? ' — ignoré : ' + reason : '') + ' — id ' + cal.getId()
    );
  });
}

/**
 * Troubleshooting: counts the threads matched by CONFIG.GMAIL_QUERY and by looser
 * variants, to see which criterion filters everything out. Sends nothing, and logs
 * only counts and subjects (never bodies).
 */
function diagnoseEmails() {
  // The configured query, then the same query with one clause removed at a time:
  // the first variant that finds threads names the clause filtering everything out.
  const clauses = CONFIG.GMAIL_QUERY.split(/\s+/);
  const queries = [CONFIG.GMAIL_QUERY].concat(clauses.map(function (_, i) {
    return clauses.filter(function (__, j) { return j !== i; }).join(' ');
  }));
  queries.forEach(function (q, i) {
    const threads = GmailApp.search(q, 0, 50);
    const label = i === 0 ? '★ ' : '  sans « ' + clauses[i - 1] + ' » : ';
    console.log(label + threads.length + ' fil(s) — ' + q);
    threads.slice(0, 3).forEach(function (t) {
      console.log('      · ' + truncate_(t.getFirstMessageSubject() || '(sans objet)').slice(0, 80));
    });
  });
}

// ─── Payload ──────────────────────────────────────────────────────────────────

function buildPayload_() {
  const tz = Session.getScriptTimeZone();
  if (tz !== 'Europe/Paris') {
    console.warn('Fuseau du script = ' + tz + ' (attendu : Europe/Paris). Vérifie appsscript.json.');
  }

  const windowStart = startOfDay_(new Date());
  const windowEnd = addDays_(windowStart, 2); // today + tomorrow

  const contacts = collectContacts_();

  return {
    version: PAYLOAD_VERSION,
    generated_at: new Date().toISOString(),
    timezone: tz, // informative only: the server uses its own application time zone
    window: { start: windowStart.toISOString(), end: windowEnd.toISOString() },
    events: collectEvents_(windowStart, windowEnd, tz),
    emails: collectEmails_(),
    birthdays: collectBirthdays_(contacts),
  };
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

/** Calendars provided by Google (holidays, week numbers…) are not appointments. */
function isBuiltInCalendar_(cal) {
  return GOOGLE_PROVIDED_CALENDAR_ID.test(cal.getId());
}

/** Normalised names of CONFIG.EXCLUDED_CALENDARS, for lookups. */
function excludedCalendars_() {
  const excluded = {};
  CONFIG.EXCLUDED_CALENDARS.forEach(function (n) { excluded[normalize_(n)] = true; });
  return excluded;
}

/**
 * Why a calendar is not used for appointments, or null when it is. The single
 * rule shared by the sync and by `diagnoseCalendars`.
 */
function calendarSkipReason_(cal, excluded) {
  if (cal.isHidden()) return 'masqué';
  if (!cal.isSelected()) return 'décoché dans Google Agenda';
  if (isBuiltInCalendar_(cal)) return 'agenda fourni par Google (jours fériés, numéros de semaine…)';
  if (excluded[normalize_(cal.getName())]) return 'exclu par EXCLUDED_CALENDARS';
  return null;
}

function collectEvents_(start, end, tz) {
  const excluded = excludedCalendars_();
  const seen = {};
  const out = [];

  CalendarApp.getAllCalendars().forEach(function (cal) {
    if (calendarSkipReason_(cal, excluded)) return;

    cal.getEvents(start, end).forEach(function (ev) {
      if (isIgnoredEventType_(ev)) return;
      if (isDeclined_(ev)) return;

      const allDay = ev.isAllDayEvent();
      const s = allDay ? ev.getAllDayStartDate() : ev.getStartTime();
      const e = allDay ? ev.getAllDayEndDate() : ev.getEndTime();

      // `<eventId>@<start>` tells apart the occurrences of a recurring event.
      const sourceId = ev.getId() + '@' + s.toISOString();
      if (seen[sourceId]) return; // same event visible in several calendars
      seen[sourceId] = true;

      out.push({
        source_id: sourceId,
        calendar: truncate_(cal.getName()),
        title: truncate_(ev.getTitle() || '(sans titre)'),
        location: truncate_(ev.getLocation() || '') || null,
        all_day: allDay,
        // All-day events travel as plain dates (end exclusive): no time zone to guess.
        start: allDay ? formatDate_(s, tz) : s.toISOString(),
        end: allDay ? formatDate_(e, tz) : e.toISOString(),
      });
    });
  });

  out.sort(function (a, b) {
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
    return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
  });
  return out.slice(0, CONFIG.MAX_EVENTS);
}

/** Google-generated birthdays and "working location" entries are not appointments. */
function isIgnoredEventType_(ev) {
  if (typeof ev.getEventType !== 'function') return false;
  const type = String(ev.getEventType());
  return type === 'BIRTHDAY' || type === 'WORKING_LOCATION';
}

function isDeclined_(ev) {
  try {
    return ev.getMyStatus() === CalendarApp.GuestStatus.NO;
  } catch (e) {
    return false;
  }
}

// ─── Gmail ────────────────────────────────────────────────────────────────────

/** Metadata only (sender, subject, link, importance): never the body nor attachments. */
function collectEmails_() {
  return GmailApp.search(CONFIG.GMAIL_QUERY, 0, CONFIG.MAX_EMAILS).map(function (thread) {
    const messages = thread.getMessages();
    const last = messages[messages.length - 1];
    const from = parseFrom_(last.getFrom());
    return {
      source_id: thread.getId(),
      from_name: truncate_(from.name || from.email),
      from_email: truncate_(from.email),
      subject: truncate_(thread.getFirstMessageSubject() || '(sans objet)'),
      received_at: thread.getLastMessageDate().toISOString(),
      url: thread.getPermalink(),
      // Gmail's own marker: no longer a filter, Clarity uses it to split the list.
      important: thread.isImportant(),
    };
  });
}

/** "Sidney Martin <sidney@x.com>" → { name: 'Sidney Martin', email: 'sidney@x.com' } */
function parseFrom_(raw) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(raw || '');
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: (raw || '').trim() };
}

// ─── Contacts & birthdays ─────────────────────────────────────────────────────

/** Every contact (with or without a birthday): also used to look up phone numbers. */
function collectContacts_() {
  const people = [];
  let pageToken = null;
  do {
    const params = { personFields: 'names,birthdays,phoneNumbers', pageSize: 1000 };
    if (pageToken) params.pageToken = pageToken;
    const res = People.People.Connections.list('people/me', params);
    (res.connections || []).forEach(function (p) { people.push(p); });
    pageToken = res.nextPageToken;
  } while (pageToken);

  return people
    .map(function (p) {
      const name = (p.names && p.names[0]) || {};
      const birthday = (p.birthdays || [])
        .map(function (b) { return b.date; })
        .filter(function (d) { return d && d.month && d.day; })[0] || null;
      return {
        resource: p.resourceName,
        display_name: name.displayName || '',
        first_name: name.givenName || '',
        birthday: birthday,
        phone: pickPhone_(p.phoneNumbers),
      };
    })
    .filter(function (c) { return c.display_name; });
}

/** The hand-made birthday calendar: first configured name found, built-ins excluded. */
function findBirthdayCalendar_() {
  for (let i = 0; i < CONFIG.BIRTHDAY_CALENDARS.length; i++) {
    const found = CalendarApp.getCalendarsByName(CONFIG.BIRTHDAY_CALENDARS[i])
      .filter(function (cal) { return !isBuiltInCalendar_(cal); })[0];
    if (found) return found;
  }
  return null;
}

/** « Anniversaire de Marie Dupont » / « Marie Dupont's birthday » → « Marie Dupont » */
function birthdayName_(title) {
  return String(title || '')
    .replace(CONFIG.BIRTHDAY_TITLE_PREFIX, '')
    .replace(CONFIG.BIRTHDAY_TITLE_SUFFIX, '')
    .trim();
}

function collectBirthdays_(contacts) {
  const out = [];
  const seenNames = {};

  // 1. Google Contacts (preferred source: date and phone live in the same card)
  contacts.forEach(function (c) {
    if (!c.birthday) return;
    out.push({
      source: 'contacts',
      source_id: c.resource,
      name: truncate_(c.display_name),
      first_name: truncate_(c.first_name || firstWord_(c.display_name)),
      month: c.birthday.month,
      day: c.birthday.day,
      year: c.birthday.year || null,
      phone: c.phone,
    });
    seenNames[normalize_(c.display_name)] = true;
  });

  // 2. Hand-made birthday calendar (phone looked up by name among the contacts)
  if (CONFIG.BIRTHDAY_CALENDARS.length) {
    const cal = findBirthdayCalendar_();
    if (!cal) {
      console.warn('Agenda d’anniversaires introuvable (' + CONFIG.BIRTHDAY_CALENDARS.join(', ') + ') — ignoré.');
    } else {
      const byName = {};
      contacts.forEach(function (c) { byName[normalize_(c.display_name)] = c; });

      const start = startOfDay_(new Date());
      cal.getEvents(start, addDays_(start, 366)).forEach(function (ev) {
        const name = birthdayName_(ev.getTitle());
        const key = normalize_(name);
        if (!name || seenNames[key]) return; // already known from contacts, or a repeat occurrence
        seenNames[key] = true;

        const d = ev.isAllDayEvent() ? ev.getAllDayStartDate() : ev.getStartTime();
        const contact = byName[key] || null;
        out.push({
          source: 'calendar',
          source_id: ev.getId(),
          name: truncate_(name),
          first_name: truncate_(contact && contact.first_name ? contact.first_name : firstWord_(name)),
          month: d.getMonth() + 1,
          day: d.getDate(),
          year: null,
          phone: contact ? contact.phone : null,
        });
      });
    }
  }

  return out.slice(0, CONFIG.MAX_BIRTHDAYS);
}

/** Prefers a mobile number; returns international digits without "+" (e.g. 33612345678). */
function pickPhone_(phoneNumbers) {
  if (!phoneNumbers || !phoneNumbers.length) return null;
  const mobile = phoneNumbers.filter(function (p) { return p.type === 'mobile'; })[0];
  const chosen = mobile || phoneNumbers[0];
  return normalizePhone_(chosen.canonicalForm || chosen.value);
}

function normalizePhone_(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[^\d+]/g, '');
  if (s.indexOf('+') === 0) s = s.slice(1);
  else if (s.indexOf('00') === 0) s = s.slice(2);
  else if (s.indexOf('0') === 0) s = CONFIG.DEFAULT_COUNTRY_CODE + s.slice(1);
  s = s.replace(/\D/g, '');
  return s.length >= 8 && s.length <= 15 ? s : null;
}

// ─── Sending to Clarity ───────────────────────────────────────────────────────

function sendToClarity_(payload) {
  const cfg = getConfig_();
  const headers = { apikey: cfg.publicKey };
  // Legacy "anon" key (a JWT): PostgREST also expects the Authorization header.
  if (cfg.publicKey.indexOf('eyJ') === 0) headers.Authorization = 'Bearer ' + cfg.publicKey;

  const res = UrlFetchApp.fetch(cfg.url + '/rest/v1/rpc/ingest_daily_snapshot', {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify({ p_token: cfg.token, p_payload: payload }),
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code >= 300) {
    // Throwing makes Google email the trigger's failure summary.
    throw new Error('Clarity a refusé la synchro (HTTP ' + code + ') : ' + body.slice(0, 500));
  }
  try { return JSON.parse(body); } catch (e) { return body; }
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  const read = function (key) {
    const v = props.getProperty(key);
    if (!v) throw new Error('Propriété de script manquante : ' + key + ' (voir SPEC §8).');
    return v.trim();
  };
  return {
    url: read('CLARITY_SUPABASE_URL').replace(/\/+$/, ''),
    publicKey: read('CLARITY_PUBLIC_KEY'),
    token: read('CLARITY_INGEST_TOKEN'),
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Local midnight (script time zone: Europe/Paris through appsscript.json). */
function startOfDay_(date) {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays_(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function formatDate_(date, tz) {
  return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
}

function truncate_(s) {
  s = s == null ? '' : String(s);
  return s.length > CONFIG.MAX_TEXT ? s.slice(0, CONFIG.MAX_TEXT - 1) + '…' : s;
}

/** Lowercase, no accents, single spaces — to compare names. */
function normalize_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

function firstWord_(s) {
  return String(s || '').trim().split(/\s+/)[0] || '';
}
