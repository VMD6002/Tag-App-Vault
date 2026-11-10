/** Unix seconds as the cards show them, e.g. "5 Mar 2026, 2:07 pm". */
export const formatDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
