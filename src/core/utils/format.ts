export function formatRelativeTime(isoString: string): string {
  const d = new Date(isoString);
  const t = d.getTime();
  if (Number.isNaN(t)) return isoString;

  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return "just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / 86_400_000);
  return `${days}d ago`;
}

