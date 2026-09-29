import { ROLE_LABEL, getCurrentUser } from "@/lib/auth";
import { UserMenu } from "./UserMenu";

/** Top bar for app pages other than the full-bleed monitoring map. */
export async function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode }) {
  const user = (await getCurrentUser())!;
  return (
    <header className="flex flex-col-reverse sm:flex-row sm:items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display text-2xl sm:text-3xl mt-1">{title}</h1>
        {subtitle && <div className="text-ink-2 mt-2 max-w-3xl text-sm sm:text-[15px]">{subtitle}</div>}
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {actions}
        <UserMenu name={user.name} roleLabel={ROLE_LABEL[user.role]} email={user.email} />
      </div>
    </header>
  );
}
