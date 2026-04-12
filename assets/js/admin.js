/**
 * @file admin.js
 * @description Student Portfolio — Admin Panel Controller.
 * Runs on admin.html behind an admin guard (redirects non-admin users
 * to index.html). Provides a management interface with five sections:
 *
 *  - Overview:   stat cards (users, careers, saves, goals) and recent users table
 *  - Careers:    searchable career catalogue table with detail view modal
 *  - Users:      full user table with search and delete actions
 *  - Analytics:  horizontal bar charts for most-saved careers, grade distribution,
 *                and careers by category
 *  - Settings:   admin profile edit, password change, and full data reset
 *
 * Key functions (all internal to the IIFE):
 *  - populateAdmin()          — fill sidebar/topbar with admin info
 *  - loadCareers()            — fetch career data and render table + charts
 *  - loadUsers()              — read all users via Auth and render tables + analytics
 *  - renderCareerTable(arr)   — build the career catalogue <tbody>
 *  - renderUsersTable(arr)    — build the users <tbody> with delete buttons
 *  - renderAnalytics(users)   — build bar charts from aggregated user data
 *  - renderTopCareers()       — overview section's "most saved" chart
 *  - openCareerView(id)       — populate and show career detail modal
 *
 * Dependencies: auth.js (window.Auth), api.js (window.API)
 */
