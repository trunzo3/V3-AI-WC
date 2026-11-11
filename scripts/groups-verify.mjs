// ---------------------------------------------------------------------------
// Levels → Groups conversion safeguard.
//
//   node scripts/groups-verify.mjs snapshot [--env dev|production] [--rows file]
//   node scripts/groups-verify.mjs compare  <snapshot.json> [--env ...] [--rows file]
//   node scripts/groups-verify.mjs queries           # print the SQL used
//
// READ-ONLY. Never logs in as a participant and never writes to the database.
//
// `snapshot` records, for every cohort, the admin section list and, for every
// participant, the ordered group headings they see and the ordered visible
// sections inside each (with the unlocked flag computed by the app's rule:
// group open OR no code required OR explicitly unlocked). It uses the LEGACY
// path (cohort_sections.level + cohorts.tier_access + settings.levelNames)
// when the cohort has no groups yet, and the GROUPS path once converted.
//
// `compare` recomputes everything with the GROUPS path only and exits 1 with a
// diff if anything differs for anyone, or if any cohort is still unconverted.
//
// Rows come from `psql "$DATABASE_URL"` by default. For production (where this
// workspace has read-only SQL access through a different channel) run the
// queries printed by `queries`, save the results as {"cohorts":[...], ...} and
// pass `--rows file.json`.
// ---------------------------------------------------------------------------
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// App default headings (workbook prints them as-is; the sidebar uppercases
// via CSS, so the stored string is the title-case form).
const DEFAULT_LEVEL_HEADINGS = {
  1: "Level 1 — Core Workshop",
  2: "Level 2 — Applied Mastery",
  3: "Level 3 — AI Builder",
  4: "AI Change Leadership",
};

export const QUERIES = {
  cohorts:
    "select id, name, cohort_code, tier_access, settings, groups_converted_at from cohorts order by id",
  participants:
    "select id, name, email, cohort_id from participants order by id",
  cohort_sections:
    "select id, cohort_id, section_id, level, group_id, sort_order, display_name, visible, code, code_active from cohort_sections order by cohort_id, id",
  cohort_groups:
    "select id, cohort_id, name, sort_order, is_open, legacy_level from cohort_groups order by cohort_id, sort_order, id",
  unlocked_sections:
    "select participant_id, section_id from unlocked_sections order by participant_id, section_id",
  generic_sections:
    "select id, title, default_level, topic_id, archived from generic_sections order by id",
};

function loadRowsFromPsql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const out = {};
  for (const [key, q] of Object.entries(QUERIES)) {
    const json = execFileSync(
      "psql",
      [url, "-Atc", `select coalesce(json_agg(t), '[]'::json) from (${q}) t`],
      { encoding: "utf8" },
    ).trim();
    out[key] = JSON.parse(json);
  }
  return out;
}

function loadRows(args) {
  const i = args.indexOf("--rows");
  if (i >= 0) return JSON.parse(readFileSync(args[i + 1], "utf8"));
  return loadRowsFromPsql();
}

// Heading shown today for a legacy level: the cohort's custom name or the
// app default label.
function legacyHeading(cohort, level) {
  const names = cohort.settings?.levelNames ?? {};
  const custom = typeof names[String(level)] === "string" ? names[String(level)].trim() : "";
  return custom || DEFAULT_LEVEL_HEADINGS[level] || `Level ${level}`;
}

