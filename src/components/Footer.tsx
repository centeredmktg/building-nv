export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-bg border-t border-border py-10 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg width="20" height="17" viewBox="0 0 26 22" fill="none" aria-hidden="true">
            <path d="M1 11 L13 2 L25 11" stroke="#F5F2ED" strokeWidth="2" strokeLinecap="square" fill="none"/>
            <line x1="6" y1="11" x2="6" y2="20" stroke="#F5F2ED" strokeWidth="1.5" strokeLinecap="square"/>
            <line x1="20" y1="11" x2="20" y2="20" stroke="#F5F2ED" strokeWidth="1.5" strokeLinecap="square"/>
            <line x1="1" y1="20" x2="25" y2="20" stroke="#C17F3A" strokeWidth="1.5" strokeLinecap="square"/>
          </svg>
          <div>
            <span className="text-text-primary font-extrabold text-sm tracking-wide">Building <span className="text-xs">NV</span></span>
            <p className="text-text-muted text-xs mt-0.5">
              General Contractor · Reno, Nevada
            </p>
          </div>
        </div>
        <p className="text-text-muted text-xs">
          &copy; {year} Building NV. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
