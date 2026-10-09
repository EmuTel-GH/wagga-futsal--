"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMyTeams } from "@/components/public/MyTeamsWidget";

// /my-teams with no ?teams= → load the teams saved in this browser
// (loadNow). Either way, follow saves/unsaves made while on the page.
export default function LoadSavedTeams({ loadNow }: { loadNow: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const go = () => {
      const ids = getMyTeams().map((t) => t.id);
      if (ids.length) router.replace(`/my-teams?teams=${ids.join(",")}`);
    };
    if (loadNow) go();
    window.addEventListener("myteams-changed", go);
    return () => window.removeEventListener("myteams-changed", go);
  }, [router, loadNow]);
  return null;
}