// Build the ordered group list for a cohort plus a sectionRow -> groupKey map.
// mode "legacy": from level/tier_access; mode "groups": from cohort_groups.
function cohortGroups(cohort, rows, mode) {
  if (mode === "groups") {
    const groups = rows.cohort_groups
      .filter((g) => g.cohort_id === cohort.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
      .map((g) => ({ key: `g${g.id}`, name: g.name, open: !!g.is_open, legacyLevel: g.legacy_level }));
    return {
      groups,
      groupKeyFor: (cs) => (cs.group_id == null ? null : `g${cs.group_id}`),
    };
  }
  const levels = [1, 2, 3, 4];
  const groups = levels.map((l) => ({
    key: `L${l}`,
    name: legacyHeading(cohort, l),
    open: !!(cohort.tier_access ?? {})[String(l)],
    legacyLevel: l,
  }));
  return { groups, groupKeyFor: (cs) => `L${cs.level}` };
}

function sectionTitle(cs, genericById) {
  if (cs.display_name) return cs.display_name;
  const m = /^generic_(\d+)$/.exec(cs.section_id);
  if (m) return genericById.get(Number(m[1]))?.title ?? `(missing generic ${m[1]})`;
  return cs.section_id; // built-in: title is static code, identity is the id
}

export function computeSnapshot(rows, { mode }) {
  const genericById = new Map(rows.generic_sections.map((g) => [g.id, g]));
  const unlockedByParticipant = new Map();
  for (const u of rows.unlocked_sections) {
    if (!unlockedByParticipant.has(u.participant_id)) unlockedByParticipant.set(u.participant_id, new Set());
    unlockedByParticipant.get(u.participant_id).add(u.section_id);
  }

  const cohorts = {};
  for (const c of rows.cohorts) {
    const useMode =
      mode === "auto" ? (c.groups_converted_at ? "groups" : "legacy") : mode;
    const { groups, groupKeyFor } = cohortGroups(c, rows, useMode);
    const groupByKey = new Map(groups.map((g) => [g.key, g]));
    const sections = rows.cohort_sections
      .filter((cs) => cs.cohort_id === c.id)
      .map((cs) => ({ ...cs, groupKey: groupKeyFor(cs) }));

    // Admin list: every row, ordered by group order then sort order (what the
    // admin Sections tab shows), including hidden rows.
    const orderIndex = new Map(groups.map((g, i) => [g.key, i]));
    const ordered = [...sections].sort(
      (a, b) =>
        (orderIndex.get(a.groupKey) ?? 999) - (orderIndex.get(b.groupKey) ?? 999) ||
        a.sort_order - b.sort_order ||
        a.id - b.id,
    );
    const admin = ordered.map((cs) => ({
      sectionId: cs.section_id,
      title: sectionTitle(cs, genericById),
      group: groupByKey.get(cs.groupKey)?.name ?? "(no group)",
      groupOpen: groupByKey.get(cs.groupKey)?.open ?? null,
      visible: !!cs.visible,
      code: cs.code ?? null,
      codeActive: !!cs.code_active,
      displayName: cs.display_name ?? null,
    }));

    // Participant view: visible rows, grouped; empty groups hidden (today's
    // sidebar/workbook behaviour).
    const participants = {};
    for (const p of rows.participants.filter((p) => p.cohort_id === c.id)) {
      const unlocked = unlockedByParticipant.get(p.id) ?? new Set();
      const view = [];
      for (const g of groups) {
        const items = ordered
          .filter((cs) => cs.visible && cs.groupKey === g.key)
          .map((cs) => ({
            sectionId: cs.section_id,
            title: sectionTitle(cs, genericById),
            unlocked: g.open || !cs.code_active || unlocked.has(cs.section_id),
            hasCode: !!cs.code && !!cs.code_active,
          }));
        if (items.length === 0) continue;
        view.push({ heading: g.name, open: g.open, sections: items });
      }
      participants[`${p.id}:${p.email}`] = view;
    }

    const orphan = sections.filter((cs) => cs.groupKey == null).length;
    cohorts[`${c.id}:${c.cohort_code}`] = {
      mode: useMode,
      converted: !!c.groups_converted_at,
      orphanRows: orphan,
      groups: groups.map((g) => ({ name: g.name, open: g.open })),
      admin,
      participants,
    };
  }
  return { cohorts };
}

function diff(a, b, path, out) {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} → ${b.length}`);
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) { out.push(`${path}[${i}]: ${JSON.stringify(a[i])} → ${JSON.stringify(b[i])}`); if (out.length > 60) return; }
      return;
    }
    a.forEach((v, i) => diff(v, b[i], `${path}[${i}]`, out));
    return;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${path}.${k}`, out);
    return;
  }
  out.push(`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === "queries") {
    for (const [k, q] of Object.entries(QUERIES)) console.log(`-- ${k}\n${q};\n`);
    return;
  }
  const envIdx = args.indexOf("--env");
  const env = envIdx >= 0 ? args[envIdx + 1] : "dev";
  if (cmd === "snapshot") {
    const rows = loadRows(args);
    const snap = computeSnapshot(rows, { mode: "auto" });
    const nCohorts = Object.keys(snap.cohorts).length;
    const nParts = Object.values(snap.cohorts).reduce((n, c) => n + Object.keys(c.participants).length, 0);
    mkdirSync("generated-artifacts", { recursive: true });
    const file = `generated-artifacts/groups-verify-${env}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify({ env, takenAt: new Date().toISOString(), ...snap }, null, 2));
    console.log(`Snapshot written: ${file}`);
    console.log(`  cohorts: ${nCohorts}, participants: ${nParts}`);
    for (const [k, c] of Object.entries(snap.cohorts))
      console.log(`  ${k}: mode=${c.mode} rows=${c.admin.length} participants=${Object.keys(c.participants).length} groups=${c.groups.map((g) => `${g.name}${g.open ? " (open)" : ""}`).join(" | ")}`);
    return;
  }
  if (cmd === "compare") {
    const file = args.find((a) => a.endsWith(".json") && !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--rows");
    if (!file) throw new Error("compare needs a snapshot file");
    const before = JSON.parse(readFileSync(file, "utf8"));
    const rows = loadRows(args);
    const after = computeSnapshot(rows, { mode: "groups" });
    const problems = [];
    for (const [k, c] of Object.entries(after.cohorts)) {
      if (!c.converted) problems.push(`${k}: NOT CONVERTED (groups_converted_at is null)`);
      if (c.orphanRows) problems.push(`${k}: ${c.orphanRows} section rows without a group`);
    }
    for (const k of Object.keys(before.cohorts)) if (!after.cohorts[k]) problems.push(`${k}: cohort missing after conversion`);
    for (const k of Object.keys(after.cohorts)) if (!before.cohorts[k]) problems.push(`${k}: cohort not in snapshot (created after snapshot?)`);
    for (const k of Object.keys(before.cohorts)) {
      if (!after.cohorts[k]) continue;
      const b = before.cohorts[k], a = after.cohorts[k];
      // Converted cohorts always carry all four legacy groups; the snapshot's
      // legacy path lists four too, so group lists compare directly.
      diff(b.groups, a.groups, `${k}.groups`, problems);
      diff(b.admin, a.admin, `${k}.admin`, problems);
      diff(b.participants, a.participants, `${k}.participants`, problems);
    }
    const nParts = Object.values(after.cohorts).reduce((n, c) => n + Object.keys(c.participants).length, 0);
    if (problems.length) {
      console.error(`FAIL: ${problems.length} difference(s) across ${Object.keys(after.cohorts).length} cohorts / ${nParts} participants`);
      for (const p of problems.slice(0, 80)) console.error("  " + p);
      process.exit(1);
    }
    console.log(`PASS: ${Object.keys(after.cohorts).length} cohorts, ${nParts} participants — identical headings, order, sections, codes and unlocked state.`);
    return;
  }
  console.error("usage: groups-verify.mjs snapshot|compare <file>|queries [--env dev|production] [--rows file.json]");
  process.exit(2);
}

main();
