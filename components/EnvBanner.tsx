import { runtimeInfo } from "@/lib/runtimeInfo";

// Unmissable on the staging site so nobody mistakes it for the real one.
export default async function EnvBanner() {
  const { env, version } = await runtimeInfo();
  if (env !== "staging") return null;
  return (
    <div className="bg-amber-400 text-black text-center text-xs sm:text-sm font-black tracking-wide px-3 py-1.5 sticky top-0 z-50">
      STAGING · test site, not the real Wagga Futsal · changes here don&apos;t affect waggafutsal.com.au · v{version}
    </div>
  );
}
