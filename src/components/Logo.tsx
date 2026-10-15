export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#c8102e" />
        <path
          d="M7 18v-4M11 22V10M15 25V7M19 21v-10M23 18v-4"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span>
        Audio <span className="text-brand">Ibero</span>
      </span>
    </span>
  );
}
