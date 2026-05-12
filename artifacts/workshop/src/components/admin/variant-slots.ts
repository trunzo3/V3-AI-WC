export interface VariantSlot {
  blockKey: string;
  label: string;
  description: string;
  defaultContent: string;
  multiline?: boolean;
}

export interface VariantSection {
  sectionId: string;
  title: string;
  slots: VariantSlot[];
}

const VERIFY_PROMPT_DEFAULT = `For each statistic, verify against primary sources. Output: Claim | Correct? | Actual Figure | Source Link.

One table for each bullet. No other commentary.

– Child protective services identified 556,899 victims of child abuse and neglect in federal fiscal year 2022, matching a national rate of 7.7 victims per 1,000 children. Agencies received 4,276,000 total referrals involving about 7.53 million children.`;

const VERIFY_ANSWER_KEY_DEFAULT = `Stat 1 — CPS Victims Count
Error: 556,000 victims
Correct: 558,899 victims of child abuse and neglect in FFY 2022, at a national rate of 7.7 per 1,000 children. 4,276,000 referrals involving ~7.53 million children.

Stat 2 — Screening Rates
(fill in with current verified figures)`;

export const VARIANT_SECTIONS: VariantSection[] = [
  {
    sectionId: "verification-test",
    title: "Verification Test",
    slots: [
      {
        blockKey: "prompt",
        label: "Prompt to copy",
        description:
          "The prompt block participants paste into their LLM. Plain text; preserves line breaks.",
        defaultContent: VERIFY_PROMPT_DEFAULT,
        multiline: true,
      },
      {
        blockKey: "answer_key",
        label: "Answer key",
        description:
          "The answer key shown after the stop banner. Plain text; preserves line breaks.",
        defaultContent: VERIFY_ANSWER_KEY_DEFAULT,
        multiline: true,
      },
    ],
  },
  {
    sectionId: "six-ways-worksheet",
    title: "6 Ways Worksheet",
    slots: [
      {
        blockKey: "worksheet_instruction",
        label: "Worksheet instruction text",
        description:
          "The lead-in instruction shown above the six use-case rows.",
        defaultContent:
          "Think about your actual work. For each use case, write one task you do regularly or/and that you are working on now, that AI could help with.",
        multiline: true,
      },
    ],
  },
  {
    sectionId: "closing",
    title: "Closing",
    slots: [
      {
        blockKey: "closing_quote",
        label: "Closing quote",
        description:
          "The headline quote displayed in the closing banner. Line breaks are preserved.",
        defaultContent: `"Small things.\nUnlikely places.\nExtraordinary work."`,
        multiline: true,
      },
      {
        blockKey: "closing_subtext",
        label: "Closing subtext",
        description:
          "The italic line shown below the closing quote.",
        defaultContent: "You don't have to be first, but you have to be ready.",
      },
      {
        blockKey: "closing_survey_url",
        label: "Survey URL",
        description: "The URL the survey button links to.",
        defaultContent: "https://headandheartca.com/close",
      },
      {
        blockKey: "closing_survey_label",
        label: "Survey button label",
        description: "Text shown on the survey button.",
        defaultContent: "Complete Workshop Survey",
      },
    ],
  },
];
