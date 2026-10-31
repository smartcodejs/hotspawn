// =============================================================================
// CHANNEL GROUPING — Hotspawn
// =============================================================================
// Copied 1:1 from the validated scheduled query that builds
// analytics_457395054.session_view_level_schema_volume_3 (section 2), so
// channels do not change when the table moves to Dataform.
// Order matters: TWCA must precede TWC.
//
// Arguments are SESSION-LEVEL columns (already aggregated per session):
//   src  = session source, med = session medium, camp = session campaign,
//   ga4cg = GA4 default channel group (session_traffic_source_last_click).
// =============================================================================

function sql(src, med, camp, ga4cg) {
  const s = `LOWER(COALESCE(${src}, ''))`;
  const m = `LOWER(COALESCE(${med}, ''))`;
  const mt = `LOWER(TRIM(COALESCE(${med}, '')))`;
  const c = `LOWER(COALESCE(${camp}, ''))`;
  const g = `LOWER(COALESCE(${ga4cg}, ''))`;

  return `CASE
    -- TWCA: Paid Social (must precede TWC)
    WHEN REGEXP_CONTAINS(${c}, r'twca') THEN 'Paid Social'

    -- Reddit CPC: Paid Social
    WHEN REGEXP_CONTAINS(${s}, r'reddit') AND ${mt} = 'cpc' THEN 'Paid Social'

    -- TWC: Social
    WHEN REGEXP_CONTAINS(${c}, r'twc') THEN 'Social'

    -- Propeller Ads: Paid Social
    WHEN REGEXP_CONTAINS(${s}, r'propeller') OR REGEXP_CONTAINS(${m}, r'propeller') THEN 'Paid Social'

    -- Direct / Unassigned fallback via GA4 default channel group
    WHEN ${s} IN ('(direct)', '(not set)', '') AND ${m} IN ('(none)', '(not set)', '') THEN CASE
      WHEN ${g} = 'direct' THEN 'Direct'
      WHEN ${g} = 'unassigned' THEN 'Unassigned'
      WHEN ${g} = 'organic search' THEN 'Organic Search'
      WHEN ${g} = 'ai assistant' THEN 'AI'
      WHEN ${g} IN ('organic social', 'paid social', 'organic video', 'paid video') THEN 'Social'
      WHEN ${g} = 'referral' THEN 'Referral'
      WHEN ${g} = 'paid search' THEN 'Paid Search'
      WHEN ${g} = 'email' THEN 'Email'
      WHEN ${s} IN ('(direct)', '') AND ${m} IN ('(none)', '(not set)', '') THEN 'Direct'
      ELSE 'Unassigned'
    END

    -- Organic Search
    WHEN REGEXP_CONTAINS(${s}, r'(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia|seznam|naver|daum|sogou|aol)')
     AND ${m} = 'organic' THEN 'Organic Search'

    -- AI traffic
    WHEN REGEXP_CONTAINS(${s}, r'(openai|chatgpt|perplexity|claude|gemini|copilot)')
      OR ${s} IN ('openai', 'perplexity') THEN 'AI'

    -- Meta / CPC and Push / CPC
    WHEN ${s} IN ('meta', 'push') AND ${m} = 'cpc' THEN 'Paid Social'

    -- Social
    WHEN REGEXP_CONTAINS(${s}, r'(^x$|tiktok|tik tok|facebook|^fb$|instagram|^ig$|twitter|t\\.co|linkedin|lnkd|reddit|pinterest|youtube|youtu\\.be)')
      OR REGEXP_CONTAINS(${m}, r'(social|social-network|social media|sm|paid_social|paidsocial)') THEN 'Social'

    -- Referral
    WHEN ${m} = 'referral' THEN 'Referral'

    -- Paid Search
    WHEN REGEXP_CONTAINS(${s}, r'(google|bing|duckduckgo|yahoo|yandex|baidu)')
     AND REGEXP_CONTAINS(${m}, r'(cpc|paidsearch|ppc|paid)') THEN 'Paid Search'

    -- Email
    WHEN ${m} = 'email' THEN 'Email'

    ELSE 'Unassigned'
  END`;
}

module.exports = { sql };