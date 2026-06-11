export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      response.status === 504 || response.status === 502
        ? "Passport server timed out while verifying your proof. Try again in a moment."
        : `Empty server response (${response.status}). Try again or check Vercel logs.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Invalid server response (${response.status}). Try again or contact support.`,
    );
  }
}
