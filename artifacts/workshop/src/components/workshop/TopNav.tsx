import { useState } from "react";
import {
  useUnlockSection,
  useUpsertFeedback,
  useListFeedbackCategories,
  useGetAppSettings,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/logo";
import { MessageSquarePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListSectionsQueryKey } from "@workspace/api-client-react";

interface TopNavProps {
  onLogoClick?: () => void;
}

export function TopNav({ onLogoClick }: TopNavProps) {
  const [code, setCode] = useState("");
  const unlockMutation = useUnlockSection();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [category, setCategory] = useState<string>("");
  const feedbackMutation = useUpsertFeedback();
  const { data: catsResp } = useListFeedbackCategories();
  const categories = catsResp?.categories ?? [];

  const { data: settings } = useGetAppSettings();
  const talkUrl = (settings as Record<string, string> | undefined)?.["talk_with_anthony_url"] || "https://talkwithanthony.com";

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    unlockMutation.mutate(
      { data: { code: code.trim().toUpperCase() } as any },
      {
        onSuccess: (data: any) => {
          toast({
            title: "Section unlocked",
            description: data?.sectionTitle ? `You now have access to: ${data.sectionTitle}` : "New section is now available.",
          });
          setCode("");
          qc.invalidateQueries({ queryKey: getListSectionsQueryKey() });
          window.dispatchEvent(new Event("sections-updated"));
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Code not recognized",
            description: "Please check the code and try again.",
          });
        },
      },
    );
  };

  const submitFeedback = () => {
    if (!feedbackText.trim()) return;
    feedbackMutation.mutate(
      {
        data: {
          content: feedbackText,
          category: category || undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ title: "Submitted", description: "Thank you for your thoughts!" });
          setFeedbackOpen(false);
          setFeedbackText("");
          setCategory("");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Could not submit feedback.",
          });
        },
      },
    );
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className={onLogoClick ? "cursor-pointer" : ""} onClick={onLogoClick}>
          <Logo />
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <form onSubmit={handleUnlock} className="hidden md:flex items-center gap-2">
            <Input
              placeholder="Enter Code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-32 uppercase tracking-wider"
              data-testid="input-unlock-code"
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={unlockMutation.isPending}
              data-testid="button-unlock"
            >
              Unlock
            </Button>
          </form>

          <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-open-feedback" className="text-muted-foreground hover:text-primary">
                <MessageSquarePlus className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">Feedback</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>What should we teach next?</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Tell us what you're working on, what you're stuck on, or what you'd like to go deeper on.
                </p>

                {categories.length > 0 && (
                  <div>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger data-testid="select-feedback-category">
                        <SelectValue placeholder="Select a category (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.name}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Textarea
                  placeholder="Share your thoughts..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="min-h-[120px]"
                  data-testid="input-feedback"
                />
                <Button
                  onClick={submitFeedback}
                  disabled={feedbackMutation.isPending || !feedbackText.trim()}
                  data-testid="button-submit-feedback"
                >
                  {feedbackMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <a
            href={talkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:block text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            data-testid="topnav-talk-anthony"
          >
            Talk with Anthony
          </a>
        </div>
      </div>
    </header>
  );
}
