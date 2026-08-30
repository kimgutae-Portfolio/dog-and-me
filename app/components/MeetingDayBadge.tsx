type Props = {
  metOn?: string | null;
  petName: string;
};

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  return { year, month, day, timestamp };
}

export function meetingDayCount(metOn: string, now = new Date()) {
  const parsed = parseDateOnly(metOn);
  if (!parsed) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsed = Math.floor((today - parsed.timestamp) / 86_400_000);
  return elapsed < 0 ? null : elapsed + 1;
}

export function MeetingDayBadge({ metOn, petName }: Props) {
  if (!metOn) return null;
  const parsed = parseDateOnly(metOn);
  const days = meetingDayCount(metOn);
  if (!parsed || days === null) return null;

  return (
    <aside
      className="moka-meeting-day"
      aria-label={`${petName}と出会って${days}日目`}
    >
      <span>一緒に過ごした時間</span>
      <strong suppressHydrationWarning>D+{days.toLocaleString("ja-JP")}</strong>
      <small>{parsed.year}.{String(parsed.month).padStart(2, "0")}.{String(parsed.day).padStart(2, "0")}</small>
    </aside>
  );
}
