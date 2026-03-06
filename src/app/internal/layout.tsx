import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import InternalNav from "@/components/internal/InternalNav";

export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/internal/login");

  return (
    <div className="min-h-screen bg-bg">
      <InternalNav />
      <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
