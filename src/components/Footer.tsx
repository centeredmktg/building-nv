export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-bg border-t border-border py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-text-primary font-bold text-lg">Building NV</span>
          <p className="text-text-muted text-xs mt-1">
            Commercial Tenant Improvement · Reno, Nevada
          </p>
        </div>
        <p className="text-text-muted text-xs">
          &copy; {year} Building NV. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
