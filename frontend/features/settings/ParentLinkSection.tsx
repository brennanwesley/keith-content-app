"use client";

import type { StoredAuthSession } from "@/lib/authSession";
import { ParentLinkLearnerPanel } from "./ParentLinkLearnerPanel";
import { ParentLinkParentPanel } from "./ParentLinkParentPanel";

type ParentLinkSectionProps = {
  authSession: StoredAuthSession;
};

export function ParentLinkSection({ authSession }: ParentLinkSectionProps) {
  if (authSession.user.accountType === "parent") {
    return <ParentLinkParentPanel authSession={authSession} />;
  }

  return <ParentLinkLearnerPanel authSession={authSession} />;
}
