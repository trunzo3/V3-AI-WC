// ---------------------------------------------------------------------------
// Caltrans Day 5 (v2): duplicate the "Tier 4 CEA Leadership — Day 5" cohort
// (code T4DAY5) into a new cohort T4DAY5V2 and revise the COPY only, through
// the admin API. The original cohort and its library sections are never
// written; the script snapshots them and verifies they are unchanged.
//
// Default is a DRY RUN that prints the full plan. Set APPLY=1 to write.
// Usage:
//   ADMIN_PASSWORD=... [API_BASE=https://host] [APPLY=1] node scripts/caltrans-day5-v2.mjs
//
// Safe to re-run: reuses an existing T4DAY5V2 cohort, finds sections through
// that cohort's own section rows (never by title alone), skips edits already
// applied, and refuses to edit any library section attached to another cohort.
// ---------------------------------------------------------------------------
const B = (process.env.API_BASE ?? "http://localhost:80").replace(/\/$/, "") + "/api";
const APPLY = process.env.APPLY === "1";
const SRC_CODE = "T4DAY5";
const NEW_CODE = "T4DAY5V2";
const NEW_NAME = "Tier 4 CEA Leadership — Day 5 (v2)";

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
async function write(method, path, body, what) {
  if (!APPLY) {
    console.log(`  [dry-run] would ${method} ${path} — ${what}`);
    return null;
  }
  console.log(`  ${method} ${path} — ${what}`);
  return api(method, path, body);
}
// Key-order-insensitive deep equality: the API stores blocks as jsonb, which
// reorders object keys, so a naive JSON.stringify comparison never matches.
const canon = (v) =>
  Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

// ----- block helpers (same shapes as t4day5-setup.mjs) ---------------------
const text = (html) => ({ type: "text", content: html });
const cards = (columns, ...pairs) => ({ type: "cards", columns, cards: pairs.map(([title, body]) => ({ title, body })) });
const steps = (...pairs) => ({ type: "steps", ordered: true, items: pairs.map(([title, body]) => ({ title, body })) });
const callout = (variant, content, title) => ({ type: "callout", variant, content, ...(title ? { title } : {}) });
const prompt = (label, content) => ({ type: "prompt", label, content });
const field = (fieldKey, label, extra = {}) => ({ fieldKey, label, multiline: true, ...extra });
function form(opts, fields) {
  return {
    type: "form",
    buttonLabel: opts.buttonLabel ?? "Copy",
    copyStyle: opts.copyStyle ?? "labeled",
    cardLayout: true,
    formName: opts.formName,
    collectResponses: !!opts.collectResponses,
    ...(opts.collectResponses ? { responsesOpen: true } : {}),
    fields,
  };
}

// ----- STEP 2: edits to copied sections ------------------------------------
// Each editor takes the live blocks and returns { blocks, title?, notes[] }.
// They are idempotent: an already-applied change is detected and skipped.
// They throw when an anchor block cannot be found, so nothing is written.
function findIndex(blocks, pred, what) {
  const i = blocks.findIndex(pred);
  if (i < 0) throw new Error(`anchor not found: ${what}`);
  return i;
}
const isText = (b, startsWith) => b.type === "text" && b.content.replace(/^<p>/, "").startsWith(startsWith);

