export const getTimeDifference = async (args: {
  diffHours: number;
  diffMinutes: number;
  diffSeconds: number;
}): Promise<string> => {
  const { diffHours = 0, diffMinutes = 0, diffSeconds = 0 } = args;
  const now = Math.floor(Date.now() / 1000); // Time in seconds
  const futureTime = now + diffHours * 3600 + diffMinutes * 60 + diffSeconds;
  return futureTime.toString();
};
