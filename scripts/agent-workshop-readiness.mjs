#!/usr/bin/env node
// Content-only update. Dry run by default; APPLY=1 writes through admin API.
// Resolves by cohort name and that cohort's own group/section rows, never code.
import { isDeepStrictEqual } from "node:util";

const base = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const apply = process.env.APPLY === "1";
let cookie = "";
async function api(method, path, body) {
  const r = await fetch(base + path, {
    method, headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cookies = r.headers.getSetCookie();
  if (cookies.length) cookie = cookies.map(c => c.split(";")[0]).join("; ");
  const data = await r.json();
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status}`);
  return data;
}
function one(items, label) {
  if (items.length !== 1) throw new Error(`Expected exactly one ${label}; found ${items.length}`);
  return items[0];
}
const intro = "Do these three things before Session 1. They take about 15 minutes. If any of them isn't done, you won't be able to build in the session. Mark each one Done and click Submit. You can come back and update your answers.";
const help = "Examples: change orders, bid numbers or safety incidents in the trades; discount approvals or contract terms in other businesses.";
const questions = [
  {
    questionKey: "paid-plan",
    text: "Buy Premium or higher, using your work email.",
    details: '<p>Choose a plan at <a href="https://x.ai/pricing">x.ai/pricing</a>. Plus ($8) doesn\'t include Grok Bot, and a free trial runs out on the first Bot you build.</p>',
  },
  {
    questionKey: "grok-opens",
    text: "Install Grok Bot on your computer and your phone, and sign in.",
    details: '<p>Computer: <a href="https://x.ai/bot">x.ai/bot</a>. iPhone: <a href="https://apps.apple.com/app/id6794501026">App Store</a>. Android: <a href="https://play.google.com/store/apps/details?id=ai.x.grok.bot">Google Play</a>.</p><p>Use the same account on both, and make sure each one opens. Don\'t build any Bots yet; we build the first one together.</p>',
  },
  {
    questionKey: "connected",
    text: "Connect your work calendar and work email.",
    details: '<p>In Grok Bot, click <strong>Connect apps</strong> in the sidebar, then connect your work calendar and your work email. You may need to ask whoever manages your email accounts for help.</p>',
    allowComment: true, commentLabel: "What's blocking you?",
  },
].map(q => ({
  ...q, choiceType: "single", choices: ["Done", "Not yet"],
  details: q.details.replace(/<a href="([^"]+)">/g, '<a href="$1" target="_blank" rel="noopener noreferrer">'),
}));

if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
const cohort = one((await api("GET", "/admin/cohorts")).cohorts.filter(c => c.name === "Agent Workshop"), "Agent Workshop cohort");
const layout = await api("GET", `/admin/cohorts/${cohort.id}/sections`);
const groups = (await api("GET", `/admin/cohorts/${cohort.id}/groups`)).groups;
const library = (await api("GET", "/admin/generic-sections")).sections;
function target(title, groupName) {
  const group = one(groups.filter(g => g.name === groupName), groupName);
  const row = one(layout.sections.filter(s => s.title === title && s.groupId === group.id), title);
  return one(library.filter(s => `generic_${s.id}` === row.sectionId), `${title} library section`);
}
const ready = target("Get ready", "Before Week 1");
const review = target("Never send without review", "Week 2 — Follow-Up");
console.log(`${apply ? "APPLY" : "DRY RUN"} ${base}; cohort ${cohort.id}`);
for (const s of [ready, review]) console.log(`CURRENT ${s.title} (${s.id})\n${JSON.stringify(s.contentBlocks, null, 2)}`);
const poll = one(ready.contentBlocks.filter(b => b.type === "poll" && b.pollName === "Readiness check"), "Readiness check");
const oldIndex = ready.contentBlocks.indexOf(poll);
if (!isDeepStrictEqual(poll.questions.map(q => q.questionKey), questions.map(q => q.questionKey)))
  throw new Error("Readiness question keys differ; review before applying.");
const fields = review.contentBlocks.flatMap(b => b.type === "form" && b.formName === "Never-send additions" ? b.fields : []);
one(fields.filter(f => f.fieldKey === "w2-review-list"), "review field");
const planned = [
  { section: ready, blocks: [
    { type: "text", content: `<p>${intro}</p>` },
    { ...poll, questions, pollName: "Readiness check", buttonLabel: "Submit", responsesOpen: true, showResults: false, oneSubmissionOnly: false },
  ] },
  { section: review, blocks: review.contentBlocks.map(b => b.type === "form" && b.formName === "Never-send additions"
    ? { ...b, fields: b.fields.map(f => f.fieldKey === "w2-review-list" ? { ...f, helpText: `<p>${help}</p>` } : f) } : b) },
];
for (const p of planned) console.log(`PROPOSED ${p.section.title}\n${JSON.stringify(p.blocks, null, 2)}`);
// Responses use section id + block INDEX, not just the question keys.
// Never move a populated poll: it would strand existing answers.
const counts = (await api("GET", `/admin/generic-sections/${ready.id}/poll-response-counts`)).counts;
const responsesBefore = (await api("GET", `/admin/cohorts/${cohort.id}/poll-results?sectionId=generic_${ready.id}&blockIndex=${oldIndex}`)).responses;
console.log(`Readiness response counts by block index: ${JSON.stringify(counts)}; move ${oldIndex} -> 1`);
const unsafe = oldIndex !== 1 && Object.values(counts).some(n => n > 0);
if (unsafe) {
  console.log("BLOCKED: moving this poll would orphan existing responses. No writes performed.");
  process.exitCode = 2;
} else if (!apply) {
  console.log("Dry run only; no content written.");
} else {
  // Guard against shared sections: editing one must not alter another cohort.
  const usage = (await api("GET", "/admin/generic-sections/usage")).usage;
  for (const p of planned) {
    const used = usage.filter(u => u.genericId === p.section.id);
    if (used.some(u => u.cohortId !== cohort.id)) throw new Error("Target section shared by another cohort");
  }
  const latest = (await api("GET", "/admin/generic-sections")).sections;
  for (const p of planned) {
    if (!isDeepStrictEqual(p.section, latest.find(s => s.id === p.section.id)))
      throw new Error("Content changed since preflight; rerun dry run.");
  }
  const latestCounts = (await api("GET", `/admin/generic-sections/${ready.id}/poll-response-counts`)).counts;
  if (!isDeepStrictEqual(counts, latestCounts)) throw new Error("Responses changed since preflight; rerun dry run.");
  for (const p of planned) {
    if (!isDeepStrictEqual(p.section.contentBlocks, p.blocks))
      await api("PUT", `/admin/generic-sections/${p.section.id}`, { contentBlocks: p.blocks });
  }
  const after = (await api("GET", "/admin/generic-sections")).sections;
  for (const p of planned) {
    const s = one(after.filter(s => s.id === p.section.id), "updated section");
    if (!isDeepStrictEqual(s.contentBlocks, p.blocks)) throw new Error(`Readback mismatch: ${s.title}`);
    console.log(`VERIFIED ${s.title}\n${JSON.stringify(s.contentBlocks, null, 2)}`);
  }
  for (const before of library) {
    if ([ready.id, review.id].includes(before.id)) continue;
    if (!isDeepStrictEqual(before, after.find(s => s.id === before.id))) throw new Error(`Other section changed: ${before.id}`);
  }
  const afterCounts = (await api("GET", `/admin/generic-sections/${ready.id}/poll-response-counts`)).counts;
  if (!isDeepStrictEqual(counts, afterCounts)) throw new Error("Response counts changed");
  const responsesAfter = (await api("GET", `/admin/cohorts/${cohort.id}/poll-results?sectionId=generic_${ready.id}&blockIndex=1`)).responses;
  if (!isDeepStrictEqual(responsesBefore, responsesAfter)) throw new Error("Readiness responses changed");
  console.log("Verified: other library sections unchanged; response counts unchanged.");
}
