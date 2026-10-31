// =============================================================================
// METRIC DEFINITIONS — single source of truth (Hotspawn measurement framework)
// =============================================================================
// Every production model that needs engagement, bounces, key events, URL
// normalisation, excluded traffic or session dating calls these helpers.
// Change a definition here once; every model picks it up on the next run.
//
// Owner: DJ / Mayo (data team). Changes need review + a before/after check.
// =============================================================================

// ---- Constants --------------------------------------------------------------

// Rule 1: a session is engaged after 10 seconds or more of engagement time.
const ENGAGEMENT_MIN_MS = 10000;

// Rule 2: engaged when 2 or more DISTINCT pages were viewed (page_view events,
// URL without query string / fragment). Robust to UTM-stripping, reloads and
// duplicate tags. GA4-exact alternative would be "2+ page_view events".
const MIN_DISTINCT_PAGES = 2;

// Rule 3: key events. Any one makes the session engaged.
// TODO (measurement framework): confirm the list (pickem_submit? newsletter_signup?).
const KEY_EVENTS = ["purchase", "generate_lead", "user_signup", "sign_up"];

// Traffic excluded from production reporting (matched on page_location).
// Read from workflow_settings.yaml (vars.page_url_exclusions_csv) so the list
// lives in one place; falls back to the same three values.
const EXCLUDED_URL_PATTERNS = (
  (typeof dataform !== "undefined" &&
    dataform.projectConfig &&
    dataform.projectConfig.vars &&
    dataform.projectConfig.vars.page_url_exclusions_csv) ||
  "cloudwaysapps.com,wordpressmu,staging"
)
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

// Reporting timezone for session date / time.
// Kept at UTC = same as the current scheduled query that feeds Tableau, so only
// the midnight split changes. (The other Dataform models use vars.tz =
// Europe/Bratislava.) TODO: align when Pippa / Andy confirm the reporting timezone.
const REPORTING_TZ = "UTC";

// Incremental refresh: last N days + today (same as the current scheduled query).
const INCREMENTAL_DAYS = 3;

// Extra days of events read before the refresh window, so sessions that started
// just before the window are complete.
const LOOKBACK_DAYS = 1;

// TODO: set to MIN(date) of analytics_457395054.session_view_level_schema_volume_3.
// First date for a full rebuild = MIN(date) of session_view_level_schema_volume_3
// (validation V0, 31 Oct 2026: 2024-12-03, 697 days, no gaps).
   const HISTORY_START = "2024-12-03";

// ---- Helpers ------------------------------------------------------------------

function sqlList(values) {
  return values.map((v) => `'${v}'`).join(", ");
}

// URL without ?query and #fragment.
function normalizeUrl(col) {
  return `REGEXP_EXTRACT(${col}, r'^([^?#]+)')`;
}

function isKeyEvent(eventNameCol) {
  return `${eventNameCol} IN (${sqlList(KEY_EVENTS)})`;
}

function isExcludedUrl(urlCol) {
  const pattern = EXCLUDED_URL_PATTERNS
    .map((p) => p.replace(/\./g, "\\."))
    .join("|");
  return `REGEXP_CONTAINS(LOWER(IFNULL(${urlCol}, '')), r'${pattern}')`;
}

// Session-level ENGAGED flag (1/0). Use inside a GROUP BY session.
function engagedSession(e) {
  return `IF(
    SUM(IFNULL(${e}.engagement_time_msec, 0)) >= ${ENGAGEMENT_MIN_MS}
    OR COUNT(DISTINCT IF(${e}.event_name = 'page_view', ${normalizeUrl(`${e}.page_location`)}, NULL)) >= ${MIN_DISTINCT_PAGES}
    OR LOGICAL_OR(${isKeyEvent(`${e}.event_name`)}),
    1, 0)`;
}

// Session-level BOUNCE flag = not engaged (always engaged + bounce = 1).
function bounce(e) {
  return `1 - ${engagedSession(e)}`;
}

// Session date / time = first event of the session, in the reporting timezone.
function sessionDate(tsMicrosCol) {
  return `DATE(TIMESTAMP_MICROS(MIN(${tsMicrosCol})), '${REPORTING_TZ}')`;
}

function sessionTime(tsMicrosCol) {
  return `TIME(TIMESTAMP_MICROS(MIN(${tsMicrosCol})), '${REPORTING_TZ}')`;
}

// Refresh window.
function refreshStart() {
  return `DATE_SUB(CURRENT_DATE('${REPORTING_TZ}'), INTERVAL ${INCREMENTAL_DAYS} DAY)`;
}

// GA4 export shards (_TABLE_SUFFIX) to read.
function eventsSuffixFrom(isIncremental) {
  return isIncremental
    ? `FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE('${REPORTING_TZ}'), INTERVAL ${INCREMENTAL_DAYS + LOOKBACK_DAYS} DAY))`
    : `FORMAT_DATE('%Y%m%d', DATE '${HISTORY_START}')`;
}

function eventsSuffixTo() {
  return `FORMAT_DATE('%Y%m%d', CURRENT_DATE('${REPORTING_TZ}'))`;
}

module.exports = {
  ENGAGEMENT_MIN_MS, MIN_DISTINCT_PAGES, KEY_EVENTS, EXCLUDED_URL_PATTERNS,
  REPORTING_TZ, INCREMENTAL_DAYS, LOOKBACK_DAYS, HISTORY_START,
  sqlList, normalizeUrl, isKeyEvent, isExcludedUrl,
  engagedSession, bounce, sessionDate, sessionTime,
  refreshStart, eventsSuffixFrom, eventsSuffixTo,
};