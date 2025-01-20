export const getTimeDifference = (args: {
  diff_hours: number;
  diff_minutes: number;
  diff_seconds: number;
}): string => {
  const { diff_hours, diff_minutes, diff_seconds } = args;
  const now = Math.floor(Date.now() / 1000); // Time in seconds
  const futureTime = now + diff_hours * 3600 + diff_minutes * 60 + diff_seconds;
  return futureTime.toString();
};
