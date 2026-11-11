import { and, eq } from "drizzle-orm";
import {
  db,
  cohortsTable,
  cohortSectionsTable,
  unlockedSectionsTable,
} from "@workspace/db";
import { getCohortGroups, groupIdForRow } from "./cohort-groups";

// The single unlock rule, shared by the sections route (bulk) and the
// participant file/notes/responses routes (per section). A section is
// unlocked when:
//  - its group is open, OR
//  - the section doesn't require a code (codeActive=false), OR
//  - the participant has explicitly unlocked it via a code.
export function isSectionUnlocked(opts: {
  groupOpen: boolean;
  codeActive: boolean;
  explicitlyUnlocked: boolean;
}): boolean {
  return opts.groupOpen || !opts.codeActive || opts.explicitlyUnlocked;
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
      groupId: cohortSectionsTable.groupId,
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
    .select()
    .from(cohortsTable)
    .where(eq(cohortsTable.id, cohortId))
    .limit(1);
  if (!cohort) return false;

  const groups = await getCohortGroups(cohort);
  const gid = groupIdForRow(cohort, cs);
  const group = groups.find((g) => g.id === gid);

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
    groupOpen: Boolean(group?.isOpen),
    codeActive: cs.codeActive,
    explicitlyUnlocked: Boolean(unlockRow),
  });
}
