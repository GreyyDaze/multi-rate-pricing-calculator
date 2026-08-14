import { redirect } from "next/navigation";
import { ReportsPage } from "@/components/reports-page";
import { currentUserEmail } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function ReportsRoute() {
  const email = await currentUserEmail();
  if (!email) redirect("/login");
  return <ReportsPage email={email} />;
}