/**
 * @file explore.js
 * @description Student Portfolio — Explore Page Controller.
 * Runs on explore.html. Renders the career catalogue and study guides
 * in a two-section layout with a collapsible sidebar.
 *
 * Capabilities:
 *  - Career card grid with lazy-loaded images and outlook badges
 *  - Live debounced search (200 ms) across titles, descriptions, skills, roles
 *  - Category filter chips generated from data
 *  - URL query param support (?cat=Technology) for deep-linked filters
 *  - Full career detail modal (subjects, salaries, institutions, skills)
 *  - Study guide cards with expandable tip modals
 *  - Bookmark (save/unsave) with instant UI feedback and toast notifications
 *  - Keyboard-accessible cards and modals (Enter, Space, Escape)
 *
 * Key functions (all internal to the IIFE):
 *  - renderCareerCards(careers)  — build career card grid HTML
 *  - openCareerModal(id)        — populate and show the detail modal
 *  - buildFilterChips(cats)     — create category filter buttons
 *  - applyFilters()             — combine category + search filters
 *  - renderStudyGrid(topics)    — build study guide card grid
 *  - openStudyModal(id)         — show study tip modal
 *  - toggleSave(id, btn)        — bookmark/unbookmark a career
 *
 * Dependencies: auth.js (window.Auth), api.js (window.API)
 */
