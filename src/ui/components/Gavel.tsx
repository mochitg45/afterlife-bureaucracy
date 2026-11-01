/** Cartoon gavel used by the Ledger audit call-to-action and the audit ceremony. */
export function Gavel({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <g transform="rotate(-35 32 32)">
        <rect x="29" y="24" width="6" height="34" rx="3" fill="#B07A3E" stroke="#3A2616" strokeWidth="2.5" />
        <rect x="12" y="8" width="40" height="18" rx="5" fill="#8A5A2B" stroke="#3A2616" strokeWidth="2.5" />
        <rect x="19" y="8" width="5" height="18" fill="#E8C164" />
        <rect x="40" y="8" width="5" height="18" fill="#E8C164" />
      </g>
    </svg>
  );
}