const EDITS = {
  "Three Ways to Put AI to Work": (blocks) => {
    const notes = [];
    const out = [...blocks];
    const ci = findIndex(out, (b) => b.type === "cards", "cards block");
    const note = text("Shown as examples. Not approved for Caltrans use.");
    if (!same(out[ci + 1], note)) {
      out.splice(ci + 1, 0, note);
      notes.push("insert note text after cards");
    }
    return { blocks: out, notes };
  },

  "Consider the Work": (blocks) => {
    const notes = [];
    const out = [...blocks];
    const newSteps = steps(
      ["Look at your organization", "Your work, your department's work, cross-department work, etc."],
      ["Name what is done by hand", "What is the process? Where does it stall? What automation or connection would make it better?"],
      ["Pick something to improve", "A dashboard, connectivity between two data sets, a way to distribute information, etc."],
      ["Write it in 3 or fewer sentences", "What it should do that would solve (part of) the problem."],
    );
    const si = findIndex(out, (b) => b.type === "steps", "steps block");
    if (!same(out[si], newSteps)) { out[si] = newSteps; notes.push("replace steps block"); }
    const newForm = form(
      { buttonLabel: "Copy", copyStyle: "labeled", formName: "Consider the Work", collectResponses: true },
      [field("your_idea", "YOUR IDEA", { heading: "What should it do that would solve (part of) the problem?", helpText: "<p>3 sentences or fewer.</p>" })],
    );
    const fi = findIndex(out, (b) => b.type === "form", "form block");
    if (!same(out[fi], newForm)) { out[fi] = newForm; notes.push("replace form block"); }
    const tail = [
      text("<p><strong>Then, at your table</strong></p>"),
      steps(
        ["Share yours", "3 or fewer sentences each. Forty seconds. No selling it."],
        ["Find the one", "Which would help the most people, or remove the most tedious step? Debate briefly."],
        ["Pick it", "One per table. Share with the room during the debrief."],
      ),
    ];
    if (!same(out.slice(fi + 1, fi + 3), tail)) {
      out.splice(fi + 1, 0, ...tail);
      notes.push("add 'Then, at your table' text + steps after form");
    }
    return { blocks: out, notes };
  },

  "Cognitive Erosion": (blocks) => {
    const out = [
      text("<p>One possible pattern in how people use AI. The label is who wrote the first draft.</p>"),
      steps(
        ["Here's a draft. Critique it.", "I did the thinking and made the first attempt. AI helps me find weaknesses."],
        ["Here's a draft. Rewrite it.", "I supply the draft and the reasoning. AI reshapes it. I judge what to accept."],
        ["Draft it. I'll adjust.", "AI makes the first attempt. I check it against my purpose and the evidence, then make the decision myself."],
        ["Draft it. I'll skim it.", "Confidence in past results starts to replace real scrutiny."],
        ["Draft it. I'll send it as is.", "I pass the answer along without checking its reasoning."],
      ),
      callout("insight", "The risk is not that AI wrote the first draft. It's repeatedly giving up the work of questioning, checking and explaining."),
      text("<p>Ask yourself: What thinking disappeared? Can you still explain and defend what you sent?</p>"),
      text("<p><strong>What it looks like from your chair</strong></p>"),
      cards(2,
        ["What feels different?", "\"This doesn't sound like them.\" \"This could describe any organization.\" \"It keeps repeating the same point.\" \"Where did that detail come from?\""],
        ["Patterns you may recognize", "Repeated \"not X, but Y\" phrasing. Everything packaged into tidy threes. Inflated vocabulary: \"delve,\" \"tapestry,\" \"pivotal.\" Chatbot leftovers: \"Certainly! Here's…\""],
      ),
      callout("rule", "These are conversation cues, not proof. Ask: \"How did you use AI on this?\"", "Enough to ask"),
    ];
    return { blocks: out, notes: same(out, blocks) ? [] : ["replace ALL content blocks"] };
  },

  "Data Safety": (blocks) => {
    const notes = [];
    let out = [...blocks];
    const di = out.findIndex((b) => isText(b, "It already happened. In 2024, researchers extracted"));
    if (di >= 0) { out.splice(di, 1); notes.push("delete 'It already happened…' text block"); }
    const ai = findIndex(out, (b) => b.type === "text" && b.content.includes("\"Is this safe?\" is not a question that has an answer"), "'Is this safe?' text block");
    const ins = [
      text("<p><strong>Where does your sensitive data live right now?</strong></p>"),
      cards(3,
        ["DOCUMENTS", "BCPs, contracts, draft correspondence. SharePoint? A shared drive? A laptop?"],
        ["EMAIL", "Who else can read it, including the vendor?"],
        ["PEOPLE", "Payroll and personnel files. State system, or a vendor?"],
      ),
    ];
    if (!same(out.slice(ai + 1, ai + 3), ins)) {
      out.splice(ai + 1, 0, ...ins);
      notes.push("insert 'Where does your sensitive data live' text + 3 cards after 'Is this safe?'");
    }
    return { blocks: out, notes };
  },

  "Shadow AI": (blocks) => {
    const notes = [];
    const out = [...blocks];
    const quote = callout(
      "quote",
      "\"When the Governor's 2023 AI executive order came out, the energy went into governing AI — policies, procedures, guardrails. Almost none went into educating people on responsible use. That was a miss.\" — Assistant chief, state department. Public panel, state technology conference, August 2026.",
      "Governing before educating",
    );
    const ci = findIndex(out, (b) => b.type === "cards" && b.cards.some((c) => c.title === "SURVEILLANCE") && b.cards.some((c) => c.title === "SUNLIGHT"), "SURVEILLANCE / SUNLIGHT cards");
    if (!same(out[ci - 1], quote)) { out.splice(ci, 0, quote); notes.push("insert quote callout before SURVEILLANCE / SUNLIGHT cards"); }
    const ri = findIndex(out, (b) => b.type === "callout" && b.variant === "rule" && b.content.startsWith("Enable, train, make the path known"), "final rule callout");
    const contact = text("<p>Questions, ideas, or tool requests: AI@dot.ca.gov</p>");
    if (!same(out[ri + 1], contact)) { out.splice(ri + 1, 0, contact); notes.push("insert contact text after final rule callout"); }
    return { blocks: out, notes };
  },

  "What You Know Now": (blocks, title) => {
    const notes = [];
    const out = [...blocks];
    const fi = findIndex(out, (b) => b.type === "form", "form block");
    const newForm = {
      ...out[fi],
      fields: [
        field("forces", "FORCES", { heading: "The external pressure" }),
        field("current_practices", "CURRENT PRACTICES", { heading: "How we do it today" }),
        field("consequences", "CONSEQUENCES", { heading: "What that costs now" }),
        field("stronger_path", "A STRONGER PATH", { heading: "What we saw" }),
        field("impact", "IMPACT", { heading: "What is different in 90 days" }),
      ],
      formName: "Change message",
      collectResponses: true,
      responsesOpen: true,
    };
    if (!same(out[fi], newForm)) { out[fi] = newForm; notes.push("replace form fields; formName 'Change message'; collect responses"); }
    const newTitle = "Create Your Change Message";
    if (title !== newTitle) notes.push(`rename section to "${newTitle}"`);
    return { blocks: out, title: newTitle, notes };
  },

  "Two Sentences": (blocks) => replaceInText(blocks, "Rewrite rows 1 and 2 as speech.", "Rewrite your Forces and Current Practices sentences as speech."),

  "Talk It Out": (blocks) => {
    const r = replaceInText(
      blocks,
      "Tomorrow: Day 6, Succession Planning and Leadership Legacy. Same room. Bring the two sentences you wrote today.",
      "Tomorrow: Day 6 — Leading for Lasting Impact. Same room.",
    );
    const out = r.blocks;
    const fi = findIndex(out, (b) => b.type === "form", "form block");
    const help = {
      "WHAT CLICKED": "<p>An insight, technique, risk, or reward that stuck.</p>",
      "WHO NEEDS TO HEAR IT": "<p>A peer CEA, your boss, someone else who was not in this room. What would you tell them first?</p>",
    };
    const fields = out[fi].fields.map((f) => (help[f.label] ? { ...f, helpText: help[f.label] } : f));
    for (const label of Object.keys(help)) {
      if (!fields.some((f) => f.label === label)) throw new Error(`Talk It Out: field ${label} not found`);
    }
    if (!same(fields, out[fi].fields)) { out[fi] = { ...out[fi], fields }; r.notes.push("set helpText on WHAT CLICKED / WHO NEEDS TO HEAR IT"); }
    return r;
  },
};

