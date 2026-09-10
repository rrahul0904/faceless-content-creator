import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import StudioDashboard from "@/components/StudioDashboard";

export default async function DashboardPage() {
  const session = await currentSession();
  if (!session) redirect("/login");
  return <StudioDashboard userEmail={session.email} />;
}
