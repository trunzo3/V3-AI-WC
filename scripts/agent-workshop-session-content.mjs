#!/usr/bin/env node
// Content-only admin API update. Dry run unless APPLY=1; API_BASE selects target.
import { isDeepStrictEqual as equal } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
let cookie = "";
async function api(method, path, body) {
  const r = await fetch(B + path, {
    method, headers: { "content-type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const cs = r.headers.getSetCookie();
  if (cs.length) cookie = cs.map(c => c.split(";")[0]).join("; ");
  if (!r.ok) throw Error(`${method} ${path}: ${r.status}`);
  return r.json();
}
function one(xs, label) {
  if (xs.length !== 1) throw Error(`${label}: expected one, found ${xs.length}`);
  return xs[0];
}
const text = content => ({ type: "text", content });
const box = (label, content) => ({ type: "prompt", label, buttonLabel: "Copy", content });
const phone = text('<p><strong>Before tomorrow morning:</strong> install Grok Bot on your phone and sign in with the same account, so you can read your brief anywhere. iPhone: <a href="https://apps.apple.com/app/id6794501026" target="_blank" rel="noopener noreferrer">App Store</a>. Android: <a href="https://play.google.com/store/apps/details?id=ai.x.grok.bot" target="_blank" rel="noopener noreferrer">Google Play</a>.</p>');
const settingPatch = {
  settings: { workbookBrand: "MKTNG and IQmeetEQ" },
  homeMessage: "<p>Welcome to the Agent Workshop from MKTNG and IQmeetEQ. Scott Eggert and Anthony Trunzo will help you build your own AI assistant, one week at a time.</p>",
  facilitatorMessage: "<p>Each week's sections open at the start of that week's session. Your notes save automatically, and everything here stays available between sessions.</p>",
};
const team = text("<p><strong>Across a team.</strong> Scott shows what this looks like for a whole sales team: proposals, site analytics and dashboards.</p>");
const introAndBoxes = [
  text("<p>Three sources build the context every Bot will use. About 20 minutes.</p>"),
  { type: "steps", ordered: true, items: [
    ["If you use ChatGPT or Claude, start there.", "Copy box 1, paste it into a new chat in the one you use, and keep its answer. Read it first and take out anything personal and any client names. Skip this step if you use neither."],
    ["Have Morning Brief read your company website.", "Copy box 2, add your website address, paste it into Morning Brief and press Enter. Keep its summary."],
    ["Fill the gaps with a short interview.", "Open a new regular Grok chat. Copy box 3, paste in what you have from steps 1 and 2, and press Enter. Answer its questions; you can speak instead of typing."],
    ["Save the result.", "Copy the document the interview writes and paste it into Your context below."],
    ["Update Morning Brief.", "Copy the Update Morning Brief box, paste it into Morning Brief and press Enter."],
  ].map(([title, body]) => ({ title, body })) },
  box("1. Ask ChatGPT or Claude", "Write up what you know about me and my work, under these headings: my role and company, what I sell and to whom, who buys from me, how I write and talk to customers, my current priorities, and what an assistant should never do for me. Use only what you actually know, and say which headings you have nothing for. Leave out anything personal that isn't about my work."),
  box("2. Read my website", "Read my company's website at [website address]. Write a short summary for my context: what we sell, who we sell to, how we describe ourselves, and what sets us apart. Use only what's on the site, and list anything you couldn't find."),
  box("3. Fill the gaps", "I'm building a one-page context document that every AI assistant I use can read. Here is what I have so far:\n\n[paste what you got from steps 1 and 2]\n\nCompare it with these six headings: who I am (my role, my company, how long I've been selling); what I sell and to whom; who buys from me (the titles of the people who sign); how I sound; my current priorities; what an assistant should never do for me. Then interview me about only what's missing or unclear, one question at a time, waiting for each answer. When you have enough, write the full document in plain words under those six headings."),
  { type: "callout", variant: "rule", title: "TO CONFIRM", content: "Scott's grill-me interview replaces box 3 when he sends it." },
];
if (!process.env.ADMIN_PASSWORD) throw Error("ADMIN_PASSWORD missing");
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
const cohorts = (await api("GET", "/admin/cohorts")).cohorts;
const cohortSummary = one(cohorts.filter(c => c.name === "Agent Workshop"), "cohort");
const cohort = (await api("GET", `/admin/cohorts/${cohortSummary.id}`)).cohort;
const root = `/admin/cohorts/${cohort.id}`;
const groups = (await api("GET", `${root}/groups`)).groups;
const layout = (await api("GET", `${root}/sections`)).sections;
const library = (await api("GET", "/admin/generic-sections")).sections;
const usage = (await api("GET", "/admin/generic-sections/usage")).usage;
function group(name) { return one(groups.filter(g => g.name === name), name); }
function find(title, groupName) {
  const g = group(groupName);
  const row = one(layout.filter(s => s.title === title && s.groupId === g.id), `${title} in ${groupName}`);
  return one(library.filter(s => `generic_${s.id}` === row.sectionId), `${title} library`);
}
const week1 = "Week 1 — Morning Brief";
const mornings = find("Homework: three mornings", week1);
const check = find("Check it", week1);
const context = find("Homework: your context interview", week1);
console.log(`${process.env.APPLY === "1" ? "APPLY" : "DRY RUN"} ${B}`);
console.log("CURRENT COHORT SETTINGS\n" + JSON.stringify({ settings: cohort.settings, homeMessage: cohort.homeMessage, facilitatorMessage: cohort.facilitatorMessage }, null, 2));
for (const s of [mornings, check, context]) console.log(`CURRENT ${s.title}\n${JSON.stringify(s.contentBlocks, null, 2)}`);
if (mornings.contentBlocks[0]?.type !== "text") throw Error("Morning intro not first");
const nextMornings = mornings.contentBlocks.some(b => equal(b, phone))
  ? mornings.contentBlocks : [mornings.contentBlocks[0], phone, ...mornings.contentBlocks.slice(1)];
if (check.contentBlocks[0]?.type !== "steps") throw Error("Checklist not first");
const nextCheck = [
  check.contentBlocks[0],
  text("<p><strong>Share one line.</strong> Type one line from your brief and where it came from, then click Submit. We'll put a few on the Board. Leave out client names.</p>"),
  { type: "form", formName: "One line", fields: [{
    fieldKey: "one-line", label: "ONE LINE", heading: "One line from your brief, and where it came from",
    helpText: "<p>Example: 10:00 call with a new prospect, from my Google Calendar.</p>", multiline: false,
  }], collectResponses: true, responsesOpen: true, buttonLabel: "Submit",
  cardLayout: true, showPromptBox: false, showCopyButton: false, copyStyle: "labeled" },
];
const keptForm = one(context.contentBlocks.filter(b => b.type === "form" && b.formName === "Your context" && b.fields.some(f => f.fieldKey === "context-doc")), "Your context form");
const keptPrompt = one(context.contentBlocks.filter(b => b.type === "prompt" && b.label === "Update Morning Brief"), "Update Morning Brief copy box");
const plan = [
  { section: mornings, contentBlocks: nextMornings },
  { section: check, contentBlocks: nextCheck },
  { section: context, contentBlocks: [...introAndBoxes, keptForm, keptPrompt] },
];
const topic = one((await api("GET", "/admin/topics")).topics.filter(t => t.name === "AI Agents"), "AI Agents topic");
const additions = [
  { key: "in-session-w3", group: group("Week 3 — Scorecard"), blocks: [text("<p><strong>Guest: Jeff Soares.</strong> Jeff joins us for about 20 minutes.</p>"), team] },
  { key: "in-session-w4", group: group("Week 4 — Chief of Staff"), blocks: [team] },
];
for (const add of additions) {
  const existing = layout.filter(s => s.groupId === add.group.id && s.title === "In this session");
  if (existing.length > 1) throw Error(`Ambiguous ${add.key}`);
  if (existing.length) {
    const s = one(library.filter(s => `generic_${s.id}` === existing[0].sectionId), add.key);
    if (!equal(s.contentBlocks, add.blocks)) throw Error(`${add.key} already exists with different content`);
    add.sectionId = existing[0].sectionId;
    console.log(`CURRENT ${add.key}\n${JSON.stringify(s.contentBlocks, null, 2)}`);
  } else console.log(`CURRENT ${add.key}: absent`);
}
const expectedCounts = [1, 13, 7, 7, 7, 4];
const sortedGroups = [...groups].sort((a,b) => a.sortOrder-b.sortOrder);
if (sortedGroups.length !== 6) throw Error("Expected six groups");
const resultingCounts = sortedGroups.map(g => layout.filter(s => s.groupId === g.id).length + additions.filter(a => a.group.id === g.id && !a.sectionId).length);
if (!equal(resultingCounts, expectedCounts)) throw Error(`Unexpected proposed counts ${resultingCounts}`);
for (const p of plan) {
  if (usage.some(u => u.genericId === p.section.id && u.cohortId !== cohort.id))
    throw Error(`Shared section: ${p.section.title}`);
}
async function ensureNoResponses() {
  const forms = (await api("GET", `${root}/responses`)).responses;
  for (const p of plan) {
    const counts = (await api("GET", `/admin/generic-sections/${p.section.id}/poll-response-counts`)).counts;
    const nForms = forms.filter(r => r.sectionId === `generic_${p.section.id}`).length;
    if (nForms || Object.values(counts).some(n => n > 0))
      throw Error(`STOP: ${p.section.title} already has responses (${nForms} form; poll counts ${JSON.stringify(counts)}). Nothing written.`);
  }
}
await ensureNoResponses();
console.log("PROPOSED SETTINGS\n" + JSON.stringify(settingPatch, null, 2));
for (const p of plan) console.log(`PROPOSED ${p.section.title}\n${JSON.stringify(p.contentBlocks, null, 2)}`);
for (const a of additions) console.log(`PROPOSED ${a.key}\n${JSON.stringify(a.blocks, null, 2)}`);
console.log("PROPOSED GROUP COUNTS " + resultingCounts.join(", "));
if (process.env.APPLY !== "1") { console.log("Dry run; nothing written."); process.exit(0); }
// Recheck before the first write.
const latest = (await api("GET", "/admin/generic-sections")).sections;
for (const p of plan) if (!equal(p.section, latest.find(s => s.id === p.section.id))) throw Error("Concurrent content edit");
if (!equal(cohort, (await api("GET", `/admin/cohorts/${cohort.id}`)).cohort)) throw Error("Concurrent cohort edit");
if (!equal(layout, (await api("GET", `${root}/sections`)).sections)) throw Error("Concurrent layout edit");
await ensureNoResponses();
await api("PUT", root, settingPatch);
for (const p of plan) if (!equal(p.section.contentBlocks, p.contentBlocks))
  await api("PUT", `/admin/generic-sections/${p.section.id}`, { contentBlocks: p.contentBlocks });
for (const a of additions) if (!a.sectionId) {
  const s = (await api("POST", "/admin/generic-sections", {
    title: "In this session", topicId: topic.id, sectionType: "reference",
    showNotesField: true, goalText: null, badgeLabel: null, contentBlocks: a.blocks,
  })).section;
  a.sectionId = `generic_${s.id}`;
}
const projectRow = s => ({
  sectionId: s.sectionId, groupId: s.groupId, sortOrder: s.sortOrder,
  displayName: s.displayName ?? null, visible: s.visible, code: s.code ?? null, codeActive: s.codeActive,
});
const nextLayout = layout.map(projectRow);
for (const a of additions) {
  const old = layout.filter(s => s.groupId === a.group.id && s.sectionId !== a.sectionId)
    .sort((x,y) => x.sortOrder-y.sortOrder);
  const first = old[0]?.sortOrder ?? 0;
  const existing = nextLayout.find(r => r.sectionId === a.sectionId);
  if (!existing) {
    nextLayout.push({ sectionId: a.sectionId, groupId: a.group.id, sortOrder: first, displayName: null, visible: true, code: null, codeActive: true });
    for (const s of old) nextLayout.find(r => r.sectionId === s.sectionId).sortOrder = s.sortOrder + 1;
  }
}
if (!equal(nextLayout, layout.map(projectRow))) await api("PUT", `${root}/sections`, nextLayout);
// Read back all settings and blocks and compare, ignoring only update timestamps.
const afterCohort = (await api("GET", root)).cohort;
const expectedCohort = { ...cohort, ...settingPatch, settings: { ...cohort.settings, ...settingPatch.settings }, updatedAt: afterCohort.updatedAt };
if (!equal(expectedCohort, afterCohort)) throw Error("Cohort readback differs");
const afterLib = (await api("GET", "/admin/generic-sections")).sections;
for (const old of library) {
  const p = plan.find(p => p.section.id === old.id);
  const now = afterLib.find(s => s.id === old.id);
  if (!equal(p ? { ...old, contentBlocks: p.contentBlocks, updatedAt: now.updatedAt } : old, now))
    throw Error(`Unexpected section change ${old.title} (${old.id})`);
}
const afterLayout = (await api("GET", `${root}/sections`)).sections;
const sortRows = rows => rows.map(projectRow).sort((a,b) => a.sectionId.localeCompare(b.sectionId));
if (!equal(sortRows(nextLayout), sortRows(afterLayout))) throw Error("Layout readback differs");
const afterGroups = (await api("GET", `${root}/groups`)).groups;
const groupSettings = xs => xs.map(({ sectionCount, ...g }) => g);
if (!equal(groupSettings(groups), groupSettings(afterGroups))) throw Error("Group settings changed");
const afterCohorts = (await api("GET", "/admin/cohorts")).cohorts;
for (const c of cohorts) if (c.id !== cohort.id && !equal(c, afterCohorts.find(x => x.id === c.id))) throw Error("Other cohort changed");
await ensureNoResponses();
console.log("VERIFIED SETTINGS\n" + JSON.stringify({ settings: afterCohort.settings, homeMessage: afterCohort.homeMessage, facilitatorMessage: afterCohort.facilitatorMessage }, null, 2));
for (const id of [...plan.map(p => p.section.id), ...additions.map(a => Number(a.sectionId.slice(8)))]) {
  const s = one(afterLib.filter(s => s.id === id), "verified section");
  const add = additions.find(a => a.sectionId === `generic_${id}`);
  if (add && (!equal(s.contentBlocks, add.blocks) || s.topicId !== topic.id || s.sectionType !== "reference" || !s.showNotesField)) throw Error("New section readback differs");
  console.log(`VERIFIED ${s.title} (${add?.key ?? id})\n${JSON.stringify(s.contentBlocks, null, 2)}`);
}
console.log("VERIFIED GROUP COUNTS " + sortedGroups.map(g => `${g.name}: ${afterLayout.filter(s => s.groupId === g.id).length}`).join(" | "));
console.log("Other existing sections/cohorts and all group settings unchanged. Modified sections have no responses.");
if (process.env.REPORT_PATH) {
  const escape = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const report = {
    environment: B,
    cohort: {
      name: afterCohort.name, settings: afterCohort.settings,
      homeMessage: afterCohort.homeMessage, facilitatorMessage: afterCohort.facilitatorMessage,
    },
    groups: sortedGroups.map(g => ({
      name: g.name,
      sections: afterLayout.filter(s => s.groupId === g.id).sort((a,b) => a.sortOrder-b.sortOrder).map(s => s.title),
    })),
    changedSections: [...plan.map(p => p.section.id), ...additions.map(a => Number(a.sectionId.slice(8)))].map(id => {
      const s = afterLib.find(s => s.id === id);
      const row = afterLayout.find(r => r.sectionId === `generic_${id}`);
      return { title: s.title, group: groups.find(g => g.id === row.groupId).name,
        sectionId: row.sectionId, sectionType: s.sectionType, topicId: s.topicId,
        showNotesField: s.showNotesField, contentBlocks: s.contentBlocks };
    }),
  };
  const out = process.env.REPORT_PATH;
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, '<!doctype html><html lang="en"><meta charset="utf-8"><title>Agent Workshop — production readback</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:0 24px;color:#182234}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f6f8;padding:24px;font:13px/1.6 monospace}h1{font-size:28px}</style><h1>Agent Workshop — verified content readback</h1><p>Settings and blocks below were read back from the admin API after the update. HTML is shown literally, exactly as stored.</p><pre>' + escape(JSON.stringify(report, null, 2)) + '</pre></html>');
  console.log(`Readback report: ${out}`);
}
