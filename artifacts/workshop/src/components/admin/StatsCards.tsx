import { Card, CardContent } from "@/components/ui/card";
import { Users, BookOpen, MessageSquare, Lock } from "lucide-react";

interface Props {
  participantCount: number;
  sectionCount: number;
  feedbackCount: number;
  unlocksTotal: number;
}

export function StatsCards({ participantCount, sectionCount, feedbackCount, unlocksTotal }: Props) {
  const items = [
    { label: "Participants", value: participantCount, icon: Users, testId: "stat-participants" },
    { label: "Sections", value: sectionCount, icon: BookOpen, testId: "stat-sections" },
    { label: "Section unlocks", value: unlocksTotal, icon: Lock, testId: "stat-unlocks" },
    { label: "Feedback entries", value: feedbackCount, icon: MessageSquare, testId: "stat-feedback" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.label} className="bg-slate-900 border-slate-800 text-white" data-testid={it.testId}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/60">{it.label}</div>
                <div className="text-2xl font-bold mt-1">{it.value}</div>
              </div>
              <Icon className="w-7 h-7 text-white/40" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
