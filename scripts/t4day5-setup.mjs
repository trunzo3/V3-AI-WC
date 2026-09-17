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
const p = (...paras) => paras.map((s) => `<p>${s}</p>`).join("");
const text = (...paras) => ({ type: "text", content: p(...paras) });
const titled = (title, ...paras) => ({ type: "text", content: `<p><strong>${title}</strong></p>` + p(...paras) });
const cards = (columns, ...pairs) => ({ type: "cards", columns, cards: pairs.map(([title, body]) => ({ title, body })) });
const steps = (...pairs) => ({ type: "steps", ordered: true, items: pairs.map(([title, body]) => ({ title, body })) });
const callout = (variant, content, title) => ({ type: "callout", variant, content, ...(title ? { title } : {}) });
const prompt = (label, content) => ({ type: "prompt", label, content });
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
function form(opts, ...fields) {
  return {
    type: "form",
    buttonLabel: opts.button ?? "Copy",
    copyStyle: opts.copyStyle ?? "labeled",
    cardLayout: true,
    formName: opts.name,
    collectResponses: !!opts.collect,
    ...(opts.collect ? { responsesOpen: true } : {}),
    fields: fields.map((f) => ({
      fieldKey: key(f.label),
      label: f.label,
      ...(f.heading ? { heading: f.heading } : {}),
      ...(f.help ? { helpText: `<p>${f.help}</p>` } : {}),
      ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      multiline: f.multiline ?? true,
    })),
  };
}
const REF = "REFERENCE", IND = "INDIVIDUAL", GRP = "GROUP";
const S = (title, badge, goal, blocks) => ({
  title, badgeLabel: badge, goalText: goal ?? null,
  sectionType: badge === REF ? "reference" : "exercise",
  showNotesField: true, defaultLevel: 4, contentBlocks: blocks,
});

