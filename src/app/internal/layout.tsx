import InternalNav from "@/components/internal/InternalNav";

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <InternalNav />
      <main className="max-w-7xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
