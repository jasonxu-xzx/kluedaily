// PostHog loader + a tiny track() wrapper. If no key is set in config.js, nothing loads and track() does nothing.
(() => {
  const cfg = window.CD_CONFIG || {};
  const queue = [];
  let ready = false;

  window.cdTrack = (event, props = {}) => {
    if (!cfg.posthogKey) return;
    if (ready) window.posthog.capture(event, props);
    else queue.push([event, props]);
  };

  if (!cfg.posthogKey) return;

  const s = document.createElement("script");
  s.async = true;
  s.src = cfg.posthogHost.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
  s.onload = () => {
    window.posthog.init(cfg.posthogKey, {
      api_host: cfg.posthogHost,
      persistence: "localStorage",      // no cookies; anonymous ID kept in localStorage for D1/D7 retention
      person_profiles: "identified_only",
      autocapture: false,               // only the named game events + pageviews
      capture_pageview: true,           // carries referrer + utm_* for acquisition
      capture_pageleave: true,
      disable_session_recording: true,
      // Keep these off even if they're switched on in the PostHog project settings (privacy page promises only the above).
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,       // web vitals
      capture_exceptions: false,
      disable_surveys: true,
    });
    window.posthog.register({ data_version: cfg.dataVersion });
    ready = true;
    queue.splice(0).forEach(([e, p]) => window.posthog.capture(e, p));
  };
  document.head.appendChild(s);
})();
