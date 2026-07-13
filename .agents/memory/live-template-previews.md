---
name: Live template-preview updates (workshop)
description: How generic prompt/preview blocks update per-keystroke, and the fieldKey-overlay tradeoff
---

Generic sections resolve `{{sectionId:fieldKey}}` placeholders via `useResolveTemplate`
(used by PromptBlock and FieldBlock prefill in SectionRenderer). Saved values come
from the notes query; that only refreshes after the debounced autosave + invalidate,
so previews used to lag a full keystroke-stop cycle.

Fix: a per-section `LiveValuesProvider` (use-live-values.tsx) wraps GenericSectionView.
NotesField reports its current text via `reportValue` on every change; `useResolveTemplate`
overlays these live values on top of saved notes. Build Your PRD's FormBlock already had
its own local live assembly, so it was never affected — this brings template-based blocks
to parity.

**Decision:** the live overlay is keyed by fieldKey ONLY (not sectionId).
**Why:** the section payload carries no slug (section.id = generic_N; templates reference
by slug), and only one section renders at a time, so fieldKey is unambiguous for all real
seeded content.
**How to apply / caveat:** if you ever add a template that references
`{{otherSection:fieldKey}}` while the ACTIVE section has a field with that same fieldKey,
the live typed value would wrongly override the other section's saved value. If cross-section
templates like that become common, switch the overlay to match on sectionId+fieldKey
(which requires plumbing the section slug into the generic section payload).
