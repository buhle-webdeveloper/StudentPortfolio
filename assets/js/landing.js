/**
 * @file landing.js
 * @description Student Portfolio — Landing Page Controller.
 * Runs on index.html. Handles:
 *  - Mobile hamburger navigation toggle with outside-click dismiss
 *  - Smooth-scroll anchor links
 *  - Dynamic nav update when a user is already logged in
 *  - World Bank API stats widget (enrollment trend with fallback)
 *
 * Key functions (all internal to the IIFE):
 *  - updateNavForUser()   — swap CTA buttons for dashboard link + logout if logged in
 *  - loadApiWidget()      — fetch World Bank data and render the stats widget
 *
 * Dependencies: auth.js (window.Auth), api.js (window.API)
 */
(function () {
  "use strict";

  const navToggle = document.getElementById("navToggle");
  const navMenu   = document.getElementById("navMenuMobile");

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      const isOpen = navMenu.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      const icon = navToggle.querySelector("i");
      if (icon) icon.className = isOpen ? "fas fa-times" : "fas fa-bars";
    });
    // Close the mobile menu when the user clicks anywhere outside of it,
    // providing a natural "dismiss" gesture on touch devices.
    document.addEventListener("click", e => {
      if (!navToggle.contains(e.target) && !navMenu.contains(e.target)) {
        navMenu.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
        const icon = navToggle.querySelector("i");
        if (icon) icon.className = "fas fa-bars";
      }
    });
  }

  function updateNavForUser() {
    const user = typeof Auth !== "undefined" ? Auth.getUser() : null;
    if (!user) return;
    const ctaAreas = document.querySelectorAll(".nav-cta");
    ctaAreas.forEach(area => {
      area.innerHTML = `
        <a class="btn btn-ghost" href="${user.role === 'admin' ? 'admin.html' : 'dashboard.html'}">
          <i class="fas fa-gauge-high" aria-hidden="true"></i>
          ${user.role === 'admin' ? 'Admin Panel' : 'My Dashboard'}
        </a>
        <button class="btn btn-navy" id="landingLogout" type="button">
          <i class="fas fa-right-from-bracket" aria-hidden="true"></i> Log out
        </button>`;
    });
    document.querySelectorAll("#landingLogout").forEach(btn =>
      btn.addEventListener("click", () => Auth.logout("index.html"))
    );
  }

  async function loadApiWidget() {
    if (typeof API === "undefined") return;
    try {
      const stats    = await API.getSAEducationStats();
      const latest   = stats[0];
      const previous = stats[1];
      const val1  = document.getElementById("apiStatVal1");
      const lbl1  = document.getElementById("apiStatLbl1");
      const val2  = document.getElementById("apiStatVal2");
      const lbl2  = document.getElementById("apiStatLbl2");
      const trend = document.getElementById("apiTrend");

      if (val1 && latest) {
        val1.innerHTML = `${latest.value}<span>%</span>`;
        if (lbl1) lbl1.textContent = `${latest.year} enrollment`;
      }
      if (val2 && previous) {
        val2.innerHTML = `${previous.value}<span>%</span>`;
        if (lbl2) lbl2.textContent = `${previous.year} enrollment`;
      }
      if (trend && latest && previous) {
        const diff  = latest.value - previous.value;
        const sign  = diff >= 0 ? "+" : "";
        const color = diff >= 0 ? "var(--clr-success)" : "var(--clr-danger)";
        const arrow = diff >= 0 ? "↑" : "↓";
        trend.innerHTML = `<span style="color:${color};font-size:1.5rem">${arrow}</span><br>
          <span style="font-size:.75rem;color:rgba(255,255,255,.5)">${sign}${diff}% vs prior year</span>`;
      }
    } catch (err) {
      console.warn("World Bank API error:", err);
      const val1  = document.getElementById("apiStatVal1");
      const val2  = document.getElementById("apiStatVal2");
      const trend = document.getElementById("apiTrend");
      const lbl1  = document.getElementById("apiStatLbl1");
      const lbl2  = document.getElementById("apiStatLbl2");
      if (val1) val1.innerHTML = `<span style="font-size:1rem">—</span>`;
      if (val2) val2.innerHTML = `<span style="font-size:1rem">—</span>`;
      if (trend) trend.innerHTML = `<span style="font-size:.85rem">—</span>`;
      if (lbl1) lbl1.textContent = "Data temporarily unavailable";
      if (lbl2) lbl2.textContent = "Please try again later";
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener("click", function (e) {
      const id = this.getAttribute("href");
      if (id === "#") return;
      const target = document.querySelector(id);
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
  });

  document.addEventListener("DOMContentLoaded", () => {
    updateNavForUser();
    loadApiWidget();
  });
})();
