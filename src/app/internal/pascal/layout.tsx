export default function PascalLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 top-[65px] bg-bg">{children}</div>;
}
