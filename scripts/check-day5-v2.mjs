// ---------------------------------------------------------------------------
// End-to-end check of the Caltrans Day 5 v2 cohort (T4DAY5V2) through the
// participant API and the admin API. Read-only except for: one test
// participant in T4DAY5V2, its unlocks, and three test form responses.
// Never touches cohort T4DAY5 (1370) or any section content.
//
//   API_BASE=https://V3-WSC.replit.app ADMIN_PASSWORD=... node scripts/check-day5-v2.mjs
// ---------------------------------------------------------------------------
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const CODE = "T4DAY5V2";
const TEST_NAME = "TEST Claude Check";
const TEST_EMAIL = "test-claude-check@iqmeeteq.test";
const TEST_TEXT = "TEST — ignore";
const OUT_PDF = "attached_assets/check-day5-v2-workbook.pdf";
const OUT_JSON = "attached_assets/check-day5-v2-sections.json";
if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");

function client() {
  let cookie = "";
  return async function api(method, path, body, { raw = false } = {}) {
    const r = await fetch(B + path, {
      method,
      headers: { "content-type": "application/json", cookie },
      body: body ? JSON.stringify(body) : undefined,
    });
    const scs = r.headers.getSetCookie?.() ?? [];
    if (scs.length) cookie = scs.map((c) => c.split(";")[0]).join("; ");
    if (raw) {
      if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}`);
      return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type") };
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(j)}`);
    return j;
  };
}
const admin = client();
const part = client();

const results = [];
function report(step, pass, detail) {
  results.push({ step, pass });
  console.log(`\n[${pass ? "PASS" : "FAIL"}] ${step}`);
  if (detail) console.log(detail.split("\n").map((l) => "  " + l).join("\n"));
}

