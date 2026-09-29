import { redirect } from "next/navigation";
import { Rail } from "@/components/shell/Rail";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return (
    <div className="min-h-screen bg-paper">
      <Rail />
      <div className="md:pl-[88px] pb-20 md:pb-0">{children}</div>
    </div>
  );
}
