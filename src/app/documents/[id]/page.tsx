import { redirect } from "next/navigation";
import { DocumentEditor } from "@/components/document-editor";
import { currentUserEmail } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function DocumentRoute({ params }: PageProps<"/documents/[id]">) {
  const email = await currentUserEmail();
  if (!email) redirect("/login");
  const { id } = await params;
  return <DocumentEditor id={id} email={email} />;
}