const plan = [
  ["SEE", S("Three Ways to Put AI to Work", REF, null, [
    cards(3,
      ["CHAT", "You ask, it answers. Copilot and other chatbots. For drafting, summarizing, thinking out loud."],
      ["AUTOMATE", "You set the steps, it runs them. n8n, Power Automate. For work that happens the same way every time."],
      ["DELEGATE", "You give it a goal, it finds the path. A task, software, or a whole workflow — Replit, Lovable, Copilot Studio. For work where the steps are not known in advance."]),
    callout("insight", "On the left, you do the work. On the right, it does the work."),
    text("What does my division do by hand that it shouldn't?"),
  ])],
  ["SEE", S("Consider the Work", IND, "Something your division could use.", [
    text("You are not going to build software today. You will be speaking it into existence. Describe it well enough that what comes back is what you meant. Same skill you use with IT, with a vendor, and with the person two doors down."),
    steps(
      ["Look at your own division", "Not the whole department. The work you are accountable for."],
      ["Name what is done by hand", "Where the spreadsheet is. Who emails whom. Where it stalls."],
      ["Pick one thing", "Small. A tracker, a checklist, a form that becomes a summary."],
      ["Write it in one sentence", "What it should do that nobody has to do by hand anymore."]),
    form({ name: "One sentence", button: "Copy my sentence" },
      { label: "YOUR ONE THING", heading: "What should it do that nobody has to do by hand anymore?" }),
  ])],
  ["SEE", S("Anatomy of Working Software", REF, null, [
    text("You're opening a restaurant. How do people get in?"),
    cards(2,
      ["THE DOOR", "Login. Who gets in, and what each role can see."],
      ["THE DINING ROOM", "Front end. What people see and touch."],
      ["THE KITCHEN", "Logic. Where the rules run."],
      ["THE FREEZER", "Database. Where everything is stored."]),
    text("Describe those four and you have written a Product Requirements Document."),
  ])],
  ["SEE", S("Build Your Mini-PRD", GRP, "One build per table.", [
    steps(
      ["Pick a scribe", "Someone to type into the Workshop Companion for the group."],
      ["Document your requirements", "Fill in the boxes below, then Copy and Submit. Anthony builds from what you submit."]),
    form({ name: "Mini-PRD", collect: true, copyStyle: "labeled", button: "Copy my PRD" },
      { label: "Table number", heading: "Required.", multiline: false },
      { label: "Table name", heading: "Optional.", multiline: false },
      { label: "One sentence", heading: "What should it do that nobody has to do by hand anymore?" },
      { label: "Login", heading: "Who gets in, and what each role can see." },
      { label: "Front end", heading: "What people see and touch." },
      { label: "Logic", heading: "Where the rules run." },
      { label: "Database", heading: "Where everything is stored." },
      { label: "Requirements and considerations", heading: "Anything the build has to respect." }),
    titled("Your builds", "Links to the working prototypes will be added here during lunch."),
  ])],
  ["TOOLS", S("AI, ML, and LLMs", REF, null, [
    text("Artificial Intelligence is the broad field. Machine Learning is a subset of AI — it is already in your life: fraud detection at Visa, Face ID, Netflix recommendations, Outlook spam filtering, Google Maps routing. Large Language Models are a subset of Machine Learning — Claude, ChatGPT, Gemini — and they power tools like Copilot, NotebookLM, Notion AI, Canva AI, and Gamma."),
    cards(3,
      ["LARGE", "A vast knowledge base, trained on an enormous amount of text."],
      ["LANGUAGE", "Natural, like you're typing or speaking to a person."],
      ["MODEL", "The name of the tool itself: Claude, GPT, Gemini, and the rest."]),
    callout("rule", "The goal isn't to know everything. It's to know enough to lead, experiment, and decide."),
  ])],
  ["TOOLS", S("The Tools You Have", REF, null, [
    text("At work."),
    cards(3,
      ["MICROSOFT COPILOT", "General purpose. Drafting, summarizing, reorganizing, planning. Works across Outlook, Teams, Word, and SharePoint inside the Caltrans tenant. Best at language tasks on your own material. Weak at facts it was not given, numbers, anything it has to look up."],
      ["TRAFFIC MOBILITY INSIGHT", "Purpose-built. Answers questions against a defined mobility dataset. Narrow, and accurate inside its lane. Best at the questions it was built for. Weak at anything outside the data it was pointed at."],
      ["ROAD SAFETY INSIGHT", "Purpose-built. Same architecture, different data: crash and safety records. Best at pattern questions on safety data. Weak at general drafting. It is not a writing tool."]),
    text("At home: Claude, ChatGPT, Gemini."),
  ])],
  ["TOOLS", S("Many Ways In", REF, null, [
    text("How are you using LLMs today? Every one of these is a language task. None requires the tool to know a fact it was not given."),
    cards(2,
      ["DRAFT", "Memos, emails, talking points. The blank page problem."],
      ["SYNTHESIZE", "Five reports into one view. Twenty comments into three themes."],
      ["DISTILL", "Forty pages into one. What survives is what matters."],
      ["BRAINSTORM", "Options and angles you had not considered."],
      ["PLAN", "A sequence. An agenda. The questions before a vendor call."]),
  ])],
  ["TOOLS", S("Draft with Instructions and Role", IND, "See what each part of a prompt changes.", [
    text("Run these three in order, in a new Copilot chat each time. Notice what changes."),
    prompt("1st prompt · Instruction", "Write an email about a new policy requiring staff to complete training within 30 days."),
    prompt("2nd prompt · Instruction + Role", "You are a supportive supervisor who knows your team is stretched thin. Write an email about a new policy requiring staff to complete training within 30 days."),
    prompt("3rd prompt · Switch the role", "You are a construction foreman who runs a tight ship. Write an email about a new policy requiring staff to complete training within 30 days."),
    form({ name: "Role notes", button: "Copy" }, { label: "DEBRIEF", heading: "How did the role change it?" }),
  ])],
  ["TOOLS", "riceco-framework"],
  ["TOOLS", S("Real Work", IND, "Leave with one finished.", [
    text("Your real queue. Not the important things — the recurring, language-heavy things. \"A briefing memo due Thursday.\" \"Forty public comments to summarize.\" The one you name is the one you work on. Real material. Real deadline."),
    form({ name: "Real work", button: "Copy my notes" },
      { label: "DRAFT", heading: "Create something new — email, report, talking points, agenda", help: "Ex: Memos, emails, talking points. The blank page problem.", placeholder: "Add your notes here…" },
      { label: "SYNTHESIZE", heading: "Combine many things into one view", help: "Ex: Five reports into one view. Twenty comments into three themes.", placeholder: "Add your notes here…" },
      { label: "DISTILL", heading: "Shrink something long down to what matters", help: "Ex: Forty pages into one. What survives is what matters.", placeholder: "Add your notes here…" },
      { label: "BRAINSTORM", heading: "Generate options and angles", help: "Ex: Options and angles you had not considered.", placeholder: "Add your notes here…" },
      { label: "PLAN", heading: "Sequence the work", help: "Ex: A rollout sequence. An agenda. The questions before a vendor call.", placeholder: "Add your notes here…" }),
  ])],
  ["SHAPE", S("Human in the Loop", REF, null, [
    text("The fix isn't better AI. It's a human in the loop. Beginning: you direct. Middle: AI processes. End: you edit and oversee it."),
    callout("stop", "These systems perform trust. They don't earn it. The better they get at the performance, the harder it is to remember. Your job: understand it. Don't trust it.", "The trap"),
  ])],
  ["SHAPE", S("Where It Earns Its Place", REF, null, [
    text("Which of your real tasks suit the tools you actually have? Recurring, language-heavy work. Not anything the number has to be right on."),
    text("An agent is different. You hand it a goal. It decides what files to create, writes them, hits errors, reads the errors, fixes them, and keeps going until something ran. Their words went in. An agent did the rest."),
  ])],
  ["WRONG", S("Pattern Matching and Hallucination", REF, null, [
    text("An LLM predicts the next word based on massive training data. It's not retrieving a fixed answer; it's generating a likely sequence. When it lands on truth, we call it an answer. When it lands on false, we call it a hallucination. Same process either way. It doesn't know it's right. It doesn't know it's wrong. It's always guessing."),
    text("More context means better predictions. \"Mary ___\" could be anything. \"Mary had a little ___\" is almost certainly one word. Vague prompts get vague outputs. Your context is the lever."),
    callout("quote", "You: That statistic you cited — where did it come from?\nAI: It's from the 2023 National Workforce Study by the Bureau of Labor Statistics.\nYou: I can't find that study. Does it exist?\nAI: I filled in a pattern that I thought belonged there.", "When AI gets caught"),
  ])],
  ["WRONG", "what-ai-is"],
  ["WRONG", S("Context", REF, null, [
    cards(2,
      ["ONE CHAT", "Everything typed so far. That is what it works from. A fouled chat stays fouled — the bad assumption is in the context."],
      ["WHAT IT CAN REACH", "Files, mail, documents. Some tools read what you point them at. Whether yours does is a configuration question, not a capability one."],
      ["ACROSS SESSIONS", "What it remembers. Claude and GPT carry memory and projects. Copilot chat, as you have it, starts fresh each time."],
      ["TO AN AGENT", "What you hand it, plus what it fetches. The leap that makes agents useful and risky at once."]),
    text("Bad context is why more prompting stops helping. Know which layer the problem is in."),
    cards(3,
      ["DRIFT", "The topic wandered. Twenty exchanges in, the chat is somewhere else. Start a new one."],
      ["FOULED", "A bad assumption got baked in. Every answer now leans into it. Edit the earlier prompt, or abandon the chat."],
      ["BAD REPLIES", "Same wrong thing, again. More prompting will not fix it. The context is the problem. Sunset it."]),
  ])],
  ["WRONG", S("Create Your Context", IND, "What do you want it to remember about you?", [
    steps(
      ["Pick a task where the tool would need to know you", "Where a generic answer wouldn't work, because of your audience, your division, or how it has to sound."],
      ["Fill in the boxes that would have the most impact", "Role, acronyms, formatting. Skip the rest."],
      ["Copy, paste into a new Copilot chat, then type the task", "How did your context document influence it?"]),
    form({ name: "Portable context", copyStyle: "labeled", button: "Copy my context" },
      { label: "ROLE", heading: "What should AI know about your role?", help: "Your title or function and where you sit in the organization." },
      { label: "WORK", heading: "What should AI know about the work you're responsible for?", help: "Recurring responsibilities that affect the help you need." },
      { label: "TERMS", heading: "What terminology or acronyms should AI understand without explanation?", help: "Only terms you use regularly." },
      { label: "RULES", heading: "What standing rules or constraints should AI always account for?", help: "Requirements that apply across most of your work." },
      { label: "TONE", heading: "What should AI know about your preferred tone?", help: "How responses should generally sound." },
      { label: "FORMAT", heading: "How do you prefer information to be organized?", help: "BLUF, bullets, sections, tables, or narrative." },
      { label: "DEPTH", heading: "How much detail do you usually want?", help: "Your normal level of depth or concision." },
      { label: "DELIVERABLES", heading: "What kinds of deliverables do you commonly want AI to produce?", help: "Emails, memos, briefings, talking points, or analyses." },
      { label: "AVOID", heading: "What should AI avoid doing?", help: "Recurring response habits that make the output less useful." }),
  ])],
  ["WRONG", "llm-peer-review"],
  ["WRONG", "power-follow-ups"],
  ["WRONG", S("Cognitive Erosion", REF, null, [
    text("It's not laziness. It's misplaced confidence. Confidence in the tool lowers critical thinking; confidence in yourself raises it. Effort drops most at the judgment end — evaluation, synthesis, analysis. Tool first, thinking second: the order matters."),
    text("The failure is invisible until a decision goes wrong. Gradual drift: session one you edit, session three you copy-paste. Output homogenizes — the memos start sounding alike. \"It wrote it\" replaces \"I wrote it.\" Skill loss shows up only when the tool is gone. Two or three people trusted the polish before it reached you."),
    cards(2,
      ["ASK WHAT TO CONSIDER", "Ask what to consider and why, before you ask for the answer."],
      ["THINK FIRST", "Draft the skeleton yourself, then use the tool."],
      ["MAKE IT ARGUE", "Have it argue the other side of your draft. \"What would an expert check here that I haven't?\""],
      ["HAVE IT QUIZ YOU", "On your own document, before you send it."]),
    callout("rule", "Ask where it came from. Keep one hard thing by hand. Reward the catch. Model it yourself. Prevention is structural: the tool is designed to make carelessness feel like competence.", "What a leader does"),
  ])],
  ["LEAD", S("What Else Is Possible", REF, null, [
    text("Beyond Copilot, Traffic Mobility Insight, and Road Safety Insight. Remember the three ways: Chat, Automate, Delegate."),
    titled("Automate — the path is fixed, AI can live inside it"),
    steps(["Trigger", "Something happens."], ["AI step", "Summarize, classify, extract."], ["Action", "Update, route, create."], ["Output", "Notify, store, send."]),
    text("The workflow does not decide what happens next. You already did."),
    text("Delegate — the path is discovered while the work is happening. Example: \"Prepare Monday's executive brief.\" The agent pulls the calendar, project data, email updates, and policy news, asks what's missing, searches an alternate source, synthesizes, drafts. The path changes when the evidence changes."),
    callout("insight", "Some of the people you lead have used these tools. They know the gap."),
  ])],
  ["LEAD", S("Shadow AI", REF, null, [
    callout("insight", "Shadow AI is evidence. It tells leaders where capability, policy, and user need are out of alignment."),
    text("You did not choose it. Copilot arrived in an update — every M365 tenant got it. Gemini arrived in a browser patch that IT approved as a security fix. Connectors arrive through your own tools: an approved tool with an admin panel connects to anything. The question is not whether you have shadow AI. It is whether you can see it."),
    titled("Read the signal — the workaround is telling you something"),
    cards(3,
      ["CAPABILITY", "The approved tool cannot do the job. People reach outside when the sanctioned option stops short."],
      ["POLICY", "The rules do not match the work. A blanket restriction collides with a legitimate operational need."],
      ["ENABLEMENT", "People do not know the sanctioned path. The capability may exist; they just don't know how to reach it."]),
    text("Before you punish the workaround, diagnose the gap."),
    cards(2,
      ["\"WHO IS USING UNAPPROVED AI?\"", "Finds a person."],
      ["\"WHAT ARE THEY TRYING TO ACCOMPLISH THAT THEY CANNOT ACCOMPLISH ANOTHER WAY?\"", "Finds the gap."]),
    cards(2,
      ["SURVEILLANCE", "Catch it. Stop it. People learn what not to tell you. The behavior gets harder to see, not less common."],
      ["SUNLIGHT", "See it. Understand it. Ask what the tool is doing for them. Visibility gives you something you can actually govern."]),
    text("Make the sanctioned path win. People choose the approved path when it gives them more, not merely when policy tells them to: approved data, shared prompts, internal knowledge, better integrations, reusable workflows. Compliance is not the incentive. Capability is."),
    callout("rule", "Enable, train, make the path known — that sets the direction and gets people to tell you what they use. Then check at machine speed. AI runs at machine speed, so the check on it has to.", "Trust but verify"),
    form({ name: "Bring it home", button: "Copy" },
      { label: "HONEST GUESS", heading: "What is your division already using that you cannot see?", help: "Not what they may use. What they use. Personal ChatGPT. Claude on a phone." },
      { label: "WHY", heading: "What need is that tool meeting that the sanctioned path does not?" },
      { label: "MONDAY", heading: "Sunlight or surveillance? Say which, and name the first move." }),
  ])],
  ["LEAD", S("Data Safety", REF, null, [
    text("Before we talk about AI safety, let's talk about data safety. Optimize entirely for efficiency and everything is wide open. Optimize entirely for safety and we'd never send an email. Every organization lives somewhere in the middle."),
    text("\"Is this safe?\" is not a question that has an answer. Safe compared to what? For which material? Against which alternative you already use?"),
    text("It already happened. In 2024, researchers extracted over 2,700 real credentials — API keys, passwords, access tokens — from GitHub's AI, which had learned them during training and suggested them to other developers. When model improvement is on, your inputs may be used to improve the product. Turning model improvement off is a controllable setting, and it should be checked before any sensitive work."),
    titled("How your tools handle your data"),
    cards(2,
      ["OUTLOOK & SHAREPOINT", "Stored on Microsoft's servers. Encrypted. Not used to build products for others. Kept until you delete it."],
      ["PAYROLL / HR", "Stored on the vendor's servers. Encrypted. Not used to build products for others. Kept 4+ years by federal law."],
      ["COPILOT, CALTRANS TENANT", "Stored in Microsoft's government cloud. Encrypted. Not used to build products for others, by contract. Kept per the state agreement."],
      ["CONSUMER AI", "Stored on the AI company's servers. Encrypted. Used to build products for others only if model improvement is on. Kept until you delete it."]),
    callout("insight", "The security question is not \"is AI safe?\" It's \"what's the data, what are the settings, and what does my organization allow?\""),
    callout("rule", "For a staffer, safety is a toggle. For you, safety is a policy: which tools your people may use, and how you find out when they use something else."),
  ])],
  ["LEAD", "red-yellow-green"],
  ["FRAMEWORK", S("The Change Message Framework", REF, null, [
    text("You already wrote it. Now say it in order."),
    steps(["Forces", "What changed outside."], ["Practices", "How we do it today."], ["Consequences", "What that costs now."], ["A stronger path", "What we saw."], ["Impact", "What is different in 90 days."]),
    text("Five sentences. Repeated in the all-hands, the hallway, and the one-on-one until it sticks."),
    cards(2,
      ["SKIP THE COST", "\"Here is a better way.\" Lands as a preference. Preferences lose to the status quo."],
      ["NAME THE COST FIRST", "\"Here is what today costs. Here is the better way.\" Lands as a recovery. The same words, in that order, move people."]),
    text("The brain registers a gain only against a loss. Steps 2–3 are the loss. Steps 4–5 are the gain. Skip either half and the message stops working."),
  ])],
  ["CLOSE", S("What You Know Now", IND, "One sentence each. Eight minutes.", [
    form({ name: "Five sentences", copyStyle: "labeled", button: "Copy my five sentences" },
      { label: "OUTSIDE", heading: "What changed around your division that nobody in it chose?" },
      { label: "TODAY", heading: "How does your division do that work right now? Say it without judgment." },
      { label: "COST", heading: "Knowing what you know now, what is that costing?" },
      { label: "SAW IT", heading: "What did you see built today that changes that?" },
      { label: "90 DAYS", heading: "What is different in 90 days if it works?" }),
    text("Hand it to the person next to you. They read your five sentences out loud, in order. Which sentence is weakest? Which one would your division argue with?"),
  ])],
  ["CLOSE", S("Two Sentences", IND, "The ones you would actually say.", [
    text("Rewrite rows 1 and 2 as speech. Who hears it: a direct report who did not ask. Competent, busy, quietly skeptical. Then say it to your partner. They answer one question only: \"What did you just hear me asking you to do?\" If the answer is \"nothing yet,\" the opening worked."),
    form({ name: "Two sentences", collect: true, copyStyle: "joined", button: "Copy" },
      { label: "SENTENCE ONE", heading: "What changed outside your division." },
      { label: "SENTENCE TWO", heading: "How your division does that work today — said so they nod, not flinch." }),
  ])],
  ["CLOSE", S("Three Concepts That Ride Along", REF, null, [
    cards(3,
      ["HUMAN IN THE LOOP", "Verify before it circulates. Facts, math, sources."],
      ["SUNLIGHT, NOT SURVEILLANCE", "\"I want to know what you already use.\" Not to stop you. To understand what it does for you."],
      ["WHERE IT EARNS ITS PLACE", "Recurring, language-heavy. Not anything the number has to be right on."]),
    text("Three concepts, no more. They repeat until your division can say them back."),
  ])],
  ["CLOSE", S("Talk It Out", IND, null, [
    form({ name: "What clicked", collect: true, copyStyle: "labeled", button: "Copy" },
      { label: "WHAT CLICKED", heading: "One insight, technique, or moment that stuck." },
      { label: "WHO NEEDS TO HEAR IT", heading: "A peer CEA who was not in this room. What would you tell them first?" }),
    text("Tell us how we did — two minutes in the Feedback tab, now, while it is fresh. Tomorrow: Day 6, Succession Planning and Leadership Legacy. Same room. Bring the two sentences you wrote today."),
  ])],
];