function replaceInText(blocks, from, to) {
  const out = [...blocks];
  const i = out.findIndex((b) => b.type === "text" && b.content.includes(from));
  if (i < 0) {
    if (out.some((b) => b.type === "text" && b.content.includes(to))) return { blocks: out, notes: [] };
    throw new Error(`text not found: "${from.slice(0, 40)}…"`);
  }
  out[i] = { ...out[i], content: out[i].content.replace(from, to) };
  return { blocks: out, notes: [`replace "${from.slice(0, 40)}…" in text block`] };
}

// ----- STEP 3: new library sections ----------------------------------------
const S = (title, badge, goal, sectionType, blocks) => ({
  title, badgeLabel: badge, goalText: goal ?? null, sectionType,
  showNotesField: true, defaultLevel: 4, contentBlocks: blocks,
});
const SCENARIO_PH = "ON: red, yellow or green. OFF: red, yellow or green. Why?";
const NEW_SECTIONS = [
  S("LLM Peer Review", "INDIVIDUAL", "Two sets of eyes are better than one.", "exercise", [
    steps(["Draft", "One tool writes it."], ["Critique", "A different chat reads it."], ["Revise", "Back to the first chat."]),
    prompt("Chat A · Draft", "Draft a [what you need].\n\n[Paste or describe your material.]"),
    prompt("Chat B · Critique", "You are a skeptical reviewer. Below is a draft. What is wrong, unsupported, or missing? Critique only. Do not rewrite it.\n\n[PASTE THE DRAFT FROM CHAT A]"),
    prompt("Back to Chat A · Revise", "Here's what Chat B said. Is this critique useful? Tell me which points you accept and which you reject, and why. Then revise the draft.\n\n[PASTE CHAT B'S CRITIQUE]"),
    callout("insight", "Different models catch different errors and carry different biases. Using them to check each other is a structural safeguard, not just a best practice."),
  ]),
  S("Power Follow-Ups", "REFERENCE", null, "reference", [
    cards(3,
      ["SIMPLIFY", "\"ELI12\" (Explain like I'm 12)"],
      ["FLIP", "\"Make the case against this.\""],
      ["FORMAT", "\"Turn this into a table.\""],
      ["SOURCE", "\"Where did that come from?\""],
      ["CUT", "\"What would you remove?\""]),
    callout("insight", "The first response is raw material, not a final product. Every follow-up is an editing decision.", "Key Principle"),
  ]),
  S("Cognitive Growth", "INDIVIDUAL", "What will you reinforce?", "exercise", [
    text("<p>Five ways to ask AI to deepen your understanding while you do real work. Add the subject and any approved context in the chat.</p>"),
    prompt("Explain it", "Explain it using something I know.\n\nSubject: [what you are trying to understand]\nSomething I know well: [an area you already understand]"),
    prompt("Connect it", "Connect it to what I've learned.\n\nSubject: [what you are trying to understand]\nWhat I've learned so far: [paste the ideas or material]"),
    prompt("Another way", "Show me another way to look at this.\n\n[Paste or describe the work]"),
    prompt("Challenge it", "Here's my reasoning. Challenge it.\n\n[Your reasoning]"),
    prompt("Apply it", "Show me how this applies to my work.\n\nMy task: [describe it]\nConstraints: [what it has to work within]"),
    callout("rule", "Use an approved tool with material permitted in that tool. Important facts still need an authoritative source or a knowledgeable person."),
    text("<p><strong>What leaders reinforce</strong></p>"),
    cards(2,
      ["ASK FOR THE REASONING", "\"Walk me through how you reached that recommendation.\""],
      ["MAKE LEARNING VISIBLE", "\"What do you understand better after working through this?\""],
      ["REWARD THE CATCH", "\"Good catch. What helped you spot that?\""],
      ["MODEL IT YOURSELF", "\"Here's how I used AI to challenge my own thinking.\""]),
    form({ buttonLabel: "Copy", copyStyle: "labeled", formName: "Next week", collectResponses: false }, [
      field("next_week", "NEXT WEEK", { heading: "Which of these will your team see you do next week?", helpText: "<p>Pick one behavior and name the situation where you will use it.</p>" }),
    ]),
  ]),
  S("Red / Yellow / Green", "GROUP", "Define data safety — for yourself.", "exercise", [
    cards(3,
      ["GREEN · RELATIVELY SAFE", "Normal business data in an approved system."],
      ["YELLOW · IT DEPENDS", "Sensitive or contextual. Needs safeguards."],
      ["RED · RISKY", "Should not be shared casually in any system."]),
    text("<p>Say it out loud. Twice per scenario: model improvement ON, then OFF. No answer key. The point is hearing the room disagree.</p>"),
    form({ buttonLabel: "Copy my calls", copyStyle: "labeled", formName: "Red / Yellow / Green", collectResponses: false }, [
      field("scenario_1", "SCENARIO 1", { heading: "You paste a draft public-facing press release into an LLM to make it clearer.", placeholder: SCENARIO_PH }),
      field("scenario_2", "SCENARIO 2", { heading: "You paste a contractor's name, contact details, and specific contract terms into an LLM to help draft a follow-up email.", placeholder: SCENARIO_PH }),
      field("scenario_3", "SCENARIO 3", { heading: "You paste an email thread with the Legislature's staff about a pending bill into an LLM to help draft a response.", placeholder: SCENARIO_PH }),
      field("scenario_4", "SCENARIO 4", { heading: "You paste public comments from a project hearing, naming specific residents and parcels, into an LLM to find patterns.", placeholder: SCENARIO_PH }),
      field("scenario_5", "SCENARIO 5", { heading: "You attach meeting notes that include a personnel discussion to pull out action items.", placeholder: SCENARIO_PH }),
      field("scenario_6", "SCENARIO 6", { heading: "You attach a district's quarterly delivery summary (projects, status, dollar figures) to draft an update for the Director.", placeholder: SCENARIO_PH }),
      field("what_changes_the_call", "WHAT CHANGES THE CALL", { heading: "What would move a Yellow to Green for you?" }),
    ]),
    callout("insight", "The governance question is not \"is AI safe?\" It's \"what's the data, what are the settings, and what does my organization allow?\""),
  ]),
];

