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
];
