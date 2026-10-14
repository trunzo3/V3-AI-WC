// ---------------------------------------------------------------------------
// Hide the "Your prompt" box (showPromptBox: false) on nine forms in the
// Caltrans Day 5 v2 cohort (T4DAY5V2) only, through the admin API.
// Same safety rules as scripts/caltrans-day5-v2.mjs: dry run by default,
// APPLY=1 to write, sections found via the v2 cohort's own Level 4 rows,
// abort if a section to edit is attached to any other cohort, only the
// showPromptBox flag on the named form block changes.
//
//   [API_BASE=https://host] [APPLY=1] ADMIN_PASSWORD=... node scripts/day5-v2-hide-prompt-boxes.mjs
// ---------------------------------------------------------------------------
const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const APPLY = process.env.APPLY === "1";
// Cohort codes. Defaults match dev; on the published app the v2 copy was
// renamed to T4DAY5 and the original to AI-LEADER, so override via env:
//   TARGET_CODE=T4DAY5 ORIGINAL_CODE=AI-LEADER
const CODE = (process.env.TARGET_CODE ?? "T4DAY5V2").toUpperCase();
const ORIGINAL_CODE = (process.env.ORIGINAL_CODE ?? "T4DAY5").toUpperCase();
if (CODE === ORIGINAL_CODE) throw new Error("TARGET_CODE and ORIGINAL_CODE must differ");

// section title -> formName, expected collectResponses, desired showPromptBox
const FORMS = [
  ["Consider the Work", "Consider the Work", true, false],
  ["Build Your Mini-PRD", "Mini-PRD", true, false],
  ["Two Sentences", "Two sentences", true, false],
  ["Talk It Out", "What clicked", true, false],
  ["Draft with Instructions and Role", "Role notes", false, false],
  ["Real Work", "Real work", false, false],
  ["Cognitive Growth", "Next week", false, false],
  ["Red / Yellow / Green", "Red / Yellow / Green", false, false],
  ["Shadow AI", "Bring it home", false, false],
  // Left unchanged (prompt box stays on); listed so they are verified.
  ["Create Your Context", "Portable context", null, true],
  ["Create Your Change Message", "Change message", true, true],
];

let cookie = "";
async function api(method, path, body) {
  const r = await fetch(B + path, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const scs = r.headers.getSetCookie?.() ?? [];
  if (scs.length) cookie = scs.map((c) => c.split(";")[0]).join("; ");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}
const canon = (v) =>
  Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
console.log(APPLY ? "MODE: APPLY (writing)" : "MODE: DRY RUN (nothing will change; set APPLY=1 to write)");
console.log("target", B);
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });

const cohorts = (await api("GET", "/admin/cohorts")).cohorts;
const cohort = cohorts.find((c) => c.cohortCode.toUpperCase() === CODE);
if (!cohort) throw new Error(`cohort ${CODE} not found`);
const original = cohorts.find((c) => c.cohortCode.toUpperCase() === ORIGINAL_CODE);
console.log(`cohort ${cohort.id} "${cohort.name}"`);

const genericsById = async () => new Map((await api("GET", "/admin/generic-sections")).sections.map((g) => [g.id, g]));
let generics = await genericsById();
const rows = (await api("GET", `/admin/cohorts/${cohort.id}/sections`)).sections;
const l4Generic = rows.filter((r) => r.level === 4 && r.sectionId.startsWith("generic_"));
const gid = (sid) => Number(sid.slice(8));

// Snapshot of the original cohort so we can prove it is untouched.
let originalBefore = null;
if (original) {
  const oRows = (await api("GET", `/admin/cohorts/${original.id}/sections`)).sections;
  const oGen = oRows.map((r) => r.sectionId).filter((s) => s.startsWith("generic_")).map((s) => generics.get(gid(s)));
  originalBefore = JSON.stringify(canon({ oRows, oGen }));
}

// Attachment index across every cohort.
const attached = new Map();
for (const c of cohorts) {
  const rs = c.id === cohort.id ? rows : (await api("GET", `/admin/cohorts/${c.id}/sections`)).sections;
  for (const r of rs) attached.set(r.sectionId, [...(attached.get(r.sectionId) ?? []), c.id]);
}

