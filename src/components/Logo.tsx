export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1e2a44" />
      <path d="M6 20c4-6 7 2 11-3s5-6 9-5" stroke="#eef1f6" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M6 25c4-4 8 1 12-2.5S23 18 26 18.5" stroke="#8fb8e0" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="23" cy="9" r="2.4" fill="#e5484d" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-semibold tracking-tight text-lg">StreamReach</span>
    </span>
  );
}