console.log("target", B);
await admin("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
const cohort = (await admin("GET", "/admin/cohorts")).cohorts.find((c) => c.cohortCode.toUpperCase() === CODE);
if (!cohort) throw new Error(`cohort ${CODE} not found`);
console.log(`cohort ${cohort.id} "${cohort.name}"`);
const adminRows = (await admin("GET", `/admin/cohorts/${cohort.id}/sections`)).sections;
const expectedL4 = adminRows.filter((r) => r.level === 4 && r.visible).sort((a, b) => a.sortOrder - b.sortOrder);
const generics = new Map((await admin("GET", "/admin/generic-sections")).sections.map((g) => [g.id, g]));
const gidOf = (sid) => (sid.startsWith("generic_") ? Number(sid.slice(8)) : null);
const titleOf = (r) => (gidOf(r.sectionId) !== null ? generics.get(gidOf(r.sectionId))?.title ?? r.title : r.title);

// ----- 1. participant login + unlocks ---------------------------------------
{
  const login = await part("POST", "/auth/login", { name: TEST_NAME, email: TEST_EMAIL, cohortCode: CODE });
  const me = await part("GET", "/auth/me");
  const lines = [`logged in as participant ${me.participant?.id ?? "?"} (${TEST_EMAIL}) in cohort ${login.cohort?.id ?? me.cohort?.id ?? cohort.id}`];
  const perCode = {};
  for (const code of ["SEE", "SHAPE", "WRONG", "BALANCE", "LEAD"]) {
    const r = await part("POST", "/sections/unlock", { code });
    perCode[code] = r.unlockedCount;
    // The unlock endpoint matches by code across every row of the cohort,
    // hidden ones included; hidden rows never reach the participant list.
    const visibleN = expectedL4.filter((x) => x.code === code && x.codeActive).length;
    const hidden = adminRows.filter((x) => x.code === code && x.codeActive && !x.visible);
    const expected = visibleN + hidden.length;
    lines.push(`${code}: unlocked ${r.unlockedCount} (expected ${expected} = ${visibleN} visible${hidden.length ? ` + ${hidden.length} hidden: ${hidden.map(titleOf).join(", ")}` : ""}) — first: "${r.section.title}"`);
    if (r.unlockedCount !== expected) lines.push(`  MISMATCH for ${code}`);
  }
  const mismatches = lines.filter((l) => l.includes("MISMATCH")).length;
  const secs = (await part("GET", "/sections")).sections;
  const l4 = secs.filter((s) => s.level === 4);
  const ids = l4.map((s) => s.id);
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  const notUnlocked = l4.filter((s) => !s.unlocked);
  const orderOk = l4.length === expectedL4.length && l4.every((s, i) => s.id === expectedL4[i].sectionId);
  lines.push(`GET /sections: ${l4.length} Level 4 sections visible to participant (expected ${expectedL4.length}); unlocked ${l4.length - notUnlocked.length}; duplicates ${dupes.length}; order matches admin layout = ${orderOk}`);
  l4.forEach((s, i) => lines.push(`  ${String(i + 1).padStart(2)}. ${s.title}  unlocked=${s.unlocked}${s.id !== expectedL4[i]?.sectionId ? "  ← ORDER MISMATCH" : ""}`));
  report(
    "1. Participant unlock + section list",
    mismatches === 0 && l4.length === 28 && notUnlocked.length === 0 && dupes.length === 0 && orderOk,
    lines.join("\n"),
  );
}

// ----- 2. form responses ----------------------------------------------------
const submitted = [];
{
  const lines = [];
  const findForm = (title) => {
    const rows = expectedL4.filter((r) => titleOf(r) === title);
    if (rows.length !== 1) throw new Error(`expected one visible L4 row "${title}", found ${rows.length}`);
    const g = generics.get(gidOf(rows[0].sectionId));
    const idx = g.contentBlocks.findIndex((b) => b.type === "form" && b.collectResponses);
    if (idx < 0) throw new Error(`no collecting form in "${title}"`);
    return { sectionId: rows[0].sectionId, blockIndex: idx, block: g.contentBlocks[idx], title };
  };
  const targets = [
    { ...findForm("Consider the Work"), values: {} },
    { ...findForm("Create Your Change Message"), values: {} },
    { ...findForm("Build Your Mini-PRD"), values: { "Table number": "99", "Table name": "Test table" } },
  ];
  for (const t of targets) {
    // Mirror the client's assembly: identifier fields travel separately,
    // every other field is filled with the test text.
    const byLabel = t.values;
    const identifiers = {};
    const parts = [];
    const identifierFields = t.block.fields.filter((f) => f.identifier).map((f) => f.label);
    for (const f of t.block.fields) {
      if (f.identifier) {
        const v = byLabel[f.label];
        if (v) identifiers[f.label] = v;
        continue;
      }
      const v = byLabel[f.label] ?? TEST_TEXT;
      parts.push(t.block.copyStyle === "joined" ? v : `${f.label}: ${v}`);
    }
    let responseText = t.block.copyStyle === "joined" ? parts.join(" ") : parts.join("\n");
    if ((t.block.template ?? "").trim()) {
      responseText = t.block.template.replace(/\{([^{}]+)\}/g, (_m, k) => {
        const f = t.block.fields.find((x) => x.fieldKey === k.trim());
        if (!f || f.identifier) return "";
        return byLabel[f.label] ?? TEST_TEXT;
      });
    }
    lines.push(`"${t.title}" (${t.sectionId} block ${t.blockIndex}, form "${t.block.formName}"): identifier fields on form = [${identifierFields.join(", ") || "none"}]`);
    if (t.title === "Build Your Mini-PRD" && identifierFields.length === 0) {
      lines.push(`  NOTE: Table number / Table name are NOT flagged as identifier fields on this copy; the client would put them in the text.`);
      // Reproduce what the live client does when the fields are plain fields.
      responseText = t.block.fields.map((f) => `${f.label}: ${byLabel[f.label] ?? TEST_TEXT}`).join("\n");
    }
    const r = await part("POST", "/responses", { sectionId: t.sectionId, blockIndex: t.blockIndex, responseText, ...(Object.keys(identifiers).length ? { identifiers } : {}) });
    submitted.push({ ...t, responseText, identifiers, saved: r });
    lines.push(`  submitted; server echoed id ${r.response?.id ?? r.id ?? "?"}`);
  }
  // Admin read-back.
  const all = (await admin("GET", `/admin/cohorts/${cohort.id}/responses`)).responses;
  const mine = all.filter((r) => r.participantName === TEST_NAME);
  let pass = true;
  for (const t of submitted) {
    const hit = mine.find((r) => r.sectionId === t.sectionId && r.blockIndex === t.blockIndex);
    lines.push(`\n"${t.title}" — arrived: ${hit ? "yes" : "NO"}`);
    if (!hit) { pass = false; continue; }
    lines.push(`  formName: ${hit.formName}`);
    lines.push(`  responseText: ${JSON.stringify(hit.responseText)}`);
    lines.push(`  identifiers: ${JSON.stringify(hit.identifiers ?? null)}`);
    if (t.title === "Build Your Mini-PRD") {
      const idOk = hit.identifiers && hit.identifiers["Table number"] === "99" && hit.identifiers["Table name"] === "Test table";
      const textClean = !/Table number|Table name|99|Test table/.test(hit.responseText);
      lines.push(`  Table number/name as identifiers: ${idOk ? "yes" : "NO"}; absent from text: ${textClean ? "yes" : "NO"}`);
      if (!idOk || !textClean) pass = false;
    }
    if (!hit.responseText.includes(TEST_TEXT)) pass = false;
  }
  report("2. Form responses collected", pass, lines.join("\n"));
}

// ----- 3. workbook ----------------------------------------------------------
{
  const { buf, type } = await part("GET", "/workbook/download", undefined, { raw: true });
  mkdirSync("attached_assets", { recursive: true });
  writeFileSync(OUT_PDF, buf);
  const lines = [`saved ${OUT_PDF} (${buf.length} bytes, ${type})`];
  let pages = null, textOut = "";
  try {
    pages = Number(/Pages:\s+(\d+)/.exec(execFileSync("pdfinfo", [OUT_PDF]).toString())?.[1]);
    textOut = execFileSync("pdftotext", ["-layout", OUT_PDF, "-"]).toString();
  } catch (e) {
    lines.push(`pdf tools unavailable: ${e.message}`);
  }
  lines.push(`pages: ${pages}`);
  const norm = (s) => s.replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();
  const hay = norm(textOut);
  const missing = expectedL4.map(titleOf).filter((t) => !hay.includes(norm(t)));
  lines.push(`Level 4 titles present: ${expectedL4.length - missing.length}/${expectedL4.length}${missing.length ? "; missing: " + missing.join(" | ") : ""}`);
  report("3. Workbook download", buf.length > 1000 && pages > 0 && missing.length === 0, lines.join("\n"));
}

// ----- 4. content dump ------------------------------------------------------
{
  const dump = expectedL4.map((r, i) => {
    const g = gidOf(r.sectionId) !== null ? generics.get(gidOf(r.sectionId)) : null;
    return {
      order: i + 1,
      sectionId: r.sectionId,
      code: r.code,
      title: titleOf(r),
      kind: g ? "library" : "built-in",
      ...(g ? { badgeLabel: g.badgeLabel, goalText: g.goalText, sectionType: g.sectionType, showNotesField: g.showNotesField, contentBlocks: g.contentBlocks } : {}),
    };
  });
  writeFileSync(OUT_JSON, JSON.stringify(dump, null, 2));
  const builtins = dump.filter((d) => d.kind === "built-in").map((d) => d.title);
  report("4. Content dump", dump.length === 28, `saved ${OUT_JSON}: ${dump.length} sections, ${dump.reduce((n, d) => n + (d.contentBlocks?.length ?? 0), 0)} content blocks; built-ins without blocks: ${builtins.join(", ") || "none"}`);
}

// ----- 5. summary -----------------------------------------------------------
console.log("\nSUMMARY");
for (const r of results) console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.step}`);
console.log(`\nTest data left in place (cohort ${cohort.id} "${cohort.name}", code ${CODE}):`);
console.log(`  participant "${TEST_NAME}" <${TEST_EMAIL}> — Admin → Participants tab for this cohort`);
console.log(`  ${submitted.length} responses — Admin → Responses card for this cohort (filter by participant "${TEST_NAME}")`);
