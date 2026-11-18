/** Defaults are stored on creation, never substituted when rendering. */
export const DEFAULT_HOME_MESSAGE = "<p>This is your home base between sessions. Begin by getting your bearings, then enter the workshop when you're ready.</p>";
export const DEFAULT_COHORT_WORDING = {
  facilitatorMessageHeading: "From Your Facilitator",
  workbookBrand: "IQmeetEQ Workshop Companion",
  talkCards: [{
    label: "One-on-One",
    title: "Talk with Anthony",
    description: "Book a conversation about how to apply this in your work.",
    link: "",
  }, { label: "", title: "", description: "", link: "" }],
};

export function newCohortSettings(settings: Record<string, unknown> = {}) {
  const cards = Array.isArray(settings.talkCards) ? settings.talkCards : [];
  return {
    ...DEFAULT_COHORT_WORDING,
    ...settings,
    talkCards: DEFAULT_COHORT_WORDING.talkCards.map((card, index) => ({
      ...card,
      ...(cards[index] ?? {}),
    })),
  };
}