// ---------------------------------------------------------------------------
// Idempotent setup. Safe to rerun: finds the cohort by code, reuses generic
// sections already present (matched by exact title among unslugged generic
// sections), creates only what is missing, and re-applies the section layout:
//   - the 28 Day 5 sections at Level 4, visible, in plan order, with codes
//   - every other Level 1-3 row visible (locked unless the level is opened)
//   - built-in Level 4 rows hidden
// Cohort fields and existing generic-section content are never rewritten;
// only the library default level of the 23 Day 5 sections is forced to 4.
// Usage: API_BASE=https://host ADMIN_PASSWORD=... node scripts/t4day5-setup.mjs
// ---------------------------------------------------------------------------
const CODE = "T4DAY5";
if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
console.log("target", B);
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });

let cohort = (await api("GET", "/admin/cohorts")).cohorts.find(
  (c) => c.cohortCode.toUpperCase() === CODE,
);
if (cohort) {
  console.log("cohort exists", cohort.id);
} else {
  cohort = (await api("POST", "/admin/cohorts", {
    name: "Tier 4 CEA Leadership — Day 5",
    cohortCode: CODE,
    workbookEnabled: true,
    tierAccess: { "1": false, "2": false, "3": false, "4": false },
    homeMessage: "<p>Welcome. This is your companion for the day and your record of it afterward. Sections unlock as we go. Everything you write here is yours — download your workbook anytime, or come back later.</p>",
    facilitatorMessage: "<p>Anthony Trunzo · IQmeetEQ · (415) 418-8236 · talkwithanthony.com</p>",
  })).cohort;
  console.log("cohort created", cohort.id);
}

