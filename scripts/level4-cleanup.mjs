// ---------------------------------------------------------------------------
// One-time Level 4 cleanup, every cohort, through the admin API only.
// Level 4 holds library (generic_) sections only, all visible:
//   a. convert a Level 4 "riceco-framework" built-in row with make-editable
//      (row is updated in place: position, code, visibility kept);
//   b. re-read the cohort's rows;
//   c. drop from Level 4 every row that is not generic_ and every hidden row;
//   d. PUT the raw array: Levels 1–3 exactly as they are + remaining Level 4
//      rows in current order, sortOrder renumbered 0..n-1;
//   e. verify every Level 4 row is visible and generic_, else stop.
// Never touches Level 1–3 rows; never deletes library sections, participants,
// notes, unlocks or responses. Dry run by default, APPLY=1 to write; safe to
// re-run (a clean cohort is a no-op).
//
//   [API_BASE=https://host] [APPLY=1] ADMIN_PASSWORD=... node scripts/level4-cleanup.mjs
// ---------------------------------------------------------------------------
const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const APPLY = process.env.APPLY === "1";
const RICECO = "riceco-framework";
const isLibrary = (sectionId) => /^generic_\d+$/.test(sectionId);

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
const toRow = (r) => ({
  sectionId: r.sectionId,
  level: r.level,
  sortOrder: r.sortOrder,
  displayName: r.displayName ?? null,
  visible: r.visible,
  code: r.code ?? null,
  codeActive: r.codeActive,
});
const byPos = (a, b) => a.level - b.level || a.sortOrder - b.sortOrder || a.id - b.id;
const desc = (r) => `"${r.title}" (${r.sectionId}, ${r.visible ? "visible" : "HIDDEN"}${r.code ? `, code ${r.code}` : ""})`;
const getRows = async (cohortId) =>
  (await api("GET", `/admin/cohorts/${cohortId}/sections`)).sections.slice().sort(byPos);

if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
console.log(APPLY ? "MODE: APPLY (writing)" : "MODE: DRY RUN (nothing will change; set APPLY=1 to write)");
console.log("target", B);
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });

const cohorts = (await api("GET", "/admin/cohorts")).cohorts
  .slice()
  .sort((a, b) => a.id - b.id);
console.log(`${cohorts.length} cohorts\n`);

let changedCohorts = 0;
for (const c of cohorts) {
  console.log(`=== Cohort ${c.id}: ${c.name} [${c.cohortCode}]`);
  let rows = await getRows(c.id);
  const lower = rows.filter((r) => r.level !== 4);
  const hiddenLower = lower.filter((r) => !r.visible);
  if (hiddenLower.length) {
    console.log(`  info: hidden rows in Levels 1–3 (left unchanged):`);
    for (const r of hiddenLower) console.log(`    L${r.level} ${desc(r)}`);
  }

  // a. RICECO conversion (before anything is removed).
  const riceco = rows.filter((r) => r.level === 4 && r.sectionId === RICECO);
  if (riceco.length) {
    console.log(`  convert (make-editable):`);
    for (const r of riceco) console.log(`    ${desc(r)} at sortOrder ${r.sortOrder}`);
    if (APPLY) {
      for (const r of riceco) {
        const res = await api("POST", `/admin/cohorts/${c.id}/sections/${r.sectionId}/make-editable`);
        console.log(`    -> ${res.sectionId}`);
      }
      // b. re-read after conversions.
      rows = await getRows(c.id);
    } else {
      // Dry run: model the conversion so the plan below reflects it.
      rows = rows.map((r) =>
        r.level === 4 && r.sectionId === RICECO
          ? { ...r, sectionId: "generic_<new>", title: r.title }
          : r,
      );
    }
  }

  // c. plan Level 4 removals.
  const level4 = rows.filter((r) => r.level === 4);
  const keep4 = level4.filter((r) => isLibrary(r.sectionId) || r.sectionId === "generic_<new>");
  const remove4 = level4.filter((r) => !keep4.includes(r));
  const finalKeep4 = keep4.filter((r) => r.visible);
  const removeHidden = keep4.filter((r) => !r.visible);
  const toRemove = [...remove4, ...removeHidden].sort(byPos);

  if (toRemove.length) {
    console.log(`  remove from Level 4:`);
    for (const r of toRemove) console.log(`    ${desc(r)}`);
  }
  console.log(`  final Level 4 (${finalKeep4.length}):`);
  finalKeep4.forEach((r, i) => console.log(`    ${i}. ${desc(r)}`));

  const needsSave = toRemove.length > 0 || finalKeep4.some((r, i) => r.sortOrder !== i);
  if (!needsSave && !riceco.length) {
    console.log(`  no change\n`);
    continue;
  }
  changedCohorts++;
  if (!APPLY) {
    console.log();
    continue;
  }

  // d. save: Levels 1–3 untouched + renumbered Level 4.
  const lowerNow = rows.filter((r) => r.level !== 4);
  const payload = [
    ...lowerNow.map(toRow),
    ...finalKeep4.map((r, i) => ({ ...toRow(r), sortOrder: i })),
  ];
  const ids = payload.map((r) => r.sectionId);
  if (new Set(ids).size !== ids.length) throw new Error(`duplicate sectionId in payload for cohort ${c.id}`);
  if (lowerNow.length !== lower.length) throw new Error(`Level 1–3 row count changed for cohort ${c.id}`);
  await api("PUT", `/admin/cohorts/${c.id}/sections`, payload);

  // e. verify.
  const after = await getRows(c.id);
  const after4 = after.filter((r) => r.level === 4);
  const bad = after4.filter((r) => !r.visible || !isLibrary(r.sectionId));
  if (bad.length) {
    console.error(`  ERROR: Level 4 still has bad rows:`, bad.map(desc));
    process.exit(1);
  }
  const afterLower = after.filter((r) => r.level !== 4).map(toRow);
  if (JSON.stringify(afterLower) !== JSON.stringify(lowerNow.map(toRow))) {
    console.error(`  ERROR: Level 1–3 rows changed for cohort ${c.id}`);
    process.exit(1);
  }
  console.log(`  saved; Level 4 now ${after4.length} rows, all visible library sections\n`);
}
console.log(APPLY ? `Done. ${changedCohorts} cohort(s) changed.` : `Dry run: ${changedCohorts} cohort(s) would change.`);
