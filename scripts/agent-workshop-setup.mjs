#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Agent Workshop cohort setup — from "Agent Workshop: Companion content"
// V20261112B (attached_assets/Pasted--Agent-Workshop-Companion-content-…).
//
// Builds, via the admin API: the AGENT cohort (empty start), its six groups
// in order (all locked), and 37 library sections in the "AI Agents" topic,
// attached in order (visible, codeActive true, code null).
//
// Idempotent and non-destructive: a library section is matched by title
// (unslugged, unarchived; prefer one already attached to this cohort). An
// existing section's content is never rewritten, except that unresolved
// {{key:field}} links are replaced with {{generic_N:field}} once the target
// section exists. Groups are matched by name.
//
// Usage: [API_BASE=https://host] ADMIN_PASSWORD=... node scripts/agent-workshop-setup.mjs
// ---------------------------------------------------------------------------
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

// ----- block helpers --------------------------------------------------------
// Inline **bold** -> <strong>; everything else is literal.
const md = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const p = (...paras) => paras.map((s) => `<p>${md(s)}</p>`).join("");
const text = (...paras) => ({ type: "text", content: p(...paras) });
const steps = (...pairs) => ({ type: "steps", ordered: true, items: pairs.map(([title, body]) => ({ title, body: md(body ?? "") })) });
const check = (...pairs) => ({ type: "steps", ordered: false, items: pairs.map(([title, body]) => ({ title, body: md(body ?? "") })) });
const callout = (variant, content, title) => ({ type: "callout", variant, content: p(content), ...(title ? { title } : {}) });
const see = (content) => callout("insight", content, "You should see");
const confirm = (content) => callout("rule", content, "TO CONFIRM");
const box = (label, content) => ({ type: "prompt", label, buttonLabel: "Copy", content });
const cards = (columns, ...pairs) => ({ type: "cards", columns, cards: pairs.map(([title, body]) => ({ title, body: md(body) })) });
// Form defaults: card layout on, prompt box off, Copy button off, collect
// responses off, multiline on. {send:true} = sends to you (collect on, open).
function form(opts, ...fields) {
  return {
    type: "form",
    buttonLabel: "Copy",
    copyStyle: "labeled",
    cardLayout: true,
    showPromptBox: false,
    showCopyButton: false,
    ...(opts.name ? { formName: opts.name } : {}),
    collectResponses: !!opts.send,
    ...(opts.send ? { responsesOpen: true } : {}),
    fields: fields.map(([label, fieldKey, heading, help, single]) => ({
      fieldKey,
      label,
      ...(heading ? { heading } : {}),
      ...(help ? { helpText: `<p>${md(help)}</p>` } : {}),
      multiline: !single,
    })),
  };
}
// Poll defaults: button "Submit", open, results hidden, one submission off.
// Question: [key, text, choices, {multiple, comment}]
function poll(name, questions, opts = {}) {
  return {
    type: "poll",
    pollName: name,
    buttonLabel: "Submit",
    responsesOpen: true,
    showResults: false,
    oneSubmissionOnly: !!opts.once,
    questions: questions.map(([questionKey, qtext, choices, o = {}]) => ({
      questionKey,
      text: qtext,
      choiceType: o.multiple ? "multiple" : "single",
      choices,
      ...(o.comment ? { allowComment: true, commentLabel: o.comment } : {}),
    })),
  };
}
const ONE_TO_FIVE = ["1", "2", "3", "4", "5"];
const DONE = ["Done", "Not yet"];
const RUN_STATUS = ["Checked and ready", "Needs revision", "Run pending"];
const CONFIDENCE = [
  ["conf-setup", "Setting up an AI assistant to do one job", ONE_TO_FIVE],
  ["conf-check", "Checking an AI result against where it came from", ONE_TO_FIVE],
  ["conf-correct", "Correcting an AI assistant in plain words", ONE_TO_FIVE],
  ["conf-voice", "Getting AI drafts that sound like me", ONE_TO_FIVE],
  ["conf-tracking", "Tracking my sales activity without filling it in by hand", ONE_TO_FIVE],
  ["conf-explain", "Explaining to my owner what AI can safely do for our team", ONE_TO_FIVE],
];

// ----- content ----------------------------------------------------------------
// S(key, title, blocks). Section type is derived: exercise when the section
// has a form, poll or copy box; otherwise reference.
const S = (key, title, blocks) => ({ key, title, blocks });

