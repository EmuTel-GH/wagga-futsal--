import { requireAdmin } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/users";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await requireAdmin();
  const { user } = session;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-black text-navy mb-6">My account</h1>
      <div className="bg-white border border-border rounded-xl p-5 mb-6 text-sm space-y-1">
        <p><span className="text-muted">Name:</span> <span className="font-semibold text-navy">{user.name}</span></p>
        <p><span className="text-muted">Sign-in:</span> {user.email}</p>
        <p>
          <span className="text-muted">Permissions:</span>{" "}
          {user.permissions.length
            ? user.permissions.map((p) => PERMISSIONS.find((x) => x.key === p)?.label ?? p).join(", ")
            : "Standard administrator"}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
