/**
 * @file auth.js
 * @module Auth
 * @description Student Portfolio— Authentication Module.
 * Manages user sessions, registration, login, and access control.
 * Uses localStorage as a persistent JSON-based user store.
 * All passwords are salted and hashed with SHA-256 via the Web Crypto API
 * before storage — plaintext passwords are never persisted.
 *
 * @global {Object} window.Auth — public API exposed to other modules
 *
 * Key functions:
 *  - Auth.login(email, password)       — authenticate and create session
 *  - Auth.register({...})              — create new user account
 *  - Auth.logout(redirect)             — destroy session and redirect
 *  - Auth.getUser()                    — return current session user or null
 *  - Auth.isAdmin()                    — check admin role
 *  - Auth.saveCareer(id) / unsaveCareer(id) — bookmark management
 *  - Auth.addGoal(text) / removeGoal(i)     — study goal management
 *  - Auth.requireAuth() / requireAdmin()    — route guards
 *  - Auth.updateUser(updates)          — update profile fields
 *  - Auth.changePassword(cur, new)     — change password with verification
 *  - Auth.deleteUser(id)               — admin-only user deletion
 *  - Auth.getAllUsers()                 — admin-only full user list
 *
 * Dependencies: none (standalone IIFE)
 */
(function () {
  "use strict";

  const SESS_KEY  = "cg_session";
  const USERS_KEY = "cg_users";

  /* ── Password hashing ── */
  /* Uses SHA-256 via Web Crypto API when available (HTTPS / localhost).
     Falls back to a simple hash when crypto.subtle is unavailable
     (e.g. file:// protocol where the browser blocks it). */
  async function _hashPassword(password) {
    const salted = password + "careerguide_salt_2026";
    if (typeof crypto !== "undefined" && crypto.subtle) {
      try {
        const data   = new TextEncoder().encode(salted);
        const buffer = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      } catch (_) { /* fall through to fallback */ }
    }
    /* Fallback: simple string hash (djb2 variant, still salted) */
    let h1 = 5381, h2 = 52711;
    for (let i = 0; i < salted.length; i++) {
      const ch = salted.charCodeAt(i);
      h1 = (h1 * 33) ^ ch;
      h2 = (h2 * 33) ^ ch;
    }
    return ((h1 >>> 0) * 4096 + (h2 >>> 0)).toString(16).padStart(16, "0");
  }

  /* ── Helpers ── */
  function _getUsers()  { return JSON.parse(localStorage.getItem(USERS_KEY) || "[]"); }
  function _saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  /* ── Seed admin account on first launch ── */
  /* The admin is created once when no admin exists in the database.
     _seedReady is a Promise other code can await if needed. */
  const _seedReady = (async () => {
    const users = _getUsers();
    if (users.some(u => u.role === "admin")) return;
    const hash = await _hashPassword("Admin@2026");
    users.push({
      id: 1,
      name: "Admin",
      email: "admin@careerguide.co.za",
      passwordHash: hash,
      role: "admin",
      grade: null,
      joinedAt: new Date().toISOString().split("T")[0],
      savedCareers: [],
      studyGoals: []
    });
    _saveUsers(users);
  })();

  /* ── Public API ── */
  const Auth = {

    /** Returns current user object or null */
    getUser() {
      return JSON.parse(localStorage.getItem(SESS_KEY) || "null");
    },

    /** Returns true if someone is logged in */
    isLoggedIn() {
      return !!this.getUser();
    },

    /** Returns true if current user is admin */
    isAdmin() {
      const u = this.getUser();
      return u && u.role === "admin";
    },

    /**
     * Login — returns { ok, user, message }
     */
    async login(email, password) {
      await _seedReady; // ensure admin seed has completed
      if (!email || !password) return { ok: false, message: "Please enter your email and password." };

      const users = _getUsers();
      const hash  = await _hashPassword(password);
      const user  = users.find(
        u => u.email.toLowerCase() === email.toLowerCase().trim() && u.passwordHash === hash
      );

      if (!user) return { ok: false, message: "Incorrect email or password. Please try again." };

      const session = { ...user };
      delete session.passwordHash;
      localStorage.setItem(SESS_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    },

    /**
     * Register — returns { ok, user, message }
     */
    async register({ name, email, password, grade, role }) {
      /* Validate inputs — fail fast with user-friendly messages */
      if (!name || name.trim().length < 2)
        return { ok: false, message: "Please enter your full name (at least 2 characters)." };
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return { ok: false, message: "Please enter a valid email address." };
      if (!password || password.length < 6)
        return { ok: false, message: "Password must be at least 6 characters." };

      const users = _getUsers();
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
        return { ok: false, message: "An account with that email already exists. Please log in instead." };
      }

      const hash = await _hashPassword(password);
      // Public registration always creates student accounts.
      // Admin accounts are seeded on first launch only.
      const assignedRole = "student";

      const newUser = {
        id: Date.now(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: hash,
        role: assignedRole,
        grade: grade || null,
        joinedAt: new Date().toISOString().split("T")[0],
        savedCareers: [],
        studyGoals: []
      };
      users.push(newUser);
      _saveUsers(users);

      // Strip the password hash before storing the session object so that
      // reading the session from any module never exposes sensitive data.
      const session = { ...newUser };
      delete session.passwordHash;
      localStorage.setItem(SESS_KEY, JSON.stringify(session));
      return { ok: true, user: session };
    },

    /** Log out and redirect */
    logout(redirect = "auth.html") {
      localStorage.removeItem(SESS_KEY);
      window.location.href = redirect;
    },

    /** Refresh session data (call after profile update) */
    refreshSession() {
      const current = this.getUser();
      if (!current) return;
      const users   = _getUsers();
      const updated = users.find(u => u.id === current.id);
      if (!updated) return;
      const session = { ...updated };
      delete session.passwordHash;
      localStorage.setItem(SESS_KEY, JSON.stringify(session));
    },

    /** Save a career to the user's list */
    saveCareer(careerId) {
      const current = this.getUser();
      if (!current) return false;
      const users = _getUsers();
      const idx   = users.findIndex(u => u.id === current.id);
      if (idx === -1) return false;
      if (!users[idx].savedCareers) users[idx].savedCareers = [];
      if (!users[idx].savedCareers.includes(careerId)) {
        users[idx].savedCareers.push(careerId);
        _saveUsers(users);
        this.refreshSession();
      }
      return true;
    },

    /** Remove a career from the user's list */
    unsaveCareer(careerId) {
      const current = this.getUser();
      if (!current) return false;
      const users = _getUsers();
      const idx   = users.findIndex(u => u.id === current.id);
      if (idx === -1) return false;
      users[idx].savedCareers = (users[idx].savedCareers || []).filter(id => id !== careerId);
      _saveUsers(users);
      this.refreshSession();
      return true;
    },

    /** Add a study goal */
    addGoal(goalText) {
      if (!goalText || !goalText.trim()) return false;
      const current = this.getUser();
      if (!current) return false;
      const users = _getUsers();
      const idx   = users.findIndex(u => u.id === current.id);
      if (idx === -1) return false;
      users[idx].studyGoals = users[idx].studyGoals || [];
      users[idx].studyGoals.push(goalText.trim());
      _saveUsers(users);
      this.refreshSession();
      return true;
    },

    /** Remove a study goal by index */
    removeGoal(goalIndex) {
      const current = this.getUser();
      if (!current) return false;
      const users = _getUsers();
      const idx   = users.findIndex(u => u.id === current.id);
      if (idx === -1) return false;
      users[idx].studyGoals = (users[idx].studyGoals || []).filter((_, i) => i !== goalIndex);
      _saveUsers(users);
      this.refreshSession();
      return true;
    },

    /** Get all registered users (admin only) */
    getAllUsers() {
      if (!this.isAdmin()) return [];
      return _getUsers().map(u => {
        const s = { ...u };
        delete s.passwordHash;
        return s;
      });
    },

    /**
     * Update current user's profile fields.
     */
    updateUser(updates) {
      const current = this.getUser();
      if (!current) return { ok: false, message: "Not logged in." };
      const users = _getUsers();
      const idx   = users.findIndex(u => u.id === current.id);
      if (idx === -1) return { ok: false, message: "User not found." };
      // Whitelist of editable fields — prevents callers from overwriting
      // role, passwordHash, or other protected properties.
      const allowed = ["name", "email", "grade"];
      allowed.forEach(key => {
        if (updates[key] !== undefined) users[idx][key] = updates[key];
      });
      _saveUsers(users);
      this.refreshSession();
      return { ok: true, message: "Profile updated successfully." };
    },

    /**
     * Change the current user's password.
     */
    async changePassword(currentPw, newPw) {
      const current = this.getUser();
      if (!current) return { ok: false, message: "Not logged in." };
      if (!newPw || newPw.length < 6) return { ok: false, message: "New password must be at least 6 characters." };
      const users = _getUsers();
      const idx   = users.findIndex(u => u.id === current.id);
      if (idx === -1) return { ok: false, message: "User not found." };
      const currentHash = await _hashPassword(currentPw);
      if (users[idx].passwordHash !== currentHash) {
        return { ok: false, message: "Current password is incorrect." };
      }
      users[idx].passwordHash = await _hashPassword(newPw);
      _saveUsers(users);
      return { ok: true, message: "Password updated successfully." };
    },

    /** Delete a user by id (admin only) */
    deleteUser(userId) {
      if (!this.isAdmin()) return false;
      const me = this.getUser();
      if (me && me.id === userId) return false; // prevent admin from deleting own account
      const users = _getUsers().filter(u => u.id !== userId);
      _saveUsers(users);
      return true;
    },

    /**
     * Guard: redirect to auth if not logged in.
     */
    requireAuth(redirect = "auth.html") {
      const user = this.getUser();
      if (!user) { window.location.href = redirect; return null; }
      return user;
    },

    /**
     * Guard: redirect if not admin.
     */
    requireAdmin(redirect = "index.html") {
      const user = this.requireAuth("auth.html");
      if (!user) return null;
      if (user.role !== "admin") { window.location.href = redirect; return null; }
      return user;
    }
  };

  /* ── Expose globally ── */
  window.Auth = Auth;
})();
