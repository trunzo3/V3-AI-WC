import type { CohortSettings } from "@workspace/api-client-react";

export function talkCards(settings: CohortSettings | undefined, appUrl?: string) {
  const first = settings?.talkCards?.[0];
  const second = settings?.talkCards?.[1];
  return [{
    label: first?.label?.trim() || "One-on-One",
    title: first?.title?.trim() || "Talk with Anthony",
    description: first?.description?.trim() || "Book a conversation about how to apply this in your work.",
    link: first?.link?.trim() || appUrl || "https://talkwithanthony.com",
  }, ...(second?.title?.trim() && second?.link?.trim() ? [{
    label: second.label || "", title: second.title,
    description: second.description || "", link: second.link,
  }] : [])];
}