(function () {
  "use strict";

  /* ── HTML escape ── */
  function esc(str) {
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  /* ── Toast ── */
  function toast(msg, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'circle-exclamation' : 'circle-info'}" aria-hidden="true"></i>${esc(msg)}`;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  /* ── Outlook class ── */
  function outlookClass(outlook) {
    const map = {
      "Excellent": "outlook-excellent",
      "Very Good": "outlook-good",
      "Good": "outlook-good",
      "Growing": "outlook-growing",
      "Stable": "outlook-stable"
    };
    return map[outlook] || "outlook-stable";
  }

  /* ── Render career cards ── */
  let _allCareers = [];
  let _activeFilter = "all";

  function renderCareerCards(careers) {
    const grid = document.getElementById("careerGrid");
    if (!grid) return;

    if (!careers.length) {
      grid.innerHTML = `
        <div class="no-results">
          <i class="fas fa-search"></i>
          <h3>No careers found</h3>
          <p>Try a different search term or category.</p>
        </div>`;
      return;
    }

    const user = typeof Auth !== "undefined" ? Auth.getUser() : null;

    grid.innerHTML = careers.map(c => {
      const saved   = user?.savedCareers?.includes(c.id);
      const outlook = c.jobOutlook || "Good";
      return `
        <article class="career-card" data-career-id="${esc(c.id)}" tabindex="0" role="button" aria-label="View ${esc(c.title)} career details">
          <div class="career-card-img">
            <img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.style.display='none'">
            <div class="career-card-img-icon"><i class="${esc(c.categoryIcon || 'fa-briefcase')}" aria-hidden="true"></i></div>
            <span class="career-card-cat-badge">${esc(c.category)}</span>
            <button class="career-card-bookmark ${saved ? 'saved' : ''}"
              data-career-id="${esc(c.id)}" aria-label="${saved ? 'Remove from saved' : 'Save career'}"
              title="${saved ? 'Unsave' : 'Save to my careers'}"
              onclick="event.stopPropagation()">
              <i class="fas fa-bookmark" aria-hidden="true"></i>
            </button>
          </div>
          <div class="career-card-body">
            <h3 class="career-card-title">${esc(c.title)}</h3>
            <p class="career-card-desc">${esc(c.description)}</p>
            <div class="career-card-meta">
              <span class="career-card-meta-item">
                <i class="fas fa-clock" aria-hidden="true"></i> ${esc(c.duration || "3–4 years")}
              </span>
              <span class="career-outlook ${outlookClass(outlook)}">${esc(outlook)}</span>
            </div>
          </div>
        </article>`;
    }).join("");

    /* Card click → open detail modal */
    grid.querySelectorAll(".career-card").forEach(card => {
      card.addEventListener("click", () => openCareerModal(card.dataset.careerId));
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openCareerModal(card.dataset.careerId); });
    });

    /* Bookmark buttons */
    grid.querySelectorAll(".career-card-bookmark").forEach(btn => {
      btn.addEventListener("click", () => toggleSave(btn.dataset.careerId, btn));
    });
  }

  /* ── Toggle save ── */
  function toggleSave(careerId, btn) {
    const user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    if (!user) { toast("Please log in to save careers.", "error"); window.location.href = "auth.html"; return; }
    const saved = user.savedCareers?.includes(careerId);
    if (saved) {
      Auth.unsaveCareer(careerId);
      btn.classList.remove("saved");
      btn.setAttribute("aria-label", "Save career");
      toast("Removed from saved careers.");
    } else {
      Auth.saveCareer(careerId);
      btn.classList.add("saved");
      btn.setAttribute("aria-label", "Remove from saved");
      toast("Saved to My Careers!", "success");
    }
  }

  /* ── Open career detail modal ── */
  async function openCareerModal(careerId) {
    const career = await API.getCareer(careerId);
    if (!career) return;
    const user  = typeof Auth !== "undefined" ? Auth.getUser() : null;
    const saved = user?.savedCareers?.includes(career.id);

    /* Hero */
    const imgEl   = document.getElementById("careerModalImg");
    const iconEl  = document.getElementById("careerModalIcon");
    const titleEl = document.getElementById("careerModalTitle");
    if (imgEl)   { imgEl.src = career.image || ""; imgEl.alt = career.title; }
    if (iconEl)  iconEl.innerHTML = `<i class="${esc(career.categoryIcon || 'fa-briefcase')}"></i>`;
    if (titleEl) titleEl.textContent = career.title;

    /* Description */
    const descEl = document.getElementById("careerModalDesc");
    if (descEl) descEl.innerHTML = `
      <h3><i class="fas fa-info-circle"></i> About this Career</h3>
      <p>${esc(career.longDescription || career.description)}</p>
      <div class="career-tags" style="margin-top:1rem">
        ${(career.tags || []).map(t => `<span class="career-tag">${esc(t)}</span>`).join("")}
      </div>`;

    /* Subjects */
    const subjEl = document.getElementById("careerModalSubjects");
    if (subjEl) {
      const req  = (career.subjects?.required || []).map(s => `<span class="career-tag" style="background:var(--clr-teal-bg);color:var(--clr-teal-dark)">${esc(s)}</span>`).join("");
      const rec  = (career.subjects?.recommended || []).map(s => `<span class="career-tag">${esc(s)}</span>`).join("");
      subjEl.innerHTML = `
        <h3><i class="fas fa-book"></i> Subject Requirements</h3>
        ${req ? `<p style="font-size:.75rem;color:var(--clr-gray-500);margin-bottom:.5rem;font-family:var(--font-sans)">REQUIRED</p><div class="career-tags" style="margin-bottom:.75rem">${req}</div>` : ""}
        ${rec ? `<p style="font-size:.75rem;color:var(--clr-gray-500);margin-bottom:.5rem;font-family:var(--font-sans)">RECOMMENDED</p><div class="career-tags">${rec}</div>` : ""}
        ${career.minimumAPS ? `<p style="font-size:.85rem;color:var(--clr-gray-600);font-family:var(--font-sans);margin-top:.75rem"><strong>Minimum APS:</strong> ${esc(String(career.minimumAPS))}</p>` : ""}`;
    }

    /* Sample roles */
    const rolesEl = document.getElementById("careerModalRoles");
    if (rolesEl) {
      rolesEl.innerHTML = `
        <h3><i class="fas fa-user-tie"></i> Sample Roles</h3>
        <div class="career-tags">
          ${(career.sampleRoles || []).map(r => `<span class="career-tag" style="background:var(--clr-blue-muted);color:var(--clr-blue)">${esc(r)}</span>`).join("")}
        </div>`;
    }

    /* Salary */
    const salEl = document.getElementById("careerModalSalary");
    if (salEl && career.salaryRange) {
      const s = career.salaryRange;
      salEl.innerHTML = `
        <h3><i class="fas fa-money-bill-trend-up"></i> Salary Range (${esc(s.currency || "ZAR")} / month)</h3>
        <div class="salary-range">
          ${s.junior  ? `<div class="salary-tier"><div class="salary-tier-label">Junior</div><div class="salary-tier-val">R${s.junior.toLocaleString()}</div></div>` : ""}
          ${s.mid     ? `<div class="salary-tier"><div class="salary-tier-label">Mid-level</div><div class="salary-tier-val">R${s.mid.toLocaleString()}</div></div>` : ""}
          ${s.senior  ? `<div class="salary-tier"><div class="salary-tier-label">Senior</div><div class="salary-tier-val">R${s.senior.toLocaleString()}</div></div>` : ""}
        </div>`;
    }

    /* Institutions */
    const instEl = document.getElementById("careerModalInstitutions");
    if (instEl) {
      instEl.innerHTML = `
        <h3><i class="fas fa-university"></i> Top SA Institutions</h3>
        <div class="institutions-list">
          ${(career.institutions || []).map(i => `<div class="institution-item"><i class="fas fa-circle-check"></i>${esc(i)}</div>`).join("")}
        </div>`;
    }

    /* Skills */
    const skillsEl = document.getElementById("careerModalSkills");
    if (skillsEl) {
      skillsEl.innerHTML = `
        <h3><i class="fas fa-star"></i> Core Skills</h3>
        <div class="career-tags">
          ${(career.skills || []).map(s => `<span class="career-tag">${esc(s)}</span>`).join("")}
        </div>`;
    }

    /* Save button */
    const saveBtn = document.getElementById("careerModalSave");
    if (saveBtn) {
      saveBtn.innerHTML = saved
        ? `<i class="fas fa-bookmark" aria-hidden="true"></i> Saved!`
        : `<i class="fas fa-bookmark" aria-hidden="true"></i> Save to My Careers`;
      saveBtn.onclick = () => {
        if (!Auth.getUser()) { toast("Please log in to save.", "error"); return; }
        if (Auth.getUser()?.savedCareers?.includes(career.id)) {
          Auth.unsaveCareer(career.id);
          saveBtn.innerHTML = `<i class="fas fa-bookmark"></i> Save to My Careers`;
          toast("Removed from saved careers.");
        } else {
          Auth.saveCareer(career.id);
          saveBtn.innerHTML = `<i class="fas fa-bookmark"></i> Saved!`;
          toast("Saved to My Careers!", "success");
        }
        /* Refresh bookmark btn in grid */
        const gridBtn = document.querySelector(`.career-card-bookmark[data-career-id="${careerId}"]`);
        if (gridBtn) {
          const nowSaved = Auth.getUser()?.savedCareers?.includes(career.id);
          gridBtn.classList.toggle("saved", nowSaved);
        }
      };
    }

    document.getElementById("careerModal")?.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ── Render study grid ── */
  const STUDY_CONTENT = {
    "modal-math":      { icon: "fa-square-root-variable", content: "<p>Practise daily. Focus on past NSC papers. Use spaced repetition for formulas. Break algebra, geometry, and calculus into separate revision sessions. Show all working—marks are awarded for method.</p>" },
    "modal-languages": { icon: "fa-language",   content: "<p>Read widely. Practise essay structure: introduction, body (3 paragraphs), conclusion. For comprehension, read the questions <em>before</em> the passage. Build vocabulary with a daily reading habit.</p>" },
    "modal-history":   { icon: "fa-landmark",   content: "<p>Create timelines. Practise source analysis: identify the author, date, context, and purpose. Quote sources in essays. Learn both sides of every historical argument.</p>" },
    "modal-critical":  { icon: "fa-brain",       content: "<p>Identify claims, evidence, and assumptions. Practice identifying logical fallacies. Read opinion pieces and challenge every argument. Write summaries that separate fact from opinion.</p>" },
    "modal-memory":    { icon: "fa-lightbulb",   content: "<p>Use the Leitner flashcard system. Review notes within 24 hours of the lesson. Teach content to someone else (the Feynman technique). Use mnemonics for long lists.</p>" },
    "modal-time":      { icon: "fa-clock",       content: "<p>Use the Pomodoro technique: 25 minutes focused work, 5-minute break. Create a weekly study timetable. Tackle the hardest subject when your energy is highest. Say no to distractions—your phone goes in another room.</p>" },
    "modal-mcq":       { icon: "fa-list-check",  content: "<p>Eliminate obviously wrong answers first. Read every option before choosing. Watch for absolute words: 'always', 'never', 'all'. Manage time—mark difficult questions and return to them. In NSC, there's no penalty for guessing.</p>" },
    "modal-essay":     { icon: "fa-pen-to-square", content: "<p>Plan before you write (5 minutes). Clear thesis in the introduction. Each body paragraph: topic sentence → evidence → explanation → link. Strong conclusion that restates your argument. Proofread for grammar and spelling.</p>" },
    "modal-oral":      { icon: "fa-microphone",  content: "<p>Know your content so well you can speak without reading. Make eye contact. Practise out loud—not in your head. Use pauses effectively. Slow down: nerves make you speak too fast. Prepare for questions.</p>" }
  };

  function renderStudyGrid(topics) {
    const grid = document.getElementById("studyGrid");
    if (!grid) return;
    grid.innerHTML = topics.map(t => {
      const extra = STUDY_CONTENT[t.id] || {};
      return `
        <article class="study-card" data-modal-id="${esc(t.id)}" tabindex="0" role="button" aria-label="Open ${esc(t.label)} study guide">
          <div class="study-card-icon"><i class="fas ${esc(extra.icon || 'fa-book-open')}" aria-hidden="true"></i></div>
          <h3>${esc(t.label)}</h3>
          <p>Click to open the full study guide</p>
        </article>`;
    }).join("");
    grid.querySelectorAll(".study-card").forEach(card => {
      card.addEventListener("click", () => openStudyModal(card.dataset.modalId));
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") openStudyModal(card.dataset.modalId); });
    });
  }

  function openStudyModal(modalId) {
    const topic = _allStudy.find(t => t.id === modalId);
    const extra = STUDY_CONTENT[modalId] || {};
    const titleEl = document.getElementById("studyModalTitle");
    const bodyEl  = document.getElementById("studyModalBody");
    if (titleEl && topic) titleEl.textContent = topic.label;
    if (bodyEl) bodyEl.innerHTML = extra.content || "<p>Guide content coming soon.</p>";
    document.getElementById("studyModal")?.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  /* ── Category filter chips ── */
  function buildFilterChips(categories) {
    const row = document.getElementById("filterChips");
    if (!row) return;
    const cats = ["all", ...categories];
    row.innerHTML = cats.map(c => `
      <button class="filter-chip ${c === "all" ? "active" : ""}" data-cat="${esc(c)}">
        ${c === "all" ? "All careers" : esc(c)}
      </button>`).join("");
    row.querySelectorAll(".filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        row.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        _activeFilter = chip.dataset.cat;
        applyFilters();
      });
    });
  }

  /* ── Apply category + search filters ── */
  function applyFilters() {
    const query  = document.getElementById("exploreSearch")?.value?.trim() || "";
    const header = document.getElementById("searchResultsHeader");

    let results = _allCareers;

    if (_activeFilter && _activeFilter !== "all") {
      results = results.filter(c => c.category === _activeFilter);
    }
    if (query.length >= 2) {
      const q = query.toLowerCase();
      results = results.filter(c => {
        const blob = [c.title, c.description, c.category, ...(c.sampleRoles||[]), ...(c.skills||[])].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }

    renderCareerCards(results);

    if (header) {
      header.style.display = query ? "flex" : "none";
      const countEl = document.getElementById("searchCount");
      if (countEl) countEl.textContent = String(results.length);
    }
  }

  /* ── Section switching ── */
  let _allStudy = [];

  const _sectionTitles    = { careers: "Explore Careers",   study: "Study Guides" };
  const _sectionSubtitles = { careers: "Browse paths and find your direction", study: "Practical guides to help you study smarter" };

  function switchSection(sectionId) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".sidebar-link[data-section]").forEach(n => n.classList.remove("active"));
    document.getElementById(`section-${sectionId}`)?.classList.add("active");
    document.querySelector(`.sidebar-link[data-section="${sectionId}"]`)?.classList.add("active");
    const t = document.getElementById("exploreTopbarTitle");
    const s = document.getElementById("exploreTopbarSubtitle");
    if (t) t.textContent = _sectionTitles[sectionId]    || "Explore";
    if (s) s.textContent = _sectionSubtitles[sectionId] || "";
  }

  /* ── Update user area in topbar ── */
  function updateUserArea() {
    const user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    const avatar = document.getElementById("exploreTopbarAvatar");
    const name   = document.getElementById("exploreTopbarName");
    const grade  = document.getElementById("exploreTopbarGrade");
    if (user) {
      if (avatar) avatar.textContent = user.name[0].toUpperCase();
      if (name)   name.textContent   = user.name.split(" ")[0];
      if (grade)  grade.textContent  = user.grade ? `Grade ${user.grade}` : user.role || "";
    }
  }

  /* ── Mobile sidebar ── */
  function setupMobileSidebar() {
    const btn     = document.getElementById("exploreMenuBtn");
    const sidebar = document.getElementById("exploreSidebar");
    const overlay = document.getElementById("exploreOverlay");
    if (!btn || !sidebar) return;
    btn.addEventListener("click", () => {
      const isOpen = sidebar.classList.toggle("open");
      overlay?.classList.toggle("show", isOpen);
      btn.setAttribute("aria-expanded", String(isOpen));
    });
    overlay?.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
      btn.setAttribute("aria-expanded", "false");
    });
  }

  /* ── Collapsible sidebar groups ── */
  function setupSidebarGroups() {
    document.querySelectorAll(".sidebar-group-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const groupId = btn.dataset.group;
        const items = document.getElementById(`group-${groupId}`);
        if (!items) return;
        const isOpen = items.classList.contains("open");
        items.classList.toggle("open", !isOpen);
        btn.classList.toggle("open", !isOpen);
        btn.setAttribute("aria-expanded", String(!isOpen));
      });
    });
  }

  /* ── Init ── */
  async function init() {
    updateUserArea();
    setupMobileSidebar();
    setupSidebarGroups();

    // Support deep-linking to a filtered view via ?cat=Technology, so the
    // landing page category buttons can link directly into explore.html.
    const params = new URLSearchParams(window.location.search);
    const urlCat = params.get("cat");
    if (urlCat) _activeFilter = urlCat;

    /* Load data */
    try {
      [_allCareers, _allStudy] = await Promise.all([
        API.getCareers(),
        API.getStudyTopics()
      ]);
      const categories = await API.getCategories();
      buildFilterChips(categories);

      /* Apply URL cat filter */
      if (urlCat) {
        const chips = document.querySelectorAll(".filter-chip");
        chips.forEach(c => {
          c.classList.toggle("active", c.dataset.cat === urlCat || (urlCat && c.dataset.cat === "all" && false));
        });
        const match = document.querySelector(`.filter-chip[data-cat="${urlCat}"]`);
        if (match) {
          document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
          match.classList.add("active");
        }
      }

      renderCareerCards(_activeFilter !== "all"
        ? _allCareers.filter(c => c.category === _activeFilter)
        : _allCareers);
      renderStudyGrid(_allStudy);

      /* Sidebar nav */
      document.querySelectorAll(".sidebar-link[data-section]").forEach(item => {
        item.addEventListener("click", () => switchSection(item.dataset.section));
      });

      /* Category filter from sidebar */
      document.querySelectorAll(".sidebar-link[data-filter]").forEach(item => {
        item.addEventListener("click", () => {
          _activeFilter = item.dataset.filter;
          document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
          const chip = document.querySelector(`.filter-chip[data-cat="${item.dataset.filter}"]`);
          if (chip) chip.classList.add("active");
          switchSection("careers");
          applyFilters();
        });
      });

    } catch (err) {
      console.error("Failed to load data:", err);
      const grid = document.getElementById("careerGrid");
      if (grid) grid.innerHTML = `
        <div class="no-results">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Could not load career data</h3>
          <p>Something went wrong while loading careers. Please refresh the page or try again later.</p>
        </div>`;
    }

    /* Live search */
    const searchInput = document.getElementById("exploreSearch");
    // Debounce search input to avoid re-rendering the grid on every keystroke.
    // 200 ms strikes a balance between responsiveness and performance.
    let debounce;
    searchInput?.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(applyFilters, 200);
    });
    searchInput?.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); applyFilters(); }
    });

    /* Clear search */
    document.getElementById("clearSearchBtn")?.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      applyFilters();
    });

    /* Close modals */
    document.getElementById("careerModalClose")?.addEventListener("click", closeCareerModal);
    document.getElementById("careerPanelClose")?.addEventListener("click", closeCareerModal);
    document.getElementById("careerModal")?.addEventListener("click", e => {
      if (e.target === document.getElementById("careerModal")) closeCareerModal();
    });
    document.getElementById("studyModalClose")?.addEventListener("click", () => {
      document.getElementById("studyModal")?.classList.remove("open");
      document.body.style.overflow = "";
    });
    document.getElementById("studyModal")?.addEventListener("click", e => {
      if (e.target === document.getElementById("studyModal")) {
        e.target.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        closeCareerModal();
        document.getElementById("studyModal")?.classList.remove("open");
        document.body.style.overflow = "";
      }
    });
  }

  function closeCareerModal() {
    document.getElementById("careerModal")?.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
