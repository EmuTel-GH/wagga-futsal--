import { runtimeInfo } from "@/lib/runtimeInfo";

// "Version abc1234": what's live, so anyone can check after a merge.
export default async function VersionTag({ className = "" }: { className?: string }) {
  const { version, env } = await runtimeInfo();
  return (
    <span className={className} title="The git commit this site is running">
      Version {version}
      {env === "staging" ? " (staging)" : ""}
    </span>
  );
}