// ----- resolve + validate every form before touching anything ---------------
console.log("\nPLAN");
const plan = [];
const problems = [];
for (const [title, formName, expectCollect, desired] of FORMS) {
  const matches = l4Generic.filter((r) => generics.get(gid(r.sectionId))?.title === title);
  if (matches.length !== 1) { problems.push(`"${title}": expected one Level 4 row, found ${matches.length}`); continue; }
  const row = matches[0];
  const g = generics.get(gid(row.sectionId));
  const idxs = g.contentBlocks.map((b, i) => (b.type === "form" && (b.formName ?? "") === formName ? i : -1)).filter((i) => i >= 0);
  if (idxs.length === 0) {
    // The form was removed from this cohort's copy (happened on production
    // for "Role notes"); nothing to change, so report and move on.
    console.log(`  ${row.sectionId} "${title}": no form named "${formName}" in this section — skipped`);
    continue;
  }
  if (idxs.length > 1) { problems.push(`"${title}": expected one form block named "${formName}", found ${idxs.length}`); continue; }
  const bi = idxs[0];
  const block = g.contentBlocks[bi];
  const collect = block.collectResponses ?? false;
  const current = block.showPromptBox ?? true;
  if (expectCollect !== null && collect !== expectCollect) {
    problems.push(`"${title}" / "${formName}": collectResponses is ${collect}, expected ${expectCollect}`);
  }
  const change = current !== desired;
  const users = attached.get(row.sectionId) ?? [];
  if (change && (users.length !== 1 || users[0] !== cohort.id)) {
    problems.push(`"${title}" (${row.sectionId}) is attached to cohorts ${users.join(", ")}; must be only ${cohort.id}`);
  }
  console.log(`  ${row.sectionId} "${title}" / form "${formName}" (block ${bi}): collectResponses=${collect}, showPromptBox ${current} -> ${desired}${change ? "  [CHANGE]" : "  (no change)"}`);
  plan.push({ title, formName, row, g, bi, desired, change });
}
if (problems.length) {
  console.error("\nSTOPPING — the cohort does not match the expected shape:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

// ----- apply ---------------------------------------------------------------
console.log("");
for (const p of plan) {
  if (!p.change) continue;
  const blocks = p.g.contentBlocks.map((b, i) => (i === p.bi ? { ...b, showPromptBox: p.desired } : b));
  if (!APPLY) { console.log(`  [dry-run] would PUT /admin/generic-sections/${p.g.id} — "${p.title}" block ${p.bi} showPromptBox=${p.desired}`); continue; }
  console.log(`  PUT /admin/generic-sections/${p.g.id} — "${p.title}" block ${p.bi} showPromptBox=${p.desired}`);
  const res = await api("PUT", `/admin/generic-sections/${p.g.id}`, { contentBlocks: blocks });
  if (!same(res.section.contentBlocks, blocks)) throw new Error(`content did not persist on ${p.row.sectionId}`);
  // Everything except the one flag must be unchanged.
  const stripped = (bs) => bs.map((b, i) => (i === p.bi ? { ...b, showPromptBox: undefined } : b));
  if (!same(stripped(res.section.contentBlocks), stripped(p.g.contentBlocks))) throw new Error(`unexpected change outside the flag on ${p.row.sectionId}`);
}

// ----- read back -----------------------------------------------------------
console.log("\nREAD-BACK");
generics = await genericsById();
let bad = 0;
for (const p of plan) {
  const b = generics.get(p.g.id).contentBlocks[p.bi];
  const ok = (b.showPromptBox ?? true) === (APPLY ? p.desired : (p.g.contentBlocks[p.bi].showPromptBox ?? true));
  if (!ok) bad++;
  console.log(`  ${ok ? "ok " : "BAD"} "${p.title}" / "${p.formName}": showPromptBox=${b.showPromptBox ?? "(unset=true)"} collectResponses=${b.collectResponses ?? false}`);
}
if (bad) throw new Error(`${bad} form(s) did not read back as expected`);
if (original) {
  const oRows = (await api("GET", `/admin/cohorts/${original.id}/sections`)).sections;
  const oGen = oRows.map((r) => r.sectionId).filter((s) => s.startsWith("generic_")).map((s) => generics.get(gid(s)));
  const unchanged = JSON.stringify(canon({ oRows, oGen })) === originalBefore;
  console.log(`  original ${ORIGINAL_CODE} (cohort ${original.id}) unchanged = ${unchanged}`);
  if (!unchanged) throw new Error("ORIGINAL COHORT CHANGED — investigate");
}
console.log(APPLY ? "\nDone." : "\nDry run complete. Nothing was written.");