// ----- STEP 4: Level 4 layout ----------------------------------------------
// Entries: { code, title } for generic rows (matched through the cohort's
// rows), { code, builtin } for built-in ids, { code, new: title } for sections
// created in step 3.
const LAYOUT = [
  ["SEE", { title: "Three Ways to Put AI to Work" }],
  ["SEE", { title: "Consider the Work" }],
  ["SEE", { title: "Anatomy of Working Software" }],
  ["SEE", { title: "Build Your Mini-PRD" }],
  ["SEE", { title: "The Tools You Have" }],
  ["SHAPE", { title: "AI, ML, and LLMs" }],
  ["SHAPE", { title: "Many Ways In" }],
  ["SHAPE", { title: "Draft with Instructions and Role" }],
  ["SHAPE", { builtin: "riceco-framework" }],
  ["SHAPE", { title: "Context" }],
  ["SHAPE", { title: "Create Your Context" }],
  ["SHAPE", { new: "Power Follow-Ups" }],
  ["SHAPE", { title: "Real Work" }],
  ["SHAPE", { title: "Where It Earns Its Place" }],
  ["WRONG", { title: "Human in the Loop" }],
  ["WRONG", { title: "Pattern Matching and Hallucination" }],
  ["WRONG", { builtin: "what-ai-is" }],
  ["WRONG", { new: "LLM Peer Review" }],
  ["WRONG", { title: "Cognitive Erosion" }],
  ["WRONG", { new: "Cognitive Growth" }],
  ["BALANCE", { title: "What Else Is Possible" }],
  ["BALANCE", { title: "Data Safety" }],
  ["BALANCE", { new: "Red / Yellow / Green" }],
  ["LEAD", { title: "Shadow AI" }],
  ["LEAD", { title: "The Change Message Framework" }],
  ["LEAD", { title: "Create Your Change Message", was: "What You Know Now" }],
  ["LEAD", { title: "Two Sentences" }],
  ["LEAD", { title: "Talk It Out" }],
];

