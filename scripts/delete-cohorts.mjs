#!/usr/bin/env node
// Delete every cohort except an allow-list of codes, via the admin API.
//
// Dry run by default: prints every cohort (name, code, participants,
// responses) marked KEEP or DELETE and exits. Refuses to run at all if any
// keep code is missing from the target environment.
//
//   [API_BASE=https://host] [APPLY=1] [KEEP_CODES=A,B,C] ADMIN_PASSWORD=... \
//     node scripts/delete-cohorts.mjs
//
// For each DELETE cohort with APPLY=1: delete its participants one by one
// (DELETE /admin/participants/:id — cascades notes, unlocks, workflow maps,
// feedback, form and poll responses), then DELETE /admin/cohorts/:id
// (cascades groups, section rows, content variants, safari tabs, poll and
// form responses, tombstones). Library sections (generic_sections) and
// uploaded files are never touched — a cohort delete only removes the
// cohort's own rows that point at them.

const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const APPLY = process.env.APPLY === "1";
const KEEP = (process.env.KEEP_CODES ?? "TEST-NG,SCZ,T4DAY5,DAVIS,AI301SVP,AGENT")
  .split(",")
  .map((c) => c.trim().toUpperCase())
  .filter(Boolean);

if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");

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

await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
const { cohorts } = await api("GET", "/admin/cohorts");
const library = (await api("GET", "/admin/generic-sections")).sections;
const blocksById = new Map(library.map((g) => [`generic_${g.id}`, g.contentBlocks ?? []]));

const present = new Set(cohorts.map((c) => c.cohortCode.toUpperCase()));
const missing = KEEP.filter((k) => !present.has(k));
if (missing.length) {
  console.error(`STOP: keep code(s) not found in ${B}: ${missing.join(", ")}`);
  console.error(`Cohorts present: ${cohorts.map((c) => c.cohortCode).join(", ")}`);
  process.exit(2);
}

// Count responses: all form submissions + every poll block's submissions.
async function responseCount(cohort) {
  const forms = (await api("GET", `/admin/cohorts/${cohort.id}/responses`)).responses.length;
  let polls = 0;
  const { sections } = await api("GET", `/admin/cohorts/${cohort.id}/sections`);
  for (const s of sections) {
    const blocks = blocksById.get(s.sectionId) ?? [];
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i]?.type !== "poll") continue;
      const r = await api(
        "GET",
        `/admin/cohorts/${cohort.id}/poll-results?sectionId=${encodeURIComponent(s.sectionId)}&blockIndex=${i}`,
      );
      polls += r.responses.length;
    }
  }
  return forms + polls;
}

const rows = [];
for (const c of cohorts.slice().sort((a, b) => a.id - b.id)) {
  const participants = (await api("GET", `/admin/cohorts/${c.id}/participants`)).participants;
  rows.push({
    cohort: c,
    participants,
    responses: await responseCount(c),
    keep: KEEP.includes(c.cohortCode.toUpperCase()),
  });
}

console.log(`${APPLY ? "APPLY" : "DRY RUN"} against ${B}\n`);
const pad = (s, n) => String(s).padEnd(n);
console.log(pad("ACTION", 8) + pad("ID", 6) + pad("CODE", 12) + pad("PARTICIPANTS", 14) + pad("RESPONSES", 11) + "NAME");
for (const r of rows) {
  console.log(
    pad(r.keep ? "KEEP" : "DELETE", 8) +
      pad(r.cohort.id, 6) +
      pad(r.cohort.cohortCode, 12) +
      pad(r.participants.length, 14) +
      pad(r.responses, 11) +
      r.cohort.name,
  );
}
const toDelete = rows.filter((r) => !r.keep);
console.log(`\n${rows.length - toDelete.length} to keep, ${toDelete.length} to delete.`);

if (!APPLY) {
  console.log("Dry run only. Re-run with APPLY=1 to delete.");
  process.exit(0);
}

for (const r of toDelete) {
  for (const p of r.participants) {
    await api("DELETE", `/admin/participants/${p.id}`);
  }
  await api("DELETE", `/admin/cohorts/${r.cohort.id}`);
  console.log(`Deleted cohort ${r.cohort.id} ${r.cohort.cohortCode} (${r.participants.length} participants)`);
}

const after = (await api("GET", "/admin/cohorts")).cohorts.map((c) => c.cohortCode).sort();
console.log(`\nRemaining cohorts: ${after.join(", ")}`);
const unexpected = after.filter((c) => !KEEP.includes(c.toUpperCase()));
const stillMissing = KEEP.filter((k) => !after.map((c) => c.toUpperCase()).includes(k));
if (unexpected.length || stillMissing.length) {
  console.error(`MISMATCH: unexpected=${unexpected.join(",")} missing=${stillMissing.join(",")}`);
  process.exit(1);
}
console.log("Cohort list matches the keep list exactly.");
