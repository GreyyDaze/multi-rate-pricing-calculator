import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthLayout } from "@/components/auth-layout";
import { currentUserEmail } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const email = await currentUserEmail();
  if (email) redirect("/");
  return (
    <AuthLayout>
      <AuthForm mode="login" />
    </AuthLayout>
  );
}