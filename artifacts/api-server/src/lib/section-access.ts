import { and, eq } from "drizzle-orm";
import {
  db,
  cohortsTable,
  cohortSectionsTable,
  unlockedSectionsTable,
} from "@workspace/db";

// The single unlock rule, shared by the sections route (bulk) and the
// participant file routes (per section). A section is unlocked when:
//  - the participant's tier already grants this level, OR
//  - the section doesn't require a code (codeActive=false), OR
//  - the participant has explicitly unlocked it via a code.
export function isSectionUnlocked(opts: {
  tierAccess: Record<string, boolean> | null | undefined;
  level: number;
  codeActive: boolean;
  explicitlyUnlocked: boolean;
}): boolean {
  const tierUnlocked = Boolean((opts.tierAccess ?? {})[String(opts.level)]);
  return tierUnlocked || !opts.codeActive || opts.explicitlyUnlocked;
}

// Per-section check for a participant: the section must be assigned to the
// participant's cohort AND visible AND unlocked per the rule above.
export async function isSectionUnlockedForParticipant(
  participantId: number,
  cohortId: number,
  sectionId: string,
): Promise<boolean> {
  const [cs] = await db
    .select({
      level: cohortSectionsTable.level,
      codeActive: cohortSectionsTable.codeActive,
    })
    .from(cohortSectionsTable)
    .where(
      and(
        eq(cohortSectionsTable.cohortId, cohortId),
        eq(cohortSectionsTable.sectionId, sectionId),
        eq(cohortSectionsTable.visible, true),
      ),
    )
    .limit(1);
  if (!cs) return false;

  const [cohort] = await db
    .select({ tierAccess: cohortsTable.tierAccess })
    .from(cohortsTable)
    .where(eq(cohortsTable.id, cohortId))
    .limit(1);
  if (!cohort) return false;

  const [unlockRow] = await db
    .select({ id: unlockedSectionsTable.id })
    .from(unlockedSectionsTable)
    .where(
      and(
        eq(unlockedSectionsTable.participantId, participantId),
        eq(unlockedSectionsTable.sectionId, sectionId),
      ),
    )
    .limit(1);

  return isSectionUnlocked({
    tierAccess: cohort.tierAccess as Record<string, boolean> | null,
    level: cs.level,
    codeActive: cs.codeActive,
    explicitlyUnlocked: Boolean(unlockRow),
  });
}