const attachedBefore = (await api("GET", `/admin/cohorts/${cohort.id}/sections`)).sections;
const allGeneric = (await api("GET", "/admin/generic-sections")).sections;
const attachedIds = new Set(attachedBefore.map((s) => s.sectionId));
function findExistingGeneric(title) {
  const matches = allGeneric.filter((g) => g.title === title && !g.slug && !g.archived);
  if (matches.length === 0) return null;
  const attached = matches.find((g) => attachedIds.has(`generic_${g.id}`));
  if (attached) return attached;
  if (matches.length > 1) throw new Error(`Ambiguous generic section title: ${title}`);
  return matches[0];
}

const rows = [];
let order = 0;
let created = 0;
let relevelled = 0;
for (const [code, item] of plan) {
  let sectionId;
  if (typeof item === "string") {
    sectionId = item;
  } else {
    let g = findExistingGeneric(item.title);
    if (!g) {
      g = (await api("POST", "/admin/generic-sections", item)).section;
      created++;
      console.log("created generic", g.id, item.title);
    }
    // Day 5 content lives under Level 4 in the admin library.
    if (g.defaultLevel !== 4) {
      await api("PUT", `/admin/generic-sections/${g.id}`, { defaultLevel: 4 });
      relevelled++;
      console.log("set default level 4", g.id, item.title);
    }
    sectionId = `generic_${g.id}`;
  }
  rows.push({ sectionId, level: 4, sortOrder: order++, displayName: null, visible: true, code, codeActive: true });
}
if (rows.length !== 28) throw new Error(`Expected 28 plan rows, got ${rows.length}`);

const listed = new Set(rows.map((r) => r.sectionId));
for (const s of attachedBefore) {
  if (listed.has(s.sectionId)) continue;
  rows.push({
    sectionId: s.sectionId,
    level: s.level,
    sortOrder: order++,
    displayName: s.displayName ?? null,
    visible: s.level < 4,
    code: s.code ?? null,
    codeActive: s.codeActive ?? true,
  });
}
await api("PUT", `/admin/cohorts/${cohort.id}/sections`, rows);

const after = (await api("GET", `/admin/cohorts/${cohort.id}/sections`)).sections;
const summary = {};
for (const s of after) {
  const k = `L${s.level} ${s.visible ? "visible" : "hidden"}`;
  summary[k] = (summary[k] ?? 0) + 1;
}
console.log("generic sections created:", created);
console.log("generic sections moved to library level 4:", relevelled);
console.log("layout:", summary);
console.log("level 4 order:", after.filter((s) => s.level === 4 && s.visible).map((s) => `${s.code}:${s.title}`).join(" | "));
