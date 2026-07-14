export function KeyIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="15" r="4" />
      <path d="M10 12 19 3" />
      <path d="M15 7 17 9" />
      <path d="M18 4 20 6" />
    </svg>
  );
}
