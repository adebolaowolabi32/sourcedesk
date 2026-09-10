export const isPortfolio = import.meta.env.MODE === "portfolio";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  if (isPortfolio) {
    const { demoApi } = await import("./demo");
    return demoApi(path, body) as T;
  }
  const response = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "SourceDesk",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Request failed. Please try again.");
  return data;
}
export const percent = (n: number) => Math.round(n * 100) + "%";
export const date = (n: number) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(n);
