/**
 * @file dashboard.js
 * @description Student Portfolio — Student Dashboard Controller.
 * Runs on dashboard.html behind an auth guard (redirects to auth.html if
 * not logged in). Manages all dashboard sections:
 *
 *  - Home:     welcome message, quick stats, recent saved careers
 *  - Saved:    full grid of bookmarked careers with unsave action
 *  - Goals:    add / remove personal study goals
 *  - Study:    weekly study checklist persisted per-user in localStorage
 *  - Progress: progress bars for careers explored, goals set, tasks done
 *  - Profile:  view and edit name/grade, change password
 *
 * Key functions (all internal to the IIFE):
 *  - populateUser()         — fill sidebar + topbar with user info
 *  - activateSection(id)    — switch visible dashboard section
 *  - loadSavedCareers()     — render saved-career cards from API data
 *  - loadGoals()            — render goal list from Auth user data
 *  - renderStudyChecklist() — render and toggle study tasks
 *  - updateProgress()       — recalculate and render all progress bars
 *  - populateProfile()      — fill profile section fields
 *
 * Dependencies: auth.js (window.Auth), api.js (window.API)
 */
(function () {
  "use strict";

  /* ── Auth guard ── */
  const user = Auth.requireAuth("auth.html");
  if (!user) return;

  /* ── Toast ── */
  function toast(msg, type = "success") {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'circle-exclamation'}" aria-hidden="true"></i>${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  /* ── Populate user info ── */
  function populateUser() {
    const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    const firstName = user.name.split(" ")[0];
    const grade = user.grade || "—";

    /* Sidebar */
    setText("sidebarAvatar", initials);
    setText("sidebarName", user.name);
    setText("sidebarGrade", grade);

    /* Topbar */
    setText("topbarAvatar",   initials);
    setText("topbarName",     firstName);
    setText("topbarGrade",    grade);
    setText("topbarTitle",    "Dashboard");
    setText("topbarSubtitle", `Welcome back, ${firstName}!`);

    /* Home section */
    setText("welcomeMsg", `Welcome back, ${firstName}! 👋`);
    setText("statGrade", grade !== "—" ? grade.replace("Grade ", "") : "—");
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Collapsible sidebar groups ── */
  document.querySelectorAll(".sidebar-group-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const groupId = btn.dataset.group;
      const items   = document.getElementById(`group-${groupId}`);
      if (!items) return;
      const isOpen = items.classList.contains("open");
      items.classList.toggle("open", !isOpen);
      btn.classList.toggle("open", !isOpen);
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
  });

  /* ── Sidebar navigation ── */
  const sectionTitles = {
    home:     "Dashboard",
    saved:    "Saved Careers",
    goals:    "My Goals",
    study:    "Study Plan",
    progress: "My Progress",
    profile:  "Profile & Settings"
  };
  const sectionSubtitles = {
    home:     () => `Welcome back, ${user.name.split(" ")[0]}!`,
    saved:    () => "Careers you've bookmarked for closer review",
    goals:    () => "Set study targets and track what matters to you",
    study:    () => "Check off weekly tasks and stay consistent",
    progress: () => "Track how you're moving toward your goals",
    profile:  () => "Your account information and settings"
  };

  function activateSection(sectionId) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".sidebar-link[data-section]").forEach(l => l.classList.remove("active"));
    document.getElementById(`section-${sectionId}`)?.classList.add("active");
    document.querySelector(`.sidebar-link[data-section="${sectionId}"]`)?.classList.add("active");
    setText("topbarTitle",    sectionTitles[sectionId]   || "Dashboard");
    setText("topbarSubtitle", sectionSubtitles[sectionId]?.() || "");
    document.getElementById("dashMain")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".sidebar-link[data-section]").forEach(btn => {
    btn.addEventListener("click", () => activateSection(btn.dataset.section));
  });

  /* Quick-action buttons that navigate to sections */
  document.querySelectorAll("[data-section-nav]").forEach(btn => {
    btn.addEventListener("click", () => activateSection(btn.dataset.sectionNav));
  });

  /* ── Mobile sidebar toggle ── */
  const sidebar  = document.getElementById("dashSidebar");
  const menuBtn  = document.getElementById("dashMenuBtn");
  const overlay  = document.getElementById("dashOverlay");

  menuBtn?.addEventListener("click", () => {
    const open = sidebar?.classList.toggle("open");
    overlay?.classList.toggle("show", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  overlay?.addEventListener("click", () => {
    sidebar?.classList.remove("open");
    overlay.classList.remove("show");
    menuBtn?.setAttribute("aria-expanded", "false");
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) {
      sidebar?.classList.remove("open");
      overlay?.classList.remove("show");
    }
  });

  /* ── Logout ── */
  document.getElementById("dashLogout")?.addEventListener("click", () => Auth.logout("auth.html"));
  document.getElementById("profileLogout")?.addEventListener("click", () => Auth.logout("auth.html"));

  /* ── Stats ── */
  function updateStats() {
    const current = Auth.getUser();
    const saved   = (current?.savedCareers || []).length;
    const goals   = (current?.studyGoals   || []).length;
    setText("statSaved", String(saved));
    setText("statGoals", String(goals));
    const count = document.getElementById("savedCount");
    if (count) count.textContent = String(saved);
  }

  /* ── Load saved careers ── */
  async function loadSavedCareers() {
    const current = Auth.getUser();
    const savedIds = current?.savedCareers || [];
    const allCareers = await API.getCareers();
    const saved = allCareers.filter(c => savedIds.includes(c.id));

    /* Update sidebar badge */
    const badge = document.getElementById("savedCount");
    if (badge) badge.textContent = String(saved.length);

    /* Main saved section */
    const grid = document.getElementById("savedCareersGrid");
    if (grid) {
      if (!saved.length) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon"><i class="fas fa-bookmark"></i></div>
            <h3>No saved careers yet</h3>
            <p>Browse careers and click the bookmark icon to save them here.</p>
            <a class="btn btn-primary" href="explore.html"><i class="fas fa-compass"></i> Explore Careers</a>
          </div>`;
      } else {
        grid.innerHTML = saved.map(c => `
          <div class="saved-card">
            <div class="saved-card-head">
              <div class="saved-card-icon"><i class="fas ${esc(c.categoryIcon || 'fa-briefcase')}"></i></div>
              <div>
                <div class="saved-card-name">${esc(c.title)}</div>
                <div class="saved-card-cat">${esc(c.category)}</div>
              </div>
            </div>
            <p class="saved-card-desc">${esc(c.description)}</p>
            <div class="saved-card-foot">
              <span class="badge badge-teal">${esc(c.jobOutlook || 'Good')}</span>
              <div style="display:flex;gap:.5rem">
                <a href="explore.html" class="btn btn-outline btn-sm">View</a>
                <button class="btn btn-ghost btn-sm" data-unsave="${esc(c.id)}">Remove</button>
              </div>
            </div>
          </div>`).join("");
        grid.querySelectorAll("[data-unsave]").forEach(btn => {
          btn.addEventListener("click", async () => {
            Auth.unsaveCareer(btn.dataset.unsave);
            toast("Removed from saved careers.");
            updateStats();
            await loadSavedCareers();
            await loadRecentSaves();
          });
        });
      }
    }
  }

  /* ── Recent saves (home section) ── */
  async function loadRecentSaves() {
    const current  = Auth.getUser();
    const savedIds = current?.savedCareers || [];
    const el       = document.getElementById("recentSaves");
    if (!el) return;
    if (!savedIds.length) {
      el.innerHTML = `
        <div class="empty-state" style="padding:var(--sp-8)">
          <div class="empty-icon"><i class="fas fa-bookmark"></i></div>
          <p style="font-size:var(--text-sm);color:var(--clr-gray-500);font-family:var(--font-sans)">No saved careers yet.<br><a href="explore.html" style="color:var(--clr-teal-dark)">Explore careers</a> to bookmark them here.</p>
        </div>`;
      return;
    }
    const allCareers = await API.getCareers();
    const recent = allCareers.filter(c => savedIds.includes(c.id)).slice(0, 3);
    el.innerHTML = recent.map(c => `
      <div style="display:flex;align-items:center;gap:var(--sp-3);padding:var(--sp-3) 0;border-bottom:1px solid var(--clr-gray-100)">
        <div style="width:36px;height:36px;border-radius:var(--r-md);background:var(--clr-teal-bg);display:flex;align-items:center;justify-content:center;color:var(--clr-teal-dark);flex-shrink:0">
          <i class="fas ${esc(c.categoryIcon || 'fa-briefcase')}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--text-sm);font-weight:600;font-family:var(--font-sans);color:var(--clr-gray-900);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.title)}</div>
          <div style="font-size:var(--text-xs);color:var(--clr-gray-500);font-family:var(--font-sans)">${esc(c.category)}</div>
        </div>
        <span class="badge badge-teal" style="flex-shrink:0">${esc(c.jobOutlook || 'Good')}</span>
      </div>`).join("") + (savedIds.length > 3 ? `<p style="text-align:center;font-size:var(--text-xs);color:var(--clr-gray-500);font-family:var(--font-sans);margin-top:var(--sp-3)">+${savedIds.length - 3} more saved</p>` : "");
  }

  /* ── Goals ── */
  function loadGoals() {
    const current = Auth.getUser();
    const goals   = current?.studyGoals || [];
    const list    = document.getElementById("goalList");
    if (!list) return;
    if (!goals.length) {
      list.innerHTML = `
        <div class="empty-state" style="padding:var(--sp-8)">
          <div class="empty-icon"><i class="fas fa-bullseye"></i></div>
          <h3>No goals yet</h3>
          <p>Add your first study goal below.</p>
        </div>`;
    } else {
      list.innerHTML = goals.map((g, i) => `
        <div class="goal-item">
          <i class="fas fa-check goal-check" aria-hidden="true"></i>
          <span class="goal-text">${esc(g)}</span>
          <button class="goal-del" data-goal-index="${i}" aria-label="Remove goal"><i class="fas fa-times" aria-hidden="true"></i></button>
        </div>`).join("");
      list.querySelectorAll(".goal-del").forEach(btn => {
        btn.addEventListener("click", () => {
          Auth.removeGoal(Number(btn.dataset.goalIndex));
          loadGoals();
          updateStats();
          updateProgress();
          toast("Goal removed.");
        });
      });
    }
  }

  document.getElementById("addGoalForm")?.addEventListener("submit", e => {
    e.preventDefault();
    const input = document.getElementById("goalInput");
    const text  = input?.value?.trim();
    if (!text) return;
    Auth.addGoal(text);
    input.value = "";
    loadGoals();
    updateStats();
    updateProgress();
    toast("Goal added!", "success");
  });

  /* ── Study plan ── */
  const STUDY_TASKS = [
    { id: "task1", label: "Revise Mathematics", sub: "1 hour — past papers" },
    { id: "task2", label: "English essay practice", sub: "30 minutes" },
    { id: "task3", label: "Physical Sciences formulas", sub: "Review and memorise" },
    { id: "task4", label: "Read study guide", sub: "CareerGuide study hub" },
    { id: "task5", label: "Career research", sub: "Explore one new career path" },
    { id: "task6", label: "Weekly review", sub: "Summarise what you learned" }
  ];

  const STUDY_KEY = `cg_study_${user.id}`;
  let studyDone = JSON.parse(localStorage.getItem(STUDY_KEY) || "{}");

  function renderStudyChecklist() {
    const list = document.getElementById("studyChecklist");
    if (!list) return;
    list.innerHTML = STUDY_TASKS.map(t => `
      <div class="study-item ${studyDone[t.id] ? 'done' : ''}" data-task="${esc(t.id)}">
        <div class="study-cb">
          ${studyDone[t.id] ? '<i class="fas fa-check" style="font-size:.75rem"></i>' : ""}
        </div>
        <div>
          <div class="study-item-title">${esc(t.label)}</div>
          <div class="study-item-sub">${esc(t.sub)}</div>
        </div>
      </div>`).join("");
    list.querySelectorAll(".study-item").forEach(item => {
      item.addEventListener("click", () => {
        const id = item.dataset.task;
        studyDone[id] = !studyDone[id];
        localStorage.setItem(STUDY_KEY, JSON.stringify(studyDone));
        renderStudyChecklist();
        updateStudyProgress();
      });
    });
    updateStudyProgress();
  }

  function updateStudyProgress() {
    const done  = STUDY_TASKS.filter(t => studyDone[t.id]).length;
    const total = STUDY_TASKS.length;
    setText("studyProgress", `${done} / ${total} done`);
    updateProgress();
  }

  /* ── Progress bars ── */
  function updateProgress() {
    const current = Auth.getUser();
    const saved   = (current?.savedCareers || []).length;
    const goals   = (current?.studyGoals || []).length;
    const done    = STUDY_TASKS.filter(t => studyDone[t.id]).length;

    // Progress heuristics: 10 saved careers = 100%, 5 goals = 100%.
    // These thresholds give learners a sense of momentum early on.
    const exploredPct = Math.min(saved * 10, 100);
    const goalsPct    = Math.min(goals * 20, 100);
    const studyPct    = Math.round((done / STUDY_TASKS.length) * 100);

    // Career Readiness panel (right side)
    setProgress("progressExplored",    "progressExploredBar",  exploredPct);
    setProgress("progressGoals",       "progressGoalsBar",     goalsPct);
    setProgress("progressStudy",       "progressStudyBar",     studyPct);

    // Overall Progress panel (left side — dynamically rendered)
    renderOverallProgress(saved, goals, done);
  }

  function renderOverallProgress(saved, goals, done) {
    const container = document.getElementById("overallProgressBars");
    if (!container) return;

    const current   = Auth.getUser();
    const totalGoals = (current?.studyGoals || []).length;
    const completedGoals = totalGoals; // all added goals count as "set"
    const totalTasks = STUDY_TASKS.length;

    const bars = [
      {
        label: "Saved Careers",
        pct: Math.min(saved * 10, 100),
        detail: `${saved} saved (10 = 100%)`
      },
      {
        label: "Goals Completion",
        pct: Math.min(goals * 20, 100),
        detail: `${goals} goals set (5 = 100%)`
      },
      {
        label: "Study Plan",
        pct: totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0,
        detail: `${done} / ${totalTasks} tasks done`
      }
    ];

    container.innerHTML = bars.map(b => `
      <div class="progress-row">
        <div class="progress-header">
          <span class="progress-lbl">${b.label}</span>
          <span class="progress-val">${b.pct}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${b.pct}%"></div></div>
        <div style="font-size:var(--text-xs);color:var(--clr-text-3);font-family:var(--font-sans);margin-top:2px">${b.detail}</div>
      </div>`).join("");
  }

  function setProgress(valId, barId, pct) {
    const valEl = document.getElementById(valId);
    const barEl = document.getElementById(barId);
    if (valEl) valEl.textContent = pct + "%";
    if (barEl) barEl.style.width = pct + "%";
  }

  /* ── Profile section ── */
  function populateProfile() {
    const current  = Auth.getUser();
    const initials = current.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    setText("profileAvatar", initials);
    setText("profileName",   current.name);
    setText("profileEmail",  current.email);
    setText("profileJoined", current.joinedAt || "—");
    setText("profileRole",   current.role === "admin" ? "Administrator" : "Student");
    const gradeBadge = document.getElementById("profileGradeBadge");
    if (gradeBadge && current.grade) {
      gradeBadge.innerHTML = `<span class="badge badge-teal">${esc(current.grade)}</span>`;
    }
    /* Pre-fill edit form */
    const nameInput  = document.getElementById("profileEditName");
    const gradeInput = document.getElementById("profileEditGrade");
    if (nameInput)  nameInput.value  = current.name || "";
    if (gradeInput) gradeInput.value = current.grade || "";
  }

  /* ── Profile edit form ── */
  document.getElementById("profileEditForm")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const name  = document.getElementById("profileEditName")?.value?.trim();
    const grade = document.getElementById("profileEditGrade")?.value;
    if (!name) { toast("Name cannot be empty.", "error"); return; }
    const result = Auth.updateUser({ name, grade: grade || null });
    if (result.ok) {
      // Refresh the local user reference used throughout
      Object.assign(user, Auth.getUser());
      populateUser();
      populateProfile();
      updateStats();
      toast("Profile updated!", "success");
    } else {
      toast(result.message || "Failed to update profile.", "error");
    }
  });

  /* ── Init ── */
  async function init() {
    populateUser();
    populateProfile();
    loadGoals();
    renderStudyChecklist();
    updateStats();
    updateProgress();
    await loadSavedCareers();
    await loadRecentSaves();
  }

  init().catch(console.error);
})();
