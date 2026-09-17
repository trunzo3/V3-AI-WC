// Restore emptied library (generic) sections from a full JSON export, via the
// admin API. Only sections whose live contentBlocks is empty are touched;
// cohorts, participants, notes and responses are never read or written.
//
//   node scripts/restore-generic-sections.mjs <backup.json>            # dry run
//   APPLY=1 node scripts/restore-generic-sections.mjs <backup.json>    # write
//   KEEP_LIVE_LEVEL=1 ...   # restore everything except defaultLevel
//   API_BASE=https://... ADMIN_PASSWORD=... for production
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/restore-generic-sections.mjs <backup.json>");
  process.exit(1);
}
if (!process.env.ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}
const APPLY = process.env.APPLY === "1";
const KEEP_LIVE_LEVEL = process.env.KEEP_LIVE_LEVEL === "1";
const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";

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

const backup = JSON.parse(readFileSync(file, "utf8"));
const backupSections = backup.genericSections;
if (!Array.isArray(backupSections)) throw new Error("backup has no genericSections array");
console.log(`backup exported ${backup.exportedAt}, ${backupSections.length} generic sections`);
console.log(`target ${B}  mode=${APPLY ? "APPLY" : "DRY RUN"}${KEEP_LIVE_LEVEL ? " (keeping live defaultLevel)" : ""}`);

await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });
const live = new Map((await api("GET", "/admin/generic-sections")).sections.map((s) => [s.id, s]));
console.log(`live has ${live.size} generic sections`);

const counts = { restored: 0, hasContent: 0, missingLive: 0, emptyInBackup: 0 };
for (const b of backupSections) {
  const l = live.get(b.id);
  if (!l) {
    counts.missingLive++;
    continue;
  }
  if (Array.isArray(l.contentBlocks) && l.contentBlocks.length > 0) {
    counts.hasContent++;
    continue;
  }
  if (!Array.isArray(b.contentBlocks) || b.contentBlocks.length === 0) {
    counts.emptyInBackup++;
    console.log(`  skip #${b.id} "${b.title}": empty in backup too`);
    continue;
  }
  const payload = {
    contentBlocks: b.contentBlocks,
    goalText: b.goalText ?? null,
    sectionType: b.sectionType,
    showNotesField: b.showNotesField,
    badgeLabel: b.badgeLabel ?? null,
    ...(KEEP_LIVE_LEVEL ? {} : { defaultLevel: b.defaultLevel }),
  };
  const levelNote = KEEP_LIVE_LEVEL || l.defaultLevel === b.defaultLevel
    ? ""
    : `  level ${l.defaultLevel} -> ${b.defaultLevel}`;
  console.log(
    `  ${APPLY ? "restore" : "would restore"} #${b.id} "${b.title}": ${b.contentBlocks.length} blocks, ${b.sectionType}, badge=${b.badgeLabel ?? "-"}${levelNote}`,
  );
  if (APPLY) {
    const { section } = await api("PUT", `/admin/generic-sections/${b.id}`, payload);
    if (!Array.isArray(section.contentBlocks) || section.contentBlocks.length !== b.contentBlocks.length) {
      throw new Error(`#${b.id} did not come back with the expected blocks; stopping`);
    }
  }
  counts.restored++;
}

console.log(
  `${APPLY ? "restored" : "would restore"}: ${counts.restored}` +
    ` | left alone (still have content): ${counts.hasContent}` +
    ` | not on live (id not found): ${counts.missingLive}` +
    ` | empty in backup: ${counts.emptyInBackup}`,
);