const GROUPS = [
  ["Before Week 1", [
    S("get-ready", "Get ready", [
      text("Do these three things before Session 1. They take about 15 minutes. If any of them isn't done, you won't be able to build in the session."),
      steps(
        ["Buy Premium or higher, using your work email.", "The plans are listed at docs.x.ai/x-subscription/pricing. A free trial runs out on the first Bot you build, and Plus ($8) doesn't include Grok Bot."],
        ["Install Grok Bot and sign in.", "Make sure it opens. Don't build any Bots yet; we build the first one together."],
        ["Connect your work calendar and work email.", "In Grok Bot, click Connect apps, then connect your work calendar and your work email. You may need to ask whoever manages your email accounts for help."]),
      confirm("[TO CONFIRM: the exact \"Connect apps\" button name and where it sits, and whether it offers read-only access. If it does, step 3 says to choose read-only.]"),
      poll("Readiness check", [
        ["paid-plan", "Is your paid plan active?", DONE],
        ["grok-opens", "Does Grok Bot open on your computer?", DONE],
        ["connected", "Are your work calendar and email connected?", DONE, { comment: "What's blocking you?" }],
      ]),
    ]),
  ]],
  ["Week 1 — Morning Brief", [
    S("before-we-start", "Before we start", [
      text("Before we build: rate where you're starting, tell us where you track your deals, and name one task you'd hand off."),
      text("How confident are you today? 1 = not at all, 5 = very."),
      poll("Where you're starting", CONFIDENCE, { once: true }),
      poll("Your deals", [
        ["deal-tracking", "Where do you track your deals?", ["A CRM", "A spreadsheet", "Nowhere yet"], { comment: "Which CRM or spreadsheet?" }],
      ]),
      form({ name: "One thing", send: true },
        ["ONE THING", "one-thing", "If you could hand one task off tomorrow, what would it be?", "One sentence. Something you do every week."]),
    ]),
    S("morning-brief-job", "One Bot, one job", [
      steps(
        ["Click + (New Bot).", "It's at the top of the sidebar in Grok Bot."],
        ["Type Morning Brief.", "Pick a shape and color, and click Create."],
        ["Check the sidebar.", "Morning Brief appears there."]),
      text("On a team account, + may open a menu. Choose Create a Bot."),
      callout("insight", "One Bot, one job, in one sentence. If your job takes more than one sentence, it's more than one Bot."),
      form({ name: "Morning Brief job", send: true },
        ["JOB", "w1-job", "Morning Brief's one job, in one sentence", "Example: 'Every morning, show me today's meetings and the follow-ups I owe, and where each came from.'"]),
    ]),
    S("first-guardrail", "Set your first guardrail", [
      steps(
        ["In Grok Bot, go to Settings → General → Bot → Custom Rules.", ""],
        ["Add an Ask first rule.", "Copy the box below and paste it as the rule."]),
      box("Ask first rule", "Ask me before sending any message or changing any record."),
      see("Your rule listed under Custom Rules."),
      callout("rule", "Most Grok Bot actions run without asking. This rule makes your Bots ask you first. Loosen it only for a job a Bot has done right many times."),
      confirm("[TO CONFIRM: whether one Ask first rule covers every Bot. If it covers only one, the Follow-Up, Scorecard and Chief of Staff setups each repeat this step.]"),
    ]),
    S("morning-brief-setup", "Set up Morning Brief", [
      steps(
        ["Click Copy", "on the box below."],
        ["Open Morning Brief", "in Grok Bot, paste into the chat, and press Enter."]),
      see("Morning Brief replies that it's ready for today's information. If it starts working on something, type: Wait for today's information."),
      box("Your setup",
        "Your name is Morning Brief. Your one job is: {{morning-brief-job:w1-job}}\n\n" +
        "Use only the approved records I identify for each run. List today's meetings and due follow-ups, showing where each item came from. Keep suggestions separate from facts. Say what is missing or out of date. Return the brief here. Do not send messages or change business records. Ask before using another source. Remember this job and these boundaries. Reply that you are ready for today's information, then wait."),
    ]),
    S("first-brief", "Run your first brief", [
      steps(
        ["Copy the box below.", ""],
        ["Paste it into Morning Brief,", "change the date and time zone to today's, and press Enter."]),
      see("Today's meetings and the follow-ups you owe, each with where it came from: your calendar or your email."),
      box("Ask for today's brief", "Prepare my brief for today, [day and date], [time zone]. Use my connected work calendar and work email. Show where each item came from."),
    ]),
    S("check-it", "Check it", [
      check(
        ["Every meeting:", "is every meeting on today's calendar in the brief?"],
        ["Times:", "are the times right?"],
        ["Follow-ups:", "is every follow-up real? Find the email it came from."],
        ["Sources:", "does every item say where it came from?"]),
      text("**Partner check.** In the meeting chat, start your message with your partner's name. Paste one line from your brief and where it came from. Leave out client names."),
      callout("quote", "Maria — 10:00 site walk, from my Google Calendar.", "Example"),
    ]),
    S("fix-one-thing", "Fix one thing and run it again", [
      steps(
        ["Pick one thing", "the brief got wrong."],
        ["Tell Morning Brief,", "in plain words, what to change."],
        ["Ask for the brief again.", ""]),
      box("Example correction", "Leave personal appointments out of the brief. Remember this from now on."),
      callout("rule", "End a lasting fix with \"Remember this from now on.\" After your context interview (homework), add your lasting fixes to Your context, so every Bot gets them. The Companion doesn't update Grok Bot for you."),
    ]),
    S("keep-version", "Keep the working version", [
      steps(
        ["When the brief looks right,", "copy the box below."],
        ["Paste it into Morning Brief", "and press Enter."]),
      box("Keep this version", "Use this as your standing instruction from now on."),
    ]),
    S("daily-routine", "Set the daily routine", [
      steps(
        ["Copy the box below.", ""],
        ["Paste it into Morning Brief,", "change the time and time zone, and press Enter."]),
      box("Every weekday", "Every weekday at [7:00 AM], [time zone], prepare my brief the same way you just did and send it to me here."),
      see("Morning Brief confirms the schedule, and a routine for your brief appears under Routines in the right panel."),
      callout("insight", "Your first scheduled brief arrives tomorrow morning. A new routine waits for its first scheduled time."),
      confirm("[TO CONFIRM: how participants create a routine (a chat message like this one, or a Routines button) and where it shows]"),
    ]),
    S("hw-three-mornings", "Homework: three mornings", [
      text("Today's practice run counts as Run 1. Morning Brief now sends your brief on its own. Check it on the next two working mornings. About 10 minutes each."),
      text("**Each morning**"),
      steps(
        ["Open the brief Morning Brief sent you.", "If it didn't arrive, ask for it with the box in Run your first brief."],
        ["Check it", "with the checklist in Check it."],
        ["Tell it one thing to change.", ""]),
      confirm("[TO CONFIRM: depends on test T2, whether Morning Brief keeps its job and boundaries the next day. If it doesn't, step 1 becomes: copy the box in Set up Morning Brief, paste it into Morning Brief, then ask for the brief.]"),
      form({ name: "Week 1 runs", send: true },
        ["RUN 1", "run-1", "Today in class: what it got wrong, and what you told it", "Leave out client names."],
        ["RUN 2", "run-2", "Morning 2: what it got wrong, and what you told it", "Leave out client names."],
        ["RUN 3", "run-3", "Morning 3: what it got wrong, and what you told it", "Leave out client names."]),
      poll("Did the brief match your calendar?", [
        ["run-1-status", "Run 1", RUN_STATUS],
        ["run-2-status", "Run 2", RUN_STATUS],
        ["run-3-status", "Run 3", RUN_STATUS],
      ]),
    ]),
    S("context-interview", "Homework: your context interview", [
      text("A regular Grok chat works as an instructor for your Bots. Here it interviews you, one question at a time, and writes the context every Bot will use. About 20 minutes."),
      steps(
        ["Open a new regular Grok chat,", "not Grok Bot."],
        ["Copy the interview box below,", "paste it into the chat, and press Enter."],
        ["Answer its questions.", "For long answers, you can speak instead of typing."],
        ["Copy the document it writes", "and paste it into Your context below."],
        ["Copy the \"Update Morning Brief\" box,", "paste it into Morning Brief, and press Enter."]),
      confirm("[TO CONFIRM: where participants open a regular Grok chat: grok.com, the Grok app, or inside Grok Bot]"),
      confirm("[TO CONFIRM: which voice option to recommend: Grok's voice mode or Wispr Flow]"),
      confirm("[TO CONFIRM: swap in the link to Scott's interview skill once his repo is ready]"),
      box("Context interview",
        "Interview me so you can write a one-page context document that every AI assistant I use can read.\n\n" +
        "Ask one question at a time, and wait for my answer before asking the next. When an answer is vague, ask a follow-up. Cover these six things:\n" +
        "1. Who I am: my role, my company, how long I've been selling\n" +
        "2. What I sell, and to whom\n" +
        "3. Who buys from me: the titles of the people who sign\n" +
        "4. How I sound: how I write and talk to customers\n" +
        "5. My current priorities\n" +
        "6. What an assistant should never do for me\n\n" +
        "When you have enough, tell me. Then write the document in plain words under those six headings."),
      form({ name: "Your context" },
        ["YOUR CONTEXT", "context-doc", "Your context document", "Paste the document the interview wrote. Leave out client names."]),
      box("Update Morning Brief",
        "Remember this about me and my business from now on, and use it in every brief:\n\n{{context-interview:context-doc}}"),
    ]),
    S("missing-detail", "Homework: the missing-detail test", [
      text("About 5 minutes. This shows what Morning Brief does when information is missing."),
      confirm("[TO CONFIRM: depends on test T4, whether the Bot fills in a removed detail from your connected calendar]"),
      steps(
        ["Save tomorrow's schedule as a text file", "and delete one meeting's time."],
        ["Attach the file", "in Morning Brief."],
        ["Copy the box below,", "paste it, and press Enter."]),
      box("Test copy only", "Use only this test copy for this run. Do not supply missing details from previous messages, memory or connected accounts. Prepare the brief and explicitly identify information you cannot verify from this copy."),
      see("The brief says that meeting's time is missing, instead of filling it in."),
      form({},
        ["WHAT IT DID", "missing-detail-result", "What did the Bot do with the missing time?"]),
    ]),
    S("before-week-2", "Before Week 2", [
      text("Have these ready for Session 2. They go into Grok Bot, not the Companion."),
      steps(
        ["Three emails you've sent that sound like you at your best.", "Copy them into a document and remove client names."],
        ["Your notes from one recent meeting.", "Rough notes are fine."]),
    ]),
  ]],
  ["Week 2 — Follow-Up", [
    S("voice-rules", "Your voice rules", [
      callout("quote", "Overeager openers. Lists of three. Stacked adjectives. \"I hope this finds you well.\" A summary paragraph at the end.", "What gives AI email away"),
      form({},
        ["WORDS I USE", "w2-use", "Words and phrases you use", "Example: \"Quick question,\" \"Here's where we are.\""],
        ["WORDS I NEVER USE", "w2-never", "Words you'd never write", "Example: \"Synergy,\" \"circle back,\" \"I hope this finds you well.\""],
        ["LENGTH", "w2-length", "How long your emails run", "Example: \"Five sentences or fewer.\""],
        ["SIGN-OFF", "w2-signoff", "How you sign off", "Example: \"Thanks, Mike\""],
        ["FORMALITY", "w2-formality", "New contacts versus long-time ones", "Example: \"Formal with new contacts, first names after the first meeting.\""]),
    ]),
    S("never-send", "Never send without review", [
      callout("stop", "A person reviews these before they go out, every time: pricing, schedule commitments, anything about a complaint or a safety issue, and anything going to a public agency."),
      callout("insight", "Would the customer be fine reading this if they knew a Bot drafted it?", "The dignity check"),
      form({ name: "Never-send additions", send: true },
        ["ADD YOUR OWN", "w2-review-list", "What would you add for your business?", "Examples from the trades: change orders, bid numbers, safety incidents."]),
    ]),
    S("strong-followup", "What a strong follow-up says", [
      cards(3,
        ["THEIR PROBLEM", "Recap it in their words, not yours."],
        ["THE NEXT STEP", "Confirm it, with a date."],
        ["ONE USEFUL THING", "Something they didn't ask for but will use."]),
    ]),
    S("followup-setup", "Set up Follow-Up", [
      steps(
        ["Click + (New Bot)", "in Grok Bot."],
        ["Type Follow-Up.", "Pick a shape and color, and click Create."],
        ["Fill in Follow-Up's job", "below."],
        ["Click Copy", "on the setup box, paste it into Follow-Up, and press Enter."],
        ["Paste the three emails", "you saved before this session."]),
      see("Follow-Up says it's ready for your meeting notes."),
      form({ name: "Follow-Up job", send: true },
        ["JOB", "w2-job", "Follow-Up's one job, in one sentence", "Example: 'After a meeting, draft a follow-up email from my notes.'"]),
      box("Follow-Up setup",
        "Your name is Follow-Up. Your one job is: {{followup-setup:w2-job}}\n\n" +
        "When I give you notes from a meeting, draft a follow-up email for me to review. Do not send anything. Every follow-up does three things: recaps their problem in their words, confirms the next step with a date, and adds one useful thing they didn't ask for.\n\n" +
        "Flag these for my review every time: pricing, schedule commitments, anything about a complaint or a safety issue, and anything going to a public agency.\n" +
        "My additions to that list: {{never-send:w2-review-list}}\n\n" +
        "MY CONTEXT\n{{context-interview:context-doc}}\n\n" +
        "MY VOICE\n" +
        "Words I use: {{voice-rules:w2-use}}\n" +
        "Words I never use: {{voice-rules:w2-never}}\n" +
        "Length: {{voice-rules:w2-length}}\n" +
        "Sign-off: {{voice-rules:w2-signoff}}\n" +
        "Formality: {{voice-rules:w2-formality}}\n\n" +
        "Next I'll paste three emails that sound like me at my best. Reply that you're ready for meeting notes, then wait."),
    ]),
    S("first-followup", "Draft your first follow-up", [
      steps(
        ["Copy the first box", "and paste it into Follow-Up."],
        ["Replace the brackets", "with the meeting notes you saved, and press Enter."],
        ["Edit the draft", "until you'd send it."],
        ["Copy the second box,", "paste it with your edited version, and press Enter."]),
      box("Draft from my notes", "Here are my notes from my meeting with [who] on [date]:\n\n[paste your notes]\n\nDraft the follow-up."),
      box("Here's what I sent", "Here's the version I sent. Note what I changed and do it that way next time:\n\n[paste your edited version]"),
    ]),
    S("hw-two-followups", "Homework: two real follow-ups", [
      text("Run Follow-Up after two real meetings this week. Edit each draft, then paste your edited version back with the second box in Draft your first follow-up. About 15 minutes each."),
      form({ name: "Week 2 follow-ups", send: true },
        ["MEETING 1", "meeting-1", "What did you change most in the first draft?", "Leave out client names."],
        ["MEETING 2", "meeting-2", "What did you change most in the second draft?", "Leave out client names."]),
      poll("Week 2 check", [
        ["pasted-back", "Did you paste your edited versions back to Follow-Up?", ["Both", "One", "Neither"]],
        ["colleague-spotted", "Did a colleague spot which email the Bot drafted?", ["Yes", "No", "Didn't ask"]],
      ]),
    ]),
    S("before-week-3", "Before Week 3", [
      text("Have these ready for Session 3."),
      steps(
        ["Your weekly targets:", "calls, meetings, proposals out and follow-ups sent. If you don't have them in writing, ask your manager this week."],
        ["Your deal list.", "If you use a CRM, we'll help you connect it before Session 3. If you don't keep a deal list, make a Google Sheet with one row per open deal: name, company, stage, next step."]),
    ]),
  ]],
  ["Week 3 — Scorecard", [
    S("weekly-targets", "Your weekly targets", [
      text("Enter the targets you agreed with your manager. If you don't have any yet, enter your best guess and agree them this week."),
      form({},
        ["CALLS", "w3-calls", "Calls per week", null, true],
        ["MEETINGS", "w3-meetings", "Meetings per week", null, true],
        ["PROPOSALS", "w3-proposals", "Proposals out per week", null, true],
        ["FOLLOW-UPS", "w3-followups", "Follow-ups sent per week", null, true],
        ["AGREED WITH", "w3-agreed", "Who you agreed these with", null, true]),
    ]),
    S("scorecard-setup", "Set up Scorecard", [
      steps(
        ["Click + (New Bot)", "in Grok Bot."],
        ["Type Scorecard.", "Pick a shape and color, and click Create."],
        ["Fill in Scorecard's job", "below."],
        ["Click Copy", "on the setup box, paste it into Scorecard, and press Enter."],
        ["Connect your deals.", "Paste your deal list's Google Sheet link and press Enter."]),
      confirm("[TO CONFIRM: the step for participants who use a CRM, which depends on which CRMs Grok Bot connects to]"),
      see("Scorecard says it's ready to count your week."),
      form({ name: "Scorecard job", send: true },
        ["JOB", "w3-job", "Scorecard's one job, in one sentence", "Example: 'Every Friday, count my week against my targets and tell me where I'm short.'"]),
      box("Scorecard setup",
        "Your name is Scorecard. Your one job is: {{scorecard-setup:w3-job}}\n\n" +
        "Count only from my connected calendar, my sent email and my deal list or CRM. For every number, say where it came from. If you can't count something, say so instead of estimating. Do not send messages or change business records.\n\n" +
        "My weekly targets: calls {{weekly-targets:w3-calls}}, meetings {{weekly-targets:w3-meetings}}, proposals out {{weekly-targets:w3-proposals}}, follow-ups sent {{weekly-targets:w3-followups}}.\n\n" +
        "MY CONTEXT\n{{context-interview:context-doc}}\n\n" +
        "Reply that you're ready to count my week, then wait."),
    ]),
    S("first-count", "Run your first count", [
      steps(
        ["Copy the \"Count my week\" box,", "paste it into Scorecard, change the date and time zone, and press Enter."],
        ["Check one number", "against your records."],
        ["Copy the \"Every Friday\" box,", "paste it into Scorecard, change the time and time zone, and press Enter."]),
      box("Count my week", "Count my week so far, from Monday through today, [date], [time zone]. Show each number next to its target and where it came from."),
      box("Every Friday", "Every Friday at [3:00 PM], [time zone], count my week the same way and send it to me here."),
      see("Each count next to its target, with its source. After the second box, a routine for your scorecard appears under Routines in the right panel."),
    ]),
    S("hw-friday-scorecard", "Homework: Friday's scorecard", [
      steps(
        ["On Friday, open the scorecard Scorecard sent you.", "If it didn't arrive, ask for it with the \"Count my week\" box in Run your first count."],
        ["Pick one count", "and check it against your sent folder or calendar."]),
      form({ name: "Friday's scorecard", send: true },
        ["SCORECARD", "scorecard", "Paste your scorecard", "Blurring the numbers is fine. Leave out client names."]),
      poll("Was the count right?", [
        ["count-accuracy", "How close was the count you checked?", ["Right", "Off by a little", "Off by a lot"], { comment: "Which count did you check?" }],
      ]),
    ]),
    S("hw-invite-owner", "Homework: invite your owner", [
      steps(
        ["Copy the invitation", "below."],
        ["Fill in the brackets", "and send it to your owner or sales leader."],
        ["Write their name and title", "in the box below."]),
      box("Invitation",
        "Hi [name],\n\n" +
        "Next [day and date] at [time] is the last session of the sales agent workshop. I'll show the crew of AI assistants I built: a morning brief, follow-up drafts and a weekly scorecard. It's 60 minutes, and the link is [link]. Can you join?\n\n" +
        "[Your name]"),
      form({ name: "Week 4 invites", send: true },
        ["OWNER", "owner", "Who you invited", "Name and title."]),
    ]),
    S("before-week-4", "Before Week 4", [
      steps(
        ["Check all three Bots this week,", "so your demo shows real results: this week's briefs, a follow-up draft, and Friday's scorecard."]),
    ]),
  ]],
  ["Week 4 — Chief of Staff", [
    S("your-crew", "Your crew", [
      text("From here on, Chief of Staff is the one Bot you talk to. It reads your crew list in the box below and sends each request to the right Bot."),
      steps(
        ["Click + (New Bot)", "in Grok Bot."],
        ["Type Chief of Staff.", "Pick a shape and color, and click Create."],
        ["Click Copy", "on the box below, paste it into Chief of Staff, and press Enter."]),
      box("Chief of Staff setup",
        "Your name is Chief of Staff. Your one job is: take my requests and send each one to the right Bot.\n\n" +
        "MY CREW\n" +
        "- Morning Brief: {{morning-brief-job:w1-job}}\n" +
        "- Follow-Up: {{followup-setup:w2-job}}\n" +
        "- Scorecard: {{scorecard-setup:w3-job}}\n\n" +
        "When I ask for something, tell me which Bot it belongs to and hand it to that Bot. If you can't hand it off, give me the exact request to paste into that Bot. Do not send messages or change business records. Reply that you're ready, then wait."),
      see("Chief of Staff says it's ready."),
      confirm("[TO CONFIRM: depends on testing whether one Bot reliably hands work to another on a participant account. Handoffs appear in the receiving Bot's own chat, not in a group chat (confirmed in docs, Nov 9).]"),
    ]),
    S("try-it", "Try it", [
      box("Tomorrow", "Get me ready for tomorrow."),
      box("A follow-up", "Draft a follow-up from these notes: [paste notes]"),
      box("My week", "How's my week looking against my targets?"),
      see("Each request goes to the right Bot, or Chief of Staff tells you which Bot to ask and what to paste."),
    ]),
    S("rules-of-road", "Rules of the road", [
      callout("rule", "Every Bot on one account shares the same files and logins. Connect only what you need. A person reviews before anything is sent. Keep personal and work on separate accounts. Know your company's AI policy, or ask your owner to write one."),
      text("Your Ask first rule from Week 1 still applies. Loosen it only for a job a Bot has done right many times."),
    ]),
    S("your-demo", "Your demo", [
      confirm("[TO CONFIRM: everyone prepares a demo and two are shared (current draft), or three or four volunteers at 4 minutes each (Scott's outline)]"),
      text("**Show these three, in 4 minutes**"),
      check(
        ["Today's brief,", "and one thing you corrected."],
        ["A follow-up draft", "next to the version you sent."],
        ["This week's scorecard.", ""]),
    ]),
    S("whats-next", "What's next", [
      form({ name: "What's next", send: true },
        ["RUN MYSELF", "run-myself", "What you'll keep running yourself"],
        ["TEAM SYSTEMS", "team-systems", "What would need your team's systems (CRM, shared inbox, proposals)"],
        ["BUILD", "build", "What would need a build (dashboards, tracking, integrations)"]),
    ]),
    S("closing-survey", "Closing survey", [
      text("How confident are you now? 1 = not at all, 5 = very."),
      poll("Closing survey", [
        ...CONFIDENCE,
        ["bots-running", "Which Bots are running on your account now?", ["Morning Brief", "Follow-Up", "Scorecard", "Chief of Staff"], { multiple: true }],
        ["pace", "The pace was:", ["Too slow", "About right", "Too fast"]],
        ["recommend", "How likely are you to recommend this workshop to another salesperson? (0–10)", ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"], { comment: "What would you change?" }],
      ], { once: true }),
    ]),
  ]],
  ["After the Workshop", [
    S("keep-running", "Keep it running", [
      text("**Once a week**"),
      check(
        ["The brief:", "check it against your calendar once."],
        ["Follow-up drafts:", "if they drift from your voice, add a rule in Your voice rules (Week 2) and paste the Follow-Up setup again."],
        ["The scorecard:", "check that its counts match your records."]),
      callout("rule", "Corrections go in Your context (Week 1) or Your voice rules (Week 2). Then copy the updated setup and paste it into that Bot."),
    ]),
    S("day-30", "Day 30 check-in", [
      poll("Day 30 check-in", [
        ["still-using", "What are you still using?", ["Morning Brief", "Follow-Up", "Scorecard", "Chief of Staff", "None"], { multiple: true }],
        ["team-version", "Would you want a version for your whole team?", ["Yes", "Maybe", "No"], { comment: "What saved you the most time?" }],
      ], { once: true }),
    ]),
    S("recordings", "Recordings", [
      text("Each session's recording is linked here after the session."),
    ]),
    S("troubleshooting", "Troubleshooting", [
      confirm("[TO CONFIRM: add the troubleshooting sheet here as a Download button once it's written]"),
    ]),
  ]],
];

// ----- validation of the plan -------------------------------------------------
const ALL = GROUPS.flatMap(([, secs]) => secs);
if (ALL.length !== 37) throw new Error(`Expected 37 sections in the plan, got ${ALL.length}`);
const keys = new Set();
for (const s of ALL) {
  if (keys.has(s.key)) throw new Error(`Duplicate section key ${s.key}`);
  keys.add(s.key);
}
const LINK_RE = /\{\{\s*([^:{}\s]+)\s*:\s*([^{}]*?)\s*\}\}/g;
// Every {{key:field}} must point at a planned section that has that field.
const fieldsByKey = new Map(ALL.map((s) => [s.key, new Set(s.blocks.flatMap((b) => (b.type === "form" ? b.fields.map((f) => f.fieldKey) : [])))]));
for (const s of ALL) {
  for (const b of s.blocks) {
    if (b.type !== "prompt") continue;
    for (const m of b.content.matchAll(LINK_RE)) {
      if (!fieldsByKey.has(m[1])) throw new Error(`${s.key}: link to unknown section key ${m[1]}`);
      if (!fieldsByKey.get(m[1]).has(m[2])) throw new Error(`${s.key}: link to unknown field ${m[1]}:${m[2]}`);
    }
  }
}

const sectionTypeOf = (blocks) => (blocks.some((b) => b.type === "form" || b.type === "poll" || b.type === "prompt") ? "exercise" : "reference");

// ----- run -----------------------------------------------------------------------
const CODE = "AGENT";
if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD is not set");
console.log("target", B);
await api("POST", "/admin/login", { password: process.env.ADMIN_PASSWORD });

// Topic "AI Agents"
let topic = (await api("GET", "/admin/topics")).topics.find((t) => t.name === "AI Agents");
if (!topic) {
  topic = (await api("POST", "/admin/topics", { name: "AI Agents" })).topic;
  console.log("topic created", topic.id);
} else console.log("topic exists", topic.id);

// Cohort
let cohort = (await api("GET", "/admin/cohorts")).cohorts.find((c) => c.cohortCode.toUpperCase() === CODE);
if (cohort) console.log("cohort exists", cohort.id);
else {
  cohort = (await api("POST", "/admin/cohorts", { name: "Agent Workshop", cohortCode: CODE, audienceType: "general", startWith: "empty" })).cohort;
  console.log("cohort created", cohort.id);
}

// Groups, in order, all locked
const existingGroups = (await api("GET", `/admin/cohorts/${cohort.id}/groups`)).groups ?? [];
const groupIdByName = new Map(existingGroups.map((g) => [g.name, g.id]));
let groupsCreated = 0;
for (const [name] of GROUPS) {
  if (groupIdByName.has(name)) continue;
  const res = await api("POST", `/admin/cohorts/${cohort.id}/groups`, { name });
  const g = res.group ?? res;
  groupIdByName.set(name, g.id);
  groupsCreated++;
}
// Make sure the order matches the plan (reorder endpoint if present; otherwise rely on creation order).
try {
  await api("PUT", `/admin/cohorts/${cohort.id}/groups/reorder`, { groupIds: GROUPS.map(([name]) => groupIdByName.get(name)) });
} catch (e) {
  console.log("group reorder skipped:", String(e.message).slice(0, 80));
}

// Sections: find or create (never rewrite existing content).
const attachedBefore = (await api("GET", `/admin/cohorts/${cohort.id}/sections`)).sections;
const attachedIds = new Set(attachedBefore.map((s) => s.sectionId));
const allGeneric = (await api("GET", "/admin/generic-sections")).sections;
function findExisting(title) {
  const matches = allGeneric.filter((g) => g.title === title && !g.slug && !g.archived);
  if (matches.length === 0) return null;
  const attached = matches.find((g) => attachedIds.has(`generic_${g.id}`));
  if (attached) return attached;
  if (matches.length > 1) throw new Error(`Ambiguous library title: ${title} (${matches.map((m) => m.id).join(", ")})`);
  return matches[0];
}
const idByKey = new Map();
const sectionByKey = new Map();
let created = 0;
for (const s of ALL) {
  let g = findExisting(s.title);
  if (!g) {
    g = (await api("POST", "/admin/generic-sections", {
      title: s.title,
      contentBlocks: s.blocks,
      goalText: null,
      badgeLabel: null,
      showNotesField: true,
      sectionType: sectionTypeOf(s.blocks),
      topicId: topic.id,
    })).section;
    created++;
    console.log("created", g.id, s.title);
  }
  idByKey.set(s.key, `generic_${g.id}`);
  sectionByKey.set(s.key, g);
}

// Second pass: resolve {{key:field}} -> {{generic_N:field}} in copy boxes.
let linksResolved = 0;
for (const s of ALL) {
  const g = sectionByKey.get(s.key);
  const blocks = g.contentBlocks ?? [];
  let changed = false;
  const rewritten = blocks.map((b) => {
    if (b.type !== "prompt" || typeof b.content !== "string") return b;
    const content = b.content.replace(LINK_RE, (all, k, f) => {
      const id = idByKey.get(k);
      if (!id) return all;
      changed = true;
      return `{{${id}:${f}}}`;
    });
    return content === b.content ? b : { ...b, content };
  });
  if (changed) {
    await api("PUT", `/admin/generic-sections/${g.id}`, { contentBlocks: rewritten });
    linksResolved++;
  }
}

// Attach in order: visible, codeActive true, code null.
const rows = [];
let order = 0;
for (const [name, secs] of GROUPS) {
  const groupId = groupIdByName.get(name);
  for (const s of secs) {
    rows.push({ sectionId: idByKey.get(s.key), groupId, sortOrder: order++, displayName: null, visible: true, code: null, codeActive: true });
  }
}
const planned = new Set(rows.map((r) => r.sectionId));
for (const a of attachedBefore) {
  if (planned.has(a.sectionId)) continue;
  rows.push({ sectionId: a.sectionId, groupId: a.groupId, sortOrder: order++, displayName: a.displayName ?? null, visible: a.visible, code: a.code ?? null, codeActive: a.codeActive ?? true });
}
await api("PUT", `/admin/cohorts/${cohort.id}/sections`, rows);

// Report
const after = await api("GET", `/admin/cohorts/${cohort.id}/sections`);
const groupName = new Map((after.groups ?? []).map((g) => [g.id, g.name]));
console.log("groups created:", groupsCreated, "| sections created:", created, "| sections with links resolved:", linksResolved);
console.log("attached:", after.sections.length);
for (const [name] of GROUPS) {
  const list = after.sections.filter((s) => groupName.get(s.groupId) === name).sort((a, b) => a.sortOrder - b.sortOrder);
  console.log(`  ${name} (${list.length}): ${list.map((s) => s.title).join(" | ")}`);
}
const unresolved = [];
for (const s of ALL) {
  const g = (await api("GET", `/admin/generic-sections`)).sections.find((x) => `generic_${x.id}` === idByKey.get(s.key));
  for (const b of g.contentBlocks ?? []) if (b.type === "prompt") for (const m of b.content.matchAll(LINK_RE)) if (!m[1].startsWith("generic_")) unresolved.push(`${s.key}: ${m[0]}`);
}
if (unresolved.length) throw new Error(`Unresolved links: ${unresolved.join(", ")}`);
console.log("all copy-box links resolve to generic_N ids");
