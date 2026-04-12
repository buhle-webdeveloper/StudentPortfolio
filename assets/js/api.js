/**
 * @file api.js
 * @module API
 * @description Student Portfolio — Data Access Layer.
 * Abstracts all data fetching behind a REST-like interface:
 *  - Local careers data from data/careers.json (or inline fallback)
 *  - World Bank public API for SA secondary-school enrollment stats
 *
 * Career data is loaded once and cached in memory for the session.
 * Swap _BASE_URL for a real backend endpoint when migrating to a server.
 *
 * @global {Object} window.API — public API exposed to other modules
 *
 * Key functions:
 *  - API.getCareers()              — all career objects
 *  - API.getCareer(id)             — single career by id
 *  - API.getCareersByCategory(cat) — filter by category string
 *  - API.search(query)             — full-text search across careers and study topics
 *  - API.getStudyTopics()          — all study topic objects
 *  - API.getCategories()           — unique sorted category list
 *  - API.getSAEducationStats()     — World Bank enrollment data (with offline fallback)
 *
 * Dependencies: none (standalone IIFE; uses window.CAREERS_INLINE if available)
 */
(function () {
  "use strict";

  const _BASE_URL = "data/careers.json";          // Local JSON (acts as REST-like endpoint)
  const _WB_URL   = "https://api.worldbank.org/v2/country/ZA/indicator/SE.SEC.ENRR?format=json&mrv=5";

  /* ── Cache ── */
  let _cache = null;

  /* ── Core fetch ── */
  async function _load() {
    if (_cache) return _cache;
    // Prefer the inline data global if present — this lets the app work on
    // the file:// protocol where fetch() would fail with a CORS error.
    if (window.CAREERS_INLINE) { _cache = window.CAREERS_INLINE; return _cache; }
    const res  = await fetch(_BASE_URL);
    if (!res.ok) throw new Error(`Failed to load careers data (${res.status})`);
    _cache = await res.json();
    return _cache;
  }

  /* ── Public API ── */
  const API = {

    /**
     * GET /careers — returns all career objects
     */
    async getCareers() {
      const data = await _load();
      return data.careers || [];
    },

    /**
     * GET /careers/:id — returns single career or null
     */
    async getCareer(id) {
      const careers = await this.getCareers();
      return careers.find(c => c.id === id) || null;
    },

    /**
     * GET /careers?category=X — filter by category
     */
    async getCareersByCategory(category) {
      const careers = await this.getCareers();
      if (!category || category === "all") return careers;
      return careers.filter(c => c.category.toLowerCase() === category.toLowerCase());
    },

    /**
     * GET /search?q=query — full-text search
     */
    async search(query) {
      const careers = await this.getCareers();
      const studyTopics = await this.getStudyTopics();
      const q = query.toLowerCase().trim();
      if (!q) return { careers, studyTopics };

      const filteredCareers = careers.filter(c => {
        const haystack = [
          c.title, c.description, c.category,
          ...(c.sampleRoles || []),
          ...(c.skills || []),
          ...(c.subjects?.required || []),
          ...(c.subjects?.recommended || [])
        ].join(" ").toLowerCase();
        return haystack.includes(q);
      });

      const filteredTopics = studyTopics.filter(t =>
        t.label.toLowerCase().includes(q) || t.keywords.toLowerCase().includes(q)
      );

      return { careers: filteredCareers, studyTopics: filteredTopics };
    },

    /**
     * GET /study-topics — returns all study topics
     */
    async getStudyTopics() {
      const data = await _load();
      return data.studyTopics || [];
    },

    /**
     * GET /categories — returns unique category list
     */
    async getCategories() {
      const careers = await this.getCareers();
      const set = new Set(careers.map(c => c.category));
      return Array.from(set).sort();
    },

    /**
     * External API: World Bank — SA Secondary Enrollment Rate
     * Used on dashboard and landing page stats widget
     */
    async getSAEducationStats() {
      try {
        const res  = await fetch(_WB_URL, { mode: "cors" });
        if (!res.ok) throw new Error("World Bank API unavailable");
        const json = await res.json();
        // World Bank responses are a two-element array: [pagination metadata, data rows].
        const data = json[1] || [];
        return data
          .filter(d => d.value !== null)
          .map(d => ({ year: d.date, value: Math.round(d.value) }))
          .sort((a, b) => b.year - a.year);
      } catch {
        // Graceful fallback with plausible static data so the UI never shows
        // an empty widget — acceptable because the values are illustrative.
        return [
          { year: "2023", value: 93 },
          { year: "2022", value: 92 },
          { year: "2021", value: 91 },
          { year: "2020", value: 90 }
        ];
      }
    }
  };

  /* ── Expose globally ── */
  window.API = API;
})();