(function () {
  "use strict";

  /* ── Admin guard ── */
  const user = Auth.requireAdmin("index.html");
  if (!user) return;

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function toast(msg, type = "success") {
    const c = document.getElementById("toast-container");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'circle-exclamation' : 'circle-info'}" aria-hidden="true"></i>${msg}`;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Populate admin info ── */
  function populateAdmin() {
    const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    setText("adminSidebarAvatar", initials);
    setText("adminSidebarName",   user.name);
    setText("adminTopbarAvatar",  initials);
    setText("adminTopbarName",    user.name.split(" ")[0]);
    /* Pre-fill settings */
    const nameInput  = document.getElementById("setAdminName");
    const emailInput = document.getElementById("setAdminEmail");
    if (nameInput)  nameInput.value  = user.name;
    if (emailInput) emailInput.value = user.email || "";
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
    overview:  "Admin Overview",
    careers:   "Career Catalogue",
    users:     "Registered Users",
    analytics: "Analytics",
    settings:  "System Settings"
  };
  const sectionSubtitles = {
    overview:  "Site-wide statistics at a glance",
    careers:   "Browse and search all career entries",
    users:     "All registered student accounts",
    analytics: "Insights into platform usage",
    settings:  "Admin account and site configuration"
  };

  function activateSection(sectionId) {
    document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".sidebar-link[data-section]").forEach(l => l.classList.remove("active"));
    document.getElementById(`section-${sectionId}`)?.classList.add("active");
    document.querySelector(`.sidebar-link[data-section="${sectionId}"]`)?.classList.add("active");
    setText("adminTopbarTitle",    sectionTitles[sectionId]    || "Admin");
    setText("adminTopbarSubtitle", sectionSubtitles[sectionId] || "");
    document.getElementById("adminMain")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll(".sidebar-link[data-section]").forEach(btn => {
    btn.addEventListener("click", () => activateSection(btn.dataset.section));
  });
  document.querySelectorAll("[data-section-nav]").forEach(btn => {
    btn.addEventListener("click", () => activateSection(btn.dataset.sectionNav));
  });

  /* ── Mobile sidebar ── */
  const sidebar  = document.getElementById("adminSidebar");
  const menuBtn  = document.getElementById("adminMenuBtn");
  const overlay  = document.getElementById("adminOverlay");

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

  /* ── Logout ── */
  document.getElementById("adminLogout")?.addEventListener("click", () => Auth.logout("auth.html"));

  /* ── Career catalogue ── */
  let _allCareers = [];
  let _filteredCareers = [];

  async function loadCareers() {
    try {
      _allCareers = await API.getCareers();
      setText("adminCareerCount", String(_allCareers.length));
      setText("ovCareers",        String(_allCareers.length));
      setText("infoTotalCareers", String(_allCareers.length));
      _filteredCareers = _allCareers;
      renderCareerTable(_allCareers);
      renderTopCareers();
    } catch (e) {
      console.error("Career load failed", e);
    }
  }

  function renderCareerTable(careers) {
    const tbody = document.getElementById("careersTbody");
    if (!tbody) return;
    if (!careers.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--sp-8);color:var(--clr-gray-500);font-family:var(--font-sans)">No careers match the search.</td></tr>`;
      return;
    }
    tbody.innerHTML = careers.map(c => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div style="width:34px;height:34px;background:var(--clr-blue-muted);border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;color:var(--clr-blue);font-size:.9rem;flex-shrink:0">
              <i class="fas ${esc(c.categoryIcon || 'fa-briefcase')}"></i>
            </div>
            <div>
              <div class="col-name">${esc(c.title)}</div>
              <div style="font-size:var(--text-xs);color:var(--clr-gray-400)">${esc(c.id)}</div>
            </div>
          </div>
        </td>
        <td><span class="badge badge-teal">${esc(c.category)}</span></td>
        <td><span class="badge ${outlookBadge(c.jobOutlook)}">${esc(c.jobOutlook || 'Good')}</span></td>
        <td style="font-size:var(--text-xs)">${esc(c.duration || '—')}</td>
        <td style="font-size:var(--text-xs)">${c.minimumAPS || '—'}</td>
        <td>
          <button class="btn btn-ghost btn-sm" data-view="${esc(c.id)}">
            <i class="fas fa-eye"></i> View
          </button>
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-view]").forEach(btn => {
      btn.addEventListener("click", () => openCareerView(btn.dataset.view));
    });
  }

  function renderTopCareers() {
    const el = document.getElementById("topCareersChart");
    if (!el || !_allUsers.length) return;
    // Aggregate save counts across all users to find the most popular careers.
    // Only the top 6 are shown to keep the chart readable.
    const countMap = {};
    _allUsers.forEach(u => (u.savedCareers || []).forEach(id => {
      countMap[id] = (countMap[id] || 0) + 1;
    }));
    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    if (!sorted.length) {
      el.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-gray-400);font-family:var(--font-sans);padding:var(--sp-4) 0">No saves recorded yet.</p>`;
      return;
    }
    const max = sorted[0][1];
    el.innerHTML = sorted.map(([id, count]) => {
      const career = _allCareers.find(c => c.id === id);
      const pct = Math.round((count / max) * 100);
      return `<div class="chart-bar-row">
        <span class="chart-bar-label">${esc(career?.title || id)}</span>
        <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
        <span class="chart-bar-val">${count}</span>
      </div>`;
    }).join("");
  }

  function outlookBadge(outlook) {
    const map = {
      "Excellent": "badge-green",
      "Very Good": "badge-teal",
      "Good": "badge-navy",
      "Growing": "badge-gold",
      "Stable": ""
    };
    return map[outlook] || "";
  }

  /* Career view modal */
  async function openCareerView(careerId) {
    const career = _allCareers.find(c => c.id === careerId);
    if (!career) return;
    const titleEl = document.getElementById("careerViewTitle");
    const bodyEl  = document.getElementById("careerViewBody");
    if (titleEl) titleEl.textContent = career.title;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <p style="font-size:.85rem;color:var(--clr-gray-600);line-height:1.7;font-family:var(--font-sans);margin-bottom:1rem">${esc(career.longDescription || career.description)}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;font-size:.85rem;font-family:var(--font-sans)">
          <div><strong>Category:</strong> ${esc(career.category)}</div>
          <div><strong>Outlook:</strong> ${esc(career.jobOutlook || '—')}</div>
          <div><strong>Duration:</strong> ${esc(career.duration || '—')}</div>
          <div><strong>Min APS:</strong> ${career.minimumAPS || '—'}</div>
        </div>
        <div style="margin-top:1rem">
          <strong style="font-size:.85rem">Salary (ZAR/month):</strong>
          <div style="display:flex;gap:.75rem;margin-top:.5rem;flex-wrap:wrap">
            ${career.salaryRange ? `
              <span style="background:var(--clr-gray-100);padding:.25rem .75rem;border-radius:var(--r-full);font-size:.8rem">Junior: R${career.salaryRange.junior?.toLocaleString() || '—'}</span>
              <span style="background:var(--clr-gray-100);padding:.25rem .75rem;border-radius:var(--r-full);font-size:.8rem">Mid: R${career.salaryRange.mid?.toLocaleString() || '—'}</span>
              <span style="background:var(--clr-gray-100);padding:.25rem .75rem;border-radius:var(--r-full);font-size:.8rem">Senior: R${career.salaryRange.senior?.toLocaleString() || '—'}</span>
            ` : '—'}
          </div>
        </div>`;
    }
    document.getElementById("careerViewModal")?.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  document.getElementById("careerViewClose")?.addEventListener("click", () => {
    document.getElementById("careerViewModal")?.classList.remove("open");
    document.body.style.overflow = "";
  });
  document.getElementById("careerViewModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("careerViewModal")) {
      e.target.classList.remove("open");
      document.body.style.overflow = "";
    }
  });

  /* Career search */
  let careerDebounce;
  document.getElementById("careerSearch")?.addEventListener("input", function () {
    clearTimeout(careerDebounce);
    careerDebounce = setTimeout(() => {
      const q = this.value.toLowerCase().trim();
      renderCareerTable(q ? _allCareers.filter(c =>
        c.title.toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q)
      ) : _allCareers);
    }, 200);
  });

  /* ── Users table ── */
  let _allUsers = [];

  function loadUsers() {
    _allUsers = Auth.getAllUsers();
    const totalSaves = _allUsers.reduce((sum, u) => sum + (u.savedCareers || []).length, 0);
    const totalGoals = _allUsers.reduce((sum, u) => sum + (u.studyGoals || []).length, 0);
    setText("adminUserCount",  String(_allUsers.length));
    setText("ovUsers",         String(_allUsers.length));
    setText("ovSaves",         String(totalSaves));
    setText("ovGoals",         String(totalGoals));
    setText("infoTotalUsers",  String(_allUsers.length));
    renderUsersTable(_allUsers);
    renderOvUsersTable(_allUsers.slice(0, 5));
    renderAnalytics(_allUsers);
  }

  function renderOvUsersTable(users) {
    const tbody = document.getElementById("ovUsersTbody");
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:var(--sp-8);color:var(--clr-gray-400);font-family:var(--font-sans)">No users yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td class="col-name">${esc(u.name)}</td>
        <td style="font-size:var(--text-xs);color:var(--clr-gray-500)">${esc(u.email)}</td>
        <td style="font-size:var(--text-xs)">${esc(u.grade || '—')}</td>
        <td style="font-size:var(--text-xs)">${(u.savedCareers || []).length}</td>
        <td style="font-size:var(--text-xs)">${(u.studyGoals || []).length}</td>
      </tr>`).join("");
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById("usersTbody");
    if (!tbody) return;
    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:var(--sp-8);color:var(--clr-gray-500);font-family:var(--font-sans)">No users found.</td></tr>`;
      return;
    }
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div style="width:32px;height:32px;border-radius:50%;background:${u.role === 'admin' ? 'var(--clr-gold)' : 'var(--clr-blue)'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:var(--text-xs);flex-shrink:0">
              ${esc(u.name[0].toUpperCase())}
            </div>
            <span class="col-name">${esc(u.name)}</span>
          </div>
        </td>
        <td style="font-size:var(--text-xs);color:var(--clr-gray-500)">${esc(u.email)}</td>
        <td style="font-size:var(--text-xs)">${esc(u.grade || '—')}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-gold' : 'badge-teal'}">${esc(u.role)}</span></td>
        <td style="font-size:var(--text-xs);color:var(--clr-gray-500)">${esc(u.joinedAt || '—')}</td>
        <td style="font-size:var(--text-xs)">${(u.savedCareers || []).length}</td>
        <td>
          ${u.role !== 'admin'
            ? `<button class="btn btn-danger btn-sm" data-delete="${esc(String(u.id))}"><i class="fas fa-trash"></i></button>`
            : `<span style="font-size:var(--text-xs);color:var(--clr-gray-400)">Protected</span>`}
        </td>
      </tr>`).join("");

    tbody.querySelectorAll("[data-delete]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (!confirm("Delete this user permanently?")) return;
        Auth.deleteUser(Number(btn.dataset.delete));
        toast("User deleted.", "success");
        loadUsers();
      });
    });
  }

  /* User search */
  let userDebounce;
  document.getElementById("userSearch")?.addEventListener("input", function () {
    clearTimeout(userDebounce);
    userDebounce = setTimeout(() => {
      const q = this.value.toLowerCase().trim();
      renderUsersTable(q ? _allUsers.filter(u =>
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      ) : _allUsers);
    }, 200);
  });

  /* ── Analytics ── */
  function renderAnalytics(users) {
    /* Most saved careers */
    const countMap = {};
    users.forEach(u => (u.savedCareers || []).forEach(id => {
      countMap[id] = (countMap[id] || 0) + 1;
    }));
    const sortedSaves = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const savesEl = document.getElementById("savesChart");
    if (savesEl) {
      if (!sortedSaves.length) {
        savesEl.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-gray-400);font-family:var(--font-sans);padding:var(--sp-4) 0">No saves yet.</p>`;
      } else {
        const max = sortedSaves[0][1];
        savesEl.innerHTML = sortedSaves.map(([id, count]) => {
          const career = _allCareers.find(c => c.id === id);
          const pct = Math.round((count / max) * 100);
          return `<div class="chart-bar-row">
            <span class="chart-bar-label">${esc(career?.title || id)}</span>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
            <span class="chart-bar-val">${count}</span>
          </div>`;
        }).join("");
      }
    }

    /* Users by grade */
    const gradeMap = {};
    users.forEach(u => {
      const g = u.grade || 'Unknown';
      gradeMap[g] = (gradeMap[g] || 0) + 1;
    });
    const sortedGrades = Object.entries(gradeMap).sort((a, b) => b[1] - a[1]);
    const gradeEl = document.getElementById("gradeChart");
    if (gradeEl) {
      if (!sortedGrades.length) {
        gradeEl.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-gray-400);font-family:var(--font-sans);padding:var(--sp-4) 0">No users yet.</p>`;
      } else {
        const maxG = sortedGrades[0][1];
        gradeEl.innerHTML = sortedGrades.map(([grade, count]) => {
          const pct = Math.round((count / maxG) * 100);
          return `<div class="chart-bar-row">
            <span class="chart-bar-label">${esc(grade)}</span>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
            <span class="chart-bar-val">${count}</span>
          </div>`;
        }).join("");
      }
    }

    /* Careers by category */
    const catMap = {};
    _allCareers.forEach(c => {
      const cat = c.category || 'Other';
      catMap[cat] = (catMap[cat] || 0) + 1;
    });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const catEl = document.getElementById("categoryChart");
    if (catEl) {
      if (!sortedCats.length) {
        catEl.innerHTML = `<p style="font-size:var(--text-sm);color:var(--clr-gray-400);font-family:var(--font-sans);padding:var(--sp-4) 0">No careers yet.</p>`;
      } else {
        const maxC = sortedCats[0][1];
        catEl.innerHTML = sortedCats.map(([cat, count]) => {
          const pct = Math.round((count / maxC) * 100);
          return `<div class="chart-bar-row">
            <span class="chart-bar-label">${esc(cat)}</span>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%"></div></div>
            <span class="chart-bar-val">${count}</span>
          </div>`;
        }).join("");
      }
    }
  }

  /* ── Settings ── */
  document.getElementById("resetDataBtn")?.addEventListener("click", () => {
    if (!confirm("This will delete ALL user accounts from localStorage. Are you sure?")) return;
    localStorage.removeItem("cg_users");
    localStorage.removeItem("cg_session");
    toast("All user data reset. Redirecting…", "success");
    setTimeout(() => window.location.href = "auth.html", 2000);
  });

  document.getElementById("saveAdminSettings")?.addEventListener("click", () => {
    const name = document.getElementById("setAdminName")?.value?.trim();
    if (!name) { toast("Name cannot be empty.", "error"); return; }
    const result = Auth.updateUser({ name });
    if (result.ok) {
      // Re-read the updated user into our local variable and refresh displayed info
      Object.assign(user, Auth.getUser());
      populateAdmin();
      toast("Settings saved.", "success");
    } else {
      toast(result.message || "Failed to save settings.", "error");
    }
  });

  document.getElementById("changePwBtn")?.addEventListener("click", async () => {
    const cur = document.getElementById("setCurrentPw")?.value;
    const nw  = document.getElementById("setNewPw")?.value;
    const cfm = document.getElementById("setConfirmPw")?.value;
    if (!cur || !nw || !cfm) { toast("Please fill in all password fields.", "error"); return; }
    if (nw !== cfm) { toast("New passwords do not match.", "error"); return; }
    if (nw.length < 6) { toast("New password must be at least 6 characters.", "error"); return; }
    const result = await Auth.changePassword(cur, nw);
    if (result.ok) {
      document.getElementById("setCurrentPw").value = "";
      document.getElementById("setNewPw").value = "";
      document.getElementById("setConfirmPw").value = "";
      toast("Password updated successfully.", "success");
    } else {
      toast(result.message || "Failed to change password.", "error");
    }
  });

  /* ── Init ── */
  async function init() {
    populateAdmin();
    loadUsers();
    await loadCareers();
    renderTopCareers(); /* requires both _allUsers and _allCareers */
  }

  init().catch(console.error);
})();
