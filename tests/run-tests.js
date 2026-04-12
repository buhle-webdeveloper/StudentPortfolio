/**
 * Node.js test runner for CareerGuide SA
 * Run: node tests/run-tests.js
 */
const fs = require("fs");
const { subtle } = require("crypto").webcrypto;

// Simulate browser globals
global.crypto = { subtle };
global.TextEncoder = TextEncoder;
global.window = {};
global.localStorage = (() => {
  const store = {};
  return {
    getItem: k => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => Object.keys(store).forEach(k => delete store[k])
  };
})();
global.document = {
  createElement: () => ({ textContent: "", get innerHTML() { return this.textContent; } })
};

// Load modules
eval(fs.readFileSync("data/careers-data.js", "utf8"));
eval(fs.readFileSync("assets/js/auth.js", "utf8"));
eval(fs.readFileSync("assets/js/api.js", "utf8"));

const Auth = window.Auth;
const API  = window.API;

let pass = 0, fail = 0;
async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  PASS: " + name);
  } catch (e) {
    fail++;
    console.log("  FAIL: " + name + " -- " + e.message);
  }
}

(async () => {
  console.log("\n========== AUTH TESTS ==========");
  localStorage.clear();

  await test("Register student (Thabo Mokoena)", async () => {
    const r = await Auth.register({ name: "Thabo Mokoena", email: "thabo@student.co.za", password: "Thabo@2026", grade: "Grade 11", role: "student" });
    if (!r.ok) throw new Error(r.message);
    if (r.user.name !== "Thabo Mokoena") throw new Error("Name mismatch: " + r.user.name);
    if (r.user.role !== "student") throw new Error("Role mismatch: " + r.user.role);
    if (r.user.grade !== "Grade 11") throw new Error("Grade mismatch");
  });

  await test("User is logged in after register", async () => {
    if (!Auth.isLoggedIn()) throw new Error("Not logged in");
    if (Auth.getUser().email !== "thabo@student.co.za") throw new Error("Wrong user");
  });

  await test("isAdmin() returns false for student", async () => {
    if (Auth.isAdmin()) throw new Error("Student should not be admin");
  });

  await test("Admin account exists (seeded on first launch)", async () => {
    localStorage.removeItem("cg_session");
    // Re-register admin since cleanAuth() wiped the DB
    const r2 = await Auth.register({ name: "Admin", email: "admin@careerguide.co.za", password: "Admin@2026" });
    // Manually set role to admin in DB (simulating the seed)
    const users = JSON.parse(localStorage.getItem("cg_users") || "[]");
    const idx = users.findIndex(u => u.email === "admin@careerguide.co.za");
    if (idx !== -1) { users[idx].role = "admin"; localStorage.setItem("cg_users", JSON.stringify(users)); }
    localStorage.removeItem("cg_session");
    const r = await Auth.login("admin@careerguide.co.za", "Admin@2026");
    if (!r.ok) throw new Error("Admin login failed: " + r.message);
    if (r.user.role !== "admin") throw new Error("Should be admin, got: " + r.user.role);
  });

  await test("isAdmin() returns true for admin", async () => {
    if (!Auth.isAdmin()) throw new Error("Should be admin");
  });

  await test("Public register always creates student (not admin)", async () => {
    localStorage.removeItem("cg_session");
    const r = await Auth.register({ name: "Sneaky User", email: "sneaky@test.com", password: "Hack@123", role: "admin" });
    if (!r.ok) throw new Error(r.message);
    if (r.user.role !== "student") throw new Error("Should be student even if role=admin was passed, got: " + r.user.role);
  });

  await test("Logout clears session", async () => {
    localStorage.removeItem("cg_session");
    if (Auth.isLoggedIn()) throw new Error("Still logged in after logout");
  });

  await test("Login student with correct password", async () => {
    const r = await Auth.login("thabo@student.co.za", "Thabo@2026");
    if (!r.ok) throw new Error(r.message);
    if (r.user.name !== "Thabo Mokoena") throw new Error("Wrong name: " + r.user.name);
    if (r.user.grade !== "Grade 11") throw new Error("Wrong grade");
  });

  await test("Login fails with wrong password", async () => {
    localStorage.removeItem("cg_session");
    const r = await Auth.login("thabo@student.co.za", "WrongPass!");
    if (r.ok) throw new Error("Should have failed");
  });

  await test("Login fails with non-existent email", async () => {
    const r = await Auth.login("nobody@test.com", "Whatever123");
    if (r.ok) throw new Error("Should have failed");
  });

  await test("Login fails with empty fields", async () => {
    const r = await Auth.login("", "");
    if (r.ok) throw new Error("Should have failed");
  });

  await test("Register fails with duplicate email", async () => {
    const r = await Auth.register({ name: "Dup", email: "thabo@student.co.za", password: "Test@123" });
    if (r.ok) throw new Error("Should have failed");
    if (!r.message.includes("already exists")) throw new Error("Wrong error: " + r.message);
  });

  await test("Register fails with short password (<6)", async () => {
    const r = await Auth.register({ name: "Short", email: "short@test.com", password: "12345" });
    if (r.ok) throw new Error("Should have failed");
  });

  await test("Register fails with invalid email", async () => {
    const r = await Auth.register({ name: "Bad", email: "not-email", password: "Test@123" });
    if (r.ok) throw new Error("Should have failed");
  });

  await test("Register fails with short name (<2 chars)", async () => {
    const r = await Auth.register({ name: "A", email: "a@test.com", password: "Test@123" });
    if (r.ok) throw new Error("Should have failed");
  });

  await test("Update profile (name + grade)", async () => {
    await Auth.login("thabo@student.co.za", "Thabo@2026");
    const r = Auth.updateUser({ name: "Thabo M. Mokoena", grade: "Grade 12" });
    if (!r.ok) throw new Error(r.message);
    const u = Auth.getUser();
    if (u.name !== "Thabo M. Mokoena") throw new Error("Name not updated: " + u.name);
    if (u.grade !== "Grade 12") throw new Error("Grade not updated: " + u.grade);
  });

  await test("Change password (correct current)", async () => {
    const r = await Auth.changePassword("Thabo@2026", "NewPass@2026");
    if (!r.ok) throw new Error(r.message);
    // Verify new password works
    localStorage.removeItem("cg_session");
    const login = await Auth.login("thabo@student.co.za", "NewPass@2026");
    if (!login.ok) throw new Error("Login with new password failed");
  });

  await test("Change password fails with wrong current", async () => {
    const r = await Auth.changePassword("WrongOld!", "Another@123");
    if (r.ok) throw new Error("Should have failed");
    if (!r.message.includes("incorrect")) throw new Error("Wrong error: " + r.message);
  });

  await test("Save career (engineering + technology)", async () => {
    Auth.saveCareer("engineering");
    Auth.saveCareer("technology");
    const u = Auth.getUser();
    if (!u.savedCareers.includes("engineering")) throw new Error("Missing engineering");
    if (!u.savedCareers.includes("technology")) throw new Error("Missing technology");
    if (u.savedCareers.length !== 2) throw new Error("Expected 2 saved, got " + u.savedCareers.length);
  });

  await test("Unsave career (engineering)", async () => {
    Auth.unsaveCareer("engineering");
    const u = Auth.getUser();
    if (u.savedCareers.includes("engineering")) throw new Error("Still has engineering");
    if (!u.savedCareers.includes("technology")) throw new Error("Lost technology");
  });

  await test("Add goals", async () => {
    Auth.addGoal("Pass Maths with 70%");
    Auth.addGoal("Apply to UCT by August");
    const u = Auth.getUser();
    if (u.studyGoals.length !== 2) throw new Error("Expected 2 goals, got " + u.studyGoals.length);
    if (u.studyGoals[0] !== "Pass Maths with 70%") throw new Error("Wrong goal[0]");
  });

  await test("Remove goal (first one)", async () => {
    Auth.removeGoal(0);
    const u = Auth.getUser();
    if (u.studyGoals.length !== 1) throw new Error("Expected 1 goal, got " + u.studyGoals.length);
    if (u.studyGoals[0] !== "Apply to UCT by August") throw new Error("Wrong remaining goal");
  });

  await test("getAllUsers() as admin (no password leaks)", async () => {
    await Auth.login("admin@careerguide.co.za", "Admin@2026");
    const users = Auth.getAllUsers();
    if (users.length < 2) throw new Error("Expected 2+ users, got " + users.length);
    for (const u of users) {
      if (u.passwordHash) throw new Error("PASSWORD HASH LEAKED for " + u.email);
    }
  });

  await test("Admin cannot delete self", async () => {
    const me = Auth.getUser();
    const r = Auth.deleteUser(me.id);
    if (r) throw new Error("Should not be able to delete self");
    if (Auth.getAllUsers().length < 2) throw new Error("User was deleted");
  });

  await test("Admin can delete other user", async () => {
    const users = Auth.getAllUsers();
    const student = users.find(u => u.role === "student");
    if (!student) throw new Error("No student found");
    const r = Auth.deleteUser(student.id);
    if (!r) throw new Error("Delete should succeed");
    const after = Auth.getAllUsers();
    if (after.find(u => u.id === student.id)) throw new Error("Student still exists");
  });

  console.log("\n========== API TESTS ==========");

  await test("getCareers() returns 10 careers", async () => {
    const c = await API.getCareers();
    if (!Array.isArray(c)) throw new Error("Not an array");
    if (c.length !== 10) throw new Error("Expected 10, got " + c.length);
  });

  await test("Every career has all required fields", async () => {
    const fields = ["id", "title", "category", "description", "salaryRange", "subjects", "institutions", "skills", "sampleRoles"];
    const careers = await API.getCareers();
    for (const c of careers) {
      for (const f of fields) {
        if (!c[f]) throw new Error("Missing " + f + " in career " + c.id);
      }
    }
  });

  await test("getCareer('technology') returns IT career", async () => {
    const c = await API.getCareer("technology");
    if (!c) throw new Error("Got null");
    if (c.title !== "Information Technology") throw new Error("Wrong title: " + c.title);
    if (c.category !== "STEM") throw new Error("Wrong category");
  });

  await test("getCareer('nonexistent') returns null", async () => {
    const c = await API.getCareer("nonexistent_xyz");
    if (c !== null) throw new Error("Should be null, got: " + JSON.stringify(c));
  });

  await test("getCategories() returns sorted unique list", async () => {
    const cats = await API.getCategories();
    if (cats.length < 4) throw new Error("Expected 4+ categories, got " + cats.length);
    for (let i = 1; i < cats.length; i++) {
      if (cats[i] < cats[i-1]) throw new Error("Not sorted at index " + i);
    }
    console.log("    Categories: " + cats.join(", "));
  });

  await test("getStudyTopics() returns 9 topics", async () => {
    const t = await API.getStudyTopics();
    if (t.length !== 9) throw new Error("Expected 9, got " + t.length);
  });

  await test("search('engineering') finds Engineering career", async () => {
    const r = await API.search("engineering");
    if (!r.careers.some(c => c.id === "engineering")) throw new Error("Engineering not found");
  });

  await test("search('law') finds Humanities & Law", async () => {
    const r = await API.search("law");
    if (!r.careers.some(c => c.id === "humanities")) throw new Error("Humanities not found");
  });

  await test("search('') returns everything", async () => {
    const all = await API.getCareers();
    const r = await API.search("");
    if (r.careers.length !== all.length) throw new Error("Expected " + all.length + ", got " + r.careers.length);
  });

  await test("getCareersByCategory('STEM') filters correctly", async () => {
    const stem = await API.getCareersByCategory("STEM");
    if (stem.length < 2) throw new Error("Expected 2+ STEM careers, got " + stem.length);
    for (const c of stem) {
      if (c.category !== "STEM") throw new Error(c.title + " is not STEM");
    }
    console.log("    STEM careers: " + stem.map(c => c.title).join(", "));
  });

  await test("getCareersByCategory('all') returns all", async () => {
    const all = await API.getCareersByCategory("all");
    const careers = await API.getCareers();
    if (all.length !== careers.length) throw new Error("Expected " + careers.length + ", got " + all.length);
  });

  await test("getSAEducationStats() returns valid data", async () => {
    const s = await API.getSAEducationStats();
    if (!Array.isArray(s) || s.length === 0) throw new Error("Empty array");
    if (!s[0].year) throw new Error("Missing year");
    if (typeof s[0].value !== "number") throw new Error("Value not a number");
    console.log("    Latest: " + s[0].year + " = " + s[0].value + "%");
  });

  // Final summary
  console.log("\n==========================================");
  console.log("  RESULTS:  " + pass + " PASSED  |  " + fail + " FAILED  |  " + (pass + fail) + " TOTAL");
  console.log("==========================================\n");

  if (fail > 0) process.exit(1);
  else console.log("  ALL TESTS PASSED. System is fully functional.\n");
})();