// ===========================================================================
if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
console.log(APPLY ? "MODE: APPLY (writing)" : "MODE: DRY RUN (nothing will change; set APPLY=1 to write)");
console.log("target", B);
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });

const cohorts = (await api("GET", "/admin/cohorts")).cohorts;
const byCode = (code) => cohorts.find((c) => c.cohortCode.toUpperCase() === code);
const src = byCode(SRC_CODE);
if (!src) throw new Error(`source cohort ${SRC_CODE} not found`);
let dst = byCode(NEW_CODE);

// Snapshot the original cohort + its attached library sections.
const genericsById = async () => new Map((await api("GET", "/admin/generic-sections")).sections.map((g) => [g.id, g]));
const srcRowsBefore = (await api("GET", `/admin/cohorts/${src.id}/sections`)).sections;
let generics = await genericsById();
const srcGenericIds = srcRowsBefore.map((r) => r.sectionId).filter((s) => s.startsWith("generic_")).map((s) => Number(s.slice(8)));
const srcGenericsBefore = JSON.stringify(canon(srcGenericIds.map((id) => generics.get(id))));
console.log(`source cohort ${src.id} "${src.name}": ${srcRowsBefore.length} rows, ${srcGenericIds.length} library sections`);

// ----- STEP 1 ---------------------------------------------------------------
console.log("\nSTEP 1: duplicate");
let rows;
if (dst) {
  console.log(`  cohort ${NEW_CODE} already exists (id ${dst.id}) — reusing`);
  rows = (await api("GET", `/admin/cohorts/${dst.id}/sections`)).sections;
} else {
  const r = await write("POST", `/admin/cohorts/${src.id}/duplicate`, { name: NEW_NAME, cohortCode: NEW_CODE }, `create "${NEW_NAME}" (${NEW_CODE})`);
  if (r) {
    dst = r.cohort;
    console.log(`  created cohort ${dst.id}: ${r.sectionCount} rows, ${r.genericSectionsCopied} library sections copied`);
    generics = await genericsById();
    rows = (await api("GET", `/admin/cohorts/${dst.id}/sections`)).sections;
  } else {
    // Dry run with no copy yet: plan against the original's rows/content so
    // every anchor is validated. Nothing is written.
    console.log("  (dry run: planning against the original's content; the copy will have new section ids)");
    rows = srcRowsBefore;
  }
}

