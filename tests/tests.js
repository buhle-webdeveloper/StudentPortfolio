/**
 * Student Portfolio -- Unit Tests
 * Runs in the browser with a minimal inline test framework.
 * auth.js, api.js, and careers-data.js must be loaded before this file.
 */
(function () {
  "use strict";

  /* ================================================================
   *  Minimal Test Framework
   * ================================================================ */
  const results = [];
  let currentSuite = "";

  function suite(name) {
    currentSuite = name;
  }

  function _record(name, passed, detail) {
    results.push({ suite: currentSuite, name, passed, detail });
  }

  async function test(name, fn) {
    try {
      await fn();
      _record(name, true, "");
    } catch (err) {
      _record(name, false, err.message || String(err));
    }
  }

  function assert(condition, msg) {
    if (!condition) throw new Error(msg || "Assertion failed");
  }

  function assertEqual(actual, expected, msg) {
    if (actual !== expected)
      throw new Error(
        (msg ? msg + " -- " : "") +
          "Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(actual)
      );
  }

  function assertType(value, type, msg) {
    if (typeof value !== type)
      throw new Error(
        (msg ? msg + " -- " : "") +
          "Expected type " + type + " but got " + typeof value
      );
  }

  /* ================================================================
   *  localStorage cleanup helpers
   * ================================================================ */
  const SESS_KEY  = "cg_session";
  const USERS_KEY = "cg_users";

  function cleanAuth() {
    localStorage.removeItem(SESS_KEY);
    localStorage.removeItem(USERS_KEY);
  }

  /* ================================================================
   *  AUTH TESTS
   * ================================================================ */
  async function authTests() {
    suite("Auth");
    cleanAuth();

    // 1. Register a new user
    await test("register() creates a new user", async () => {
      const res = await Auth.register({
        name: "Test User",
        email: "test@example.com",
        password: "password123",
        grade: "12"
      });
      assert(res.ok, "register should succeed: " + res.message);
      assertEqual(res.user.name, "Test User");
      assertEqual(res.user.email, "test@example.com");
      assertEqual(res.user.role, "student");
      assert(res.user.id > 0, "id should be a positive number");
    });

    // 2. Logged in after register
    await test("isLoggedIn() returns true after register", async () => {
      assert(Auth.isLoggedIn(), "should be logged in after register");
    });

    // 3. Logout
    // Auth.logout() does a redirect, so we simulate it
    await test("logout clears session", async () => {
      localStorage.removeItem(SESS_KEY);
      assert(!Auth.isLoggedIn(), "should not be logged in after removing session");
    });

    // 4. Login with correct credentials
    await test("login() succeeds with correct credentials", async () => {
      const res = await Auth.login("test@example.com", "password123");
      assert(res.ok, "login should succeed");
      assertEqual(res.user.email, "test@example.com");
      assert(Auth.isLoggedIn(), "should be logged in");
    });

    // 5. Login with wrong password
    await test("login() fails with wrong password", async () => {
      localStorage.removeItem(SESS_KEY);
      const res = await Auth.login("test@example.com", "wrongpassword");
      assert(!res.ok, "login should fail with wrong password");
      assert(res.message.length > 0, "should have error message");
    });

    // 6. Login with missing fields
    await test("login() fails when fields are empty", async () => {
      const res = await Auth.login("", "");
      assert(!res.ok, "login should fail with empty fields");
    });

    // 7. Duplicate email registration
    await test("register() fails for duplicate email", async () => {
      const res = await Auth.register({
        name: "Duplicate User",
        email: "test@example.com",
        password: "password456",
        grade: "11"
      });
      assert(!res.ok, "register should fail for duplicate email");
      assert(res.message.toLowerCase().includes("already exists"), "should mention email already exists");
    });

    // 8. Register with invalid email
    await test("register() fails for invalid email format", async () => {
      const res = await Auth.register({
        name: "Bad Email",
        email: "not-an-email",
        password: "password123"
      });
      assert(!res.ok, "register should fail for invalid email");
    });

    // 9. Register with short password
    await test("register() fails for short password", async () => {
      const res = await Auth.register({
        name: "Short PW",
        email: "short@example.com",
        password: "12345"
      });
      assert(!res.ok, "register should fail for password < 6 chars");
    });

    // 10. Update profile
    await test("updateUser() changes name and grade", async () => {
      // Ensure logged in first
      await Auth.login("test@example.com", "password123");
      const res = Auth.updateUser({ name: "Updated Name", grade: "11" });
      assert(res.ok, "updateUser should succeed");
      const user = Auth.getUser();
      assertEqual(user.name, "Updated Name");
      assertEqual(user.grade, "11");
    });

    // 11. Change password
    await test("changePassword() works with correct current password", async () => {
      const res = await Auth.changePassword("password123", "newpassword456");
      assert(res.ok, "changePassword should succeed: " + res.message);
      // Verify new password works
      localStorage.removeItem(SESS_KEY);
      const loginRes = await Auth.login("test@example.com", "newpassword456");
      assert(loginRes.ok, "login with new password should succeed");
    });

    // 12. Change password with wrong current
    await test("changePassword() fails with wrong current password", async () => {
      const res = await Auth.changePassword("wrongOldPW", "anotherNew123");
      assert(!res.ok, "changePassword should fail with wrong current password");
    });

    // 13. Save / unsave career
    await test("saveCareer() and unsaveCareer() work", async () => {
      const saved = Auth.saveCareer("engineering");
      assert(saved, "saveCareer should return true");
      let user = Auth.getUser();
      assert(user.savedCareers.includes("engineering"), "savedCareers should contain 'engineering'");

      Auth.unsaveCareer("engineering");
      user = Auth.getUser();
      assert(!user.savedCareers.includes("engineering"), "savedCareers should no longer contain 'engineering'");
    });

    // 14. Add / remove goal
    await test("addGoal() and removeGoal() work", async () => {
      Auth.addGoal("Pass matric with distinction");
      let user = Auth.getUser();
      assert(user.studyGoals.length === 1, "should have 1 goal");
      assertEqual(user.studyGoals[0], "Pass matric with distinction");

      Auth.removeGoal(0);
      user = Auth.getUser();
      assert(user.studyGoals.length === 0, "should have 0 goals after removal");
    });

    // 15. isAdmin
    await test("isAdmin() returns false for student users", async () => {
      assert(!Auth.isAdmin(), "student user should not be admin");
    });

    // Cleanup
    cleanAuth();
  }

  /* ================================================================
   *  API TESTS
   * ================================================================ */
  async function apiTests() {
    suite("API");

    // 1. getCareers returns array
    await test("getCareers() returns a non-empty array", async () => {
      const careers = await API.getCareers();
      assert(Array.isArray(careers), "getCareers should return an array");
      assert(careers.length > 0, "careers array should not be empty");
    });

    // 2. Each career has required fields
    await test("each career has id, title, category, and description", async () => {
      const careers = await API.getCareers();
      for (const c of careers) {
        assert(c.id, "career must have id");
        assert(c.title, "career must have title");
        assert(c.category, "career must have category");
        assert(c.description, "career must have description");
      }
    });

    // 3. getCareer(id) returns an object
    await test("getCareer(id) returns a career object", async () => {
      const career = await API.getCareer("education");
      assert(career !== null, "getCareer('education') should not return null");
      assertEqual(career.id, "education");
      assertEqual(career.title, "Education");
    });

    // 4. getCareer with unknown id returns null
    await test("getCareer() returns null for unknown id", async () => {
      const career = await API.getCareer("nonexistent_career_xyz");
      assert(career === null, "should return null for unknown id");
    });

    // 5. getCategories returns array
    await test("getCategories() returns a non-empty sorted array", async () => {
      const cats = await API.getCategories();
      assert(Array.isArray(cats), "getCategories should return an array");
      assert(cats.length > 0, "categories should not be empty");
      // Check sorted
      for (let i = 1; i < cats.length; i++) {
        assert(cats[i] >= cats[i - 1], "categories should be sorted alphabetically");
      }
    });

    // 6. getStudyTopics returns array
    await test("getStudyTopics() returns an array", async () => {
      const topics = await API.getStudyTopics();
      assert(Array.isArray(topics), "getStudyTopics should return an array");
    });

    // 7. search filters correctly
    await test("search('engineering') filters results", async () => {
      const result = await API.search("engineering");
      assert(result.careers, "search result should have careers key");
      assert(Array.isArray(result.careers), "search careers should be array");
      // All returned careers should match 'engineering' somewhere
      for (const c of result.careers) {
        const haystack = [
          c.title, c.description, c.category,
          ...(c.sampleRoles || []),
          ...(c.skills || []),
          ...(c.subjects?.required || []),
          ...(c.subjects?.recommended || [])
        ].join(" ").toLowerCase();
        assert(haystack.includes("engineering"), "each result should match query");
      }
    });

    // 8. search with empty query returns all
    await test("search('') returns all careers and topics", async () => {
      const allCareers = await API.getCareers();
      const allTopics  = await API.getStudyTopics();
      const result     = await API.search("");
      assertEqual(result.careers.length, allCareers.length, "empty search should return all careers");
      assertEqual(result.studyTopics.length, allTopics.length, "empty search should return all topics");
    });

    // 9. getCareersByCategory filters
    await test("getCareersByCategory('STEM') filters to STEM only", async () => {
      const stem = await API.getCareersByCategory("STEM");
      assert(Array.isArray(stem), "should return an array");
      for (const c of stem) {
        assertEqual(c.category.toLowerCase(), "stem", "each career should be STEM category");
      }
    });

    // 10. getCareersByCategory('all') returns everything
    await test("getCareersByCategory('all') returns all careers", async () => {
      const all     = await API.getCareersByCategory("all");
      const careers = await API.getCareers();
      assertEqual(all.length, careers.length, "category 'all' should return everything");
    });

    // 11. getSAEducationStats returns data (with fallback)
    await test("getSAEducationStats() returns array with year and value", async () => {
      const stats = await API.getSAEducationStats();
      assert(Array.isArray(stats), "should return an array");
      assert(stats.length > 0, "should have at least one entry");
      assert(stats[0].year, "first entry should have year");
      assertType(stats[0].value, "number", "value should be a number");
    });
  }

  /* ================================================================
   *  DOM / FUNCTION EXISTENCE TESTS
   * ================================================================ */
  async function domTests() {
    suite("DOM / Functions");

    await test("window.Auth is defined", async () => {
      assert(window.Auth !== undefined, "Auth should be on window");
    });

    await test("window.API is defined", async () => {
      assert(window.API !== undefined, "API should be on window");
    });

    await test("Auth has expected methods", async () => {
      const methods = [
        "getUser", "isLoggedIn", "isAdmin", "login", "register",
        "logout", "updateUser", "changePassword", "saveCareer",
        "unsaveCareer", "addGoal", "removeGoal", "getAllUsers",
        "deleteUser", "requireAuth", "requireAdmin", "refreshSession"
      ];
      for (const m of methods) {
        assertType(Auth[m], "function", "Auth." + m + " should be a function");
      }
    });

    await test("API has expected methods", async () => {
      const methods = [
        "getCareers", "getCareer", "getCareersByCategory",
        "search", "getStudyTopics", "getCategories", "getSAEducationStats"
      ];
      for (const m of methods) {
        assertType(API[m], "function", "API." + m + " should be a function");
      }
    });

    await test("window.CAREERS_INLINE is loaded", async () => {
      assert(window.CAREERS_INLINE, "CAREERS_INLINE should be defined");
      assert(Array.isArray(window.CAREERS_INLINE.careers), "CAREERS_INLINE.careers should be an array");
    });
  }

  /* ================================================================
   *  RENDER RESULTS
   * ================================================================ */
  function renderResults() {
    const container = document.getElementById("test-results");
    const summary   = document.getElementById("test-summary");
    if (!container || !summary) return;

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total  = results.length;

    summary.innerHTML =
      '<span class="pass-count">' + passed + ' passed</span>' +
      '<span class="fail-count">' + failed + ' failed</span>' +
      '<span class="total-count">' + total + ' total</span>';
    summary.className = failed > 0 ? "summary has-failures" : "summary all-pass";

    let currentSuiteName = "";
    let html = "";
    for (const r of results) {
      if (r.suite !== currentSuiteName) {
        if (currentSuiteName) html += "</div>";
        currentSuiteName = r.suite;
        html += '<div class="suite"><h2>' + r.suite + '</h2>';
      }
      const icon  = r.passed ? "PASS" : "FAIL";
      const cls   = r.passed ? "pass" : "fail";
      const detail = r.detail ? '<span class="detail"> -- ' + r.detail + '</span>' : "";
      html += '<div class="test-row ' + cls + '">' +
                '<span class="icon">' + icon + '</span> ' +
                '<span class="test-name">' + r.name + '</span>' +
                detail +
              '</div>';
    }
    if (currentSuiteName) html += "</div>";
    container.innerHTML = html;
  }

  /* ================================================================
   *  RUN ALL
   * ================================================================ */
  async function runAll() {
    const status = document.getElementById("test-status");
    if (status) status.textContent = "Running tests...";

    await authTests();
    await apiTests();
    await domTests();

    renderResults();
    if (status) status.textContent = "Tests complete.";
  }

  // Run on load
  window.addEventListener("DOMContentLoaded", runAll);
})();
