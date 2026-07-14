export function PencilIcon({ className = "w-5 h-5" }: { className?: string }) {
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
      <path d="M16.862 4.487a2.06 2.06 0 0 1 2.914 2.914L7.5 19.674l-4 1 1-4L16.862 4.487Z" />
    </svg>
  );
}