// Section lookup through the cohort's own rows only.
const genericRows = rows.filter((r) => r.sectionId.startsWith("generic_"));
function rowByTitle(title) {
  const matches = genericRows.filter((r) => (generics.get(Number(r.sectionId.slice(8)))?.title ?? r.title) === title);
  if (matches.length !== 1) throw new Error(`expected exactly one row titled "${title}" in cohort ${dst?.id ?? "(planned)"}, found ${matches.length}`);
  return matches[0];
}

// Safety: a library section may only be edited if this cohort is its sole user.
const attachmentIndex = new Map(); // sectionId -> [cohortId]
const allCohorts = dst && !cohorts.some((c) => c.id === dst.id) ? [...cohorts, dst] : cohorts;
for (const c of allCohorts) {
  const rs = c.id === src.id ? srcRowsBefore : c.id === dst?.id ? rows : (await api("GET", `/admin/cohorts/${c.id}/sections`)).sections;
  for (const r of rs) attachmentIndex.set(r.sectionId, [...(attachmentIndex.get(r.sectionId) ?? []), c.id]);
}
function assertExclusive(sectionId, title) {
  if (!dst) return; // dry run before duplication: the copy does not exist yet
  const users = attachmentIndex.get(sectionId) ?? [];
  if (users.length !== 1 || users[0] !== dst.id) {
    throw new Error(`refusing to edit ${sectionId} "${title}": attached to cohorts ${users.join(", ")} (must be only ${dst.id})`);
  }
}

