#!/usr/bin/env node
// Narrow variant of agent-workshop-readiness.mjs: only Q1 details and Q2
// text/details. Admin API only, dry run by default, APPLY=1 writes.
import { isDeepStrictEqual as equal } from "node:util";
const base = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const apply = process.env.APPLY === "1";
let cookie = "";
async function api(method, path, body) {
  const r = await fetch(base + path, {
    method, headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cs = r.headers.getSetCookie();
  if (cs.length) cookie = cs.map(c => c.split(";")[0]).join("; ");
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  return r.json();
}
function one(rows, label) {
  if (rows.length !== 1) throw new Error(`${label}: expected one, got ${rows.length}`);
  return rows[0];
}
if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD missing");
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
const cohorts = (await api("GET", "/admin/cohorts")).cohorts;
const cohort = one(cohorts.filter(c => c.name === "Agent Workshop"), "cohort");
const groups = (await api("GET", `/admin/cohorts/${cohort.id}/groups`)).groups;
const group = one(groups.filter(g => g.name === "Before Week 1"), "group");
const layout = await api("GET", `/admin/cohorts/${cohort.id}/sections`);
const row = one(layout.sections.filter(s => s.title === "Get ready" && s.groupId === group.id), "section row");
const library = (await api("GET", "/admin/generic-sections")).sections;
const section = one(library.filter(s => `generic_${s.id}` === row.sectionId), "library section");
const poll = one(section.contentBlocks.filter(b => b.type === "poll" && b.pollName === "Readiness check"), "poll");
const index = section.contentBlocks.indexOf(poll);
console.log(`${apply ? "APPLY" : "DRY RUN"} ${base}\nCURRENT POLL\n${JSON.stringify(poll, null, 2)}`);
if (!equal(poll.questions.map(q => q.questionKey), ["paid-plan", "grok-opens", "connected"]))
  throw new Error("Unexpected question keys");
if (poll.questions[0].text !== "Buy Premium or higher, using your work email.")
  throw new Error("Question 1 text differs; stop for review");
const updated = { ...poll, questions: poll.questions.map(q => {
  if (q.questionKey === "paid-plan") return {
    ...q, details: '<p>Choose a plan at <a href="https://x.ai/pricing" target="_blank" rel="noopener noreferrer">x.ai/pricing</a>.</p>',
  };
  if (q.questionKey === "grok-opens") return {
    ...q, text: "Install Grok Bot on your computer and sign in.",
    details: '<p>Download it at <a href="https://x.ai/bot" target="_blank" rel="noopener noreferrer">x.ai/bot</a>. Don\'t build any Bots yet; we build the first one together.</p>',
  };
  return q;
}) };
const blocks = section.contentBlocks.map((b, i) => i === index ? updated : b);
const countsPath = `/admin/generic-sections/${section.id}/poll-response-counts`;
const counts = (await api("GET", countsPath)).counts;
console.log(`Response counts: ${JSON.stringify(counts)}`);
if (Object.values(counts).some(n => n > 0)) {
  console.log("STOP: existing Readiness responses; nothing written.");
  process.exit(2);
}
const usage = (await api("GET", "/admin/generic-sections/usage")).usage;
if (usage.some(u => u.genericId === section.id && u.cohortId !== cohort.id))
  throw new Error("Section shared by another cohort; nothing written");
console.log(`PROPOSED POLL\n${JSON.stringify(updated, null, 2)}`);
if (!apply) process.exit(0);
const latest = (await api("GET", "/admin/generic-sections")).sections.find(s => s.id === section.id);
if (!equal(latest, section)) throw new Error("Section changed during preflight");
if (Object.values((await api("GET", countsPath)).counts).some(n => n > 0))
  throw new Error("Responses appeared during preflight; nothing written");
if (!equal(section.contentBlocks, blocks))
  await api("PUT", `/admin/generic-sections/${section.id}`, { contentBlocks: blocks });
const after = (await api("GET", "/admin/generic-sections")).sections;
const actual = one(after.filter(s => s.id === section.id), "readback");
if (!equal(actual.contentBlocks, blocks)) throw new Error("Readback content mismatch");
const { contentBlocks: ignoredBefore, updatedAt: timeBefore, ...metaBefore } = section;
const { contentBlocks: ignoredAfter, updatedAt: timeAfter, ...metaAfter } = actual;
if (!equal(metaBefore, metaAfter)) throw new Error("Section metadata changed");
for (const s of library) {
  if (s.id !== section.id && !equal(s, after.find(a => a.id === s.id)))
    throw new Error(`Other library section changed: ${s.id}`);
}
if (!equal(cohorts, (await api("GET", "/admin/cohorts")).cohorts) ||
    !equal(groups, (await api("GET", `/admin/cohorts/${cohort.id}/groups`)).groups) ||
    !equal(layout.sections.map(s => ({ ...s, contentBlocks: undefined })),
      (await api("GET", `/admin/cohorts/${cohort.id}/sections`)).sections.map(s => ({ ...s, contentBlocks: undefined }))))
  throw new Error("Cohort or layout changed during update");
if (!equal(counts, (await api("GET", countsPath)).counts)) throw new Error("Response counts changed");
console.log(`VERIFIED STORED POLL\n${JSON.stringify(actual.contentBlocks[index], null, 2)}`);
console.log("Verified: other blocks, question 3, settings, other library sections, cohort and groups unchanged; response counts unchanged.");
