import { open } from "@tauri-apps/plugin-shell";

function isAllowedExternalUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.startsWith("https://");
}

export async function openExternalUrl(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!isAllowedExternalUrl(trimmed)) {
    throw new Error("Invalid URL: only https:// links are allowed.");
  }
  await open(trimmed);
}