// ----- STEP 2 ---------------------------------------------------------------
console.log("\nSTEP 2: edit copied sections");
const renamed = new Map(); // old title -> new title (for layout lookup)
for (const [title, edit] of Object.entries(EDITS)) {
  let row;
  try {
    row = rowByTitle(title);
  } catch (e) {
    // Re-run after a rename: find it under the new title.
    if (title === "What You Know Now") row = rowByTitle("Create Your Change Message");
    else throw e;
  }
  const gid = Number(row.sectionId.slice(8));
  const g = generics.get(gid);
  if (!g) throw new Error(`library section ${gid} missing`);
  const { blocks, title: newTitle, notes } = edit(g.contentBlocks, g.title);
  const label = `${row.sectionId} "${g.title}"`;
  if (notes.length === 0) {
    console.log(`  ${label}: already up to date`);
    continue;
  }
  assertExclusive(row.sectionId, g.title);
  console.log(`  ${label}:`);
  for (const n of notes) console.log(`    - ${n}`);
  const body = { contentBlocks: blocks, ...(newTitle && newTitle !== g.title ? { title: newTitle } : {}) };
  const res = await write("PUT", `/admin/generic-sections/${gid}`, body, `${notes.length} change(s)`);
  if (res) {
    if (!same(res.section.contentBlocks, blocks)) throw new Error(`content did not persist on ${label}`);
    generics.set(gid, res.section);
  }
  if (newTitle) renamed.set(title, newTitle);
}

// ----- STEP 3 ---------------------------------------------------------------
console.log("\nSTEP 3: create new library sections");
const newIds = new Map(); // title -> sectionId
for (const spec of NEW_SECTIONS) {
  const existing = genericRows.filter((r) => generics.get(Number(r.sectionId.slice(8)))?.title === spec.title);
  if (existing.length > 1) throw new Error(`more than one "${spec.title}" row in cohort`);
  if (existing.length === 1) {
    console.log(`  "${spec.title}": already attached as ${existing[0].sectionId} — not recreating`);
    newIds.set(spec.title, existing[0].sectionId);
    continue;
  }
  console.log(`  "${spec.title}": create (badge ${spec.badgeLabel}, ${spec.sectionType}, ${spec.contentBlocks.length} blocks)`);
  const res = await write("POST", "/admin/generic-sections", spec, "new library section, level 4");
  if (res) {
    generics.set(res.section.id, res.section);
    newIds.set(spec.title, `generic_${res.section.id}`);
  } else {
    newIds.set(spec.title, `generic_<new:${spec.title}>`);
  }
}

// ----- STEP 4 ---------------------------------------------------------------
console.log("\nSTEP 4: Level 4 order, codes, visibility");
const builtinRow = (id) => {
  const r = rows.find((x) => x.sectionId === id);
  if (!r) throw new Error(`built-in row ${id} not in cohort`);
  return r;
};
const layoutRows = [];
let order = 0;
for (const [code, e] of LAYOUT) {
  let sectionId;
  if (e.builtin) sectionId = builtinRow(e.builtin).sectionId;
  else if (e.new) sectionId = newIds.get(e.new);
  else {
    let row;
    try { row = rowByTitle(e.title); } catch (err) { if (e.was) row = rowByTitle(e.was); else throw err; }
    sectionId = row.sectionId;
  }
  layoutRows.push({ sectionId, level: 4, sortOrder: order++, displayName: null, visible: true, code, codeActive: true });
}
if (layoutRows.length !== 28) throw new Error(`expected 28 visible rows, got ${layoutRows.length}`);
const seen = new Set(layoutRows.map((r) => r.sectionId));
if (seen.size !== 28) throw new Error("duplicate section in layout");

