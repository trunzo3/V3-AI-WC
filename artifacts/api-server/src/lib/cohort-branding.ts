import { z } from "zod/v4";

const link = z.string().trim().max(2000).refine(
  (value) => !value || /^https?:\/\//i.test(value) && URL.canParse(value),
  "Use an http or https link",
);
export const cohortSettingsSchema = z.object({
  logos: z.array(z.discriminatedUnion("type", [
    z.object({ type: z.literal("builtin") }),
    z.object({ type: z.literal("image"), fileId: z.number().int().positive(), name: z.string().max(255) }),
  ])).max(3).optional(),
  talkCards: z.array(z.object({
    label: z.string().max(200).optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    link: link.optional(),
  })).max(2).optional(),
  facilitatorMessageHeading: z.string().max(200).optional(),
}).catchall(z.unknown());
