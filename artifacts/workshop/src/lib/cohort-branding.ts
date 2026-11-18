import type { CohortSettings } from "@workspace/api-client-react";

export function talkCards(settings: CohortSettings | undefined, appUrl?: string) {
  const first = settings?.talkCards?.[0];
  const second = settings?.talkCards?.[1];
  return [...(first?.title?.trim() ? [{
    label: first?.label?.trim() || "",
    title: first.title.trim(),
    description: first?.description?.trim() || "",
    link: first?.link?.trim() || appUrl || "https://talkwithanthony.com",
  }] : []), ...(second?.title?.trim() && second?.link?.trim() ? [{
    label: second.label || "", title: second.title,
    description: second.description || "", link: second.link,
  }] : [])];
}