const finalRows = [];
// Levels 1–3: exactly as duplicated.
for (const r of rows.filter((x) => x.level < 4).sort((a, b) => a.sortOrder - b.sortOrder)) {
  finalRows.push({ sectionId: r.sectionId, level: r.level, sortOrder: r.sortOrder, displayName: r.displayName ?? null, visible: r.visible, code: r.code ?? null, codeActive: r.codeActive ?? true });
}
order = Math.max(-1, ...finalRows.map((r) => r.sortOrder)) + 1;
for (const r of layoutRows) finalRows.push({ ...r, sortOrder: order++ });
// Remaining Level 4 rows: kept, hidden.
const hiddenL4 = rows.filter((x) => x.level === 4 && !seen.has(x.sectionId)).sort((a, b) => a.sortOrder - b.sortOrder);
for (const r of hiddenL4) {
  finalRows.push({ sectionId: r.sectionId, level: 4, sortOrder: order++, displayName: r.displayName ?? null, visible: false, code: r.code ?? null, codeActive: r.codeActive ?? true });
}
const titleOf = (sid) => {
  if (sid.startsWith("generic_<new:")) return sid.slice(13, -1) + " (new)";
  if (sid.startsWith("generic_")) return generics.get(Number(sid.slice(8)))?.title ?? sid;
  return rows.find((r) => r.sectionId === sid)?.title ?? sid;
};
console.log("  Level 1–3 rows kept as duplicated:", finalRows.filter((r) => r.level < 4).length);
console.log("  Level 4 visible, in order:");
layoutRows.forEach((r, i) => console.log(`    ${String(i + 1).padStart(2)}. [${r.code.padEnd(7)}] ${titleOf(r.sectionId)}  (${r.sectionId})`));
console.log("  Level 4 hidden:");
hiddenL4.forEach((r) => console.log(`      - ${titleOf(r.sectionId)}  (${r.sectionId})${r.visible ? "  ← was visible" : ""}`));
await write("PUT", `/admin/cohorts/${dst?.id ?? "<new>"}/sections`, finalRows, `${finalRows.length} rows`);

// ----- STEP 5 ---------------------------------------------------------------
console.log("\nSTEP 5: verify");
if (APPLY) {
  const after = (await api("GET", `/admin/cohorts/${dst.id}/sections`)).sections
    .filter((r) => r.level === 4)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  console.log(`  cohort ${dst.id} "${dst.name}" (${NEW_CODE}) Level 4:`);
  after.forEach((r, i) => console.log(`    ${String(i + 1).padStart(2)}. ${r.title}  code=${r.code}  visible=${r.visible}`));
  const visibleCount = after.filter((r) => r.visible).length;
  if (visibleCount !== 28) throw new Error(`expected 28 visible Level 4 rows, found ${visibleCount}`);
}
const srcRowsAfter = (await api("GET", `/admin/cohorts/${src.id}/sections`)).sections;
const genericsNow = await genericsById();
const srcGenericsAfter = JSON.stringify(canon(srcGenericIds.map((id) => genericsNow.get(id))));
const rowsSame = same(srcRowsBefore, srcRowsAfter);
const contentSame = srcGenericsBefore === srcGenericsAfter;
console.log(`  original ${SRC_CODE} (cohort ${src.id}): section rows unchanged = ${rowsSame}; library content unchanged = ${contentSame}`);
if (!rowsSame || !contentSame) throw new Error("ORIGINAL COHORT CHANGED — investigate");
console.log(APPLY ? "\nDone." : "\nDry run complete. Nothing was written.");
