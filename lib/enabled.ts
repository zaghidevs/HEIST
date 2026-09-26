import "server-only";
import { platformEnabled } from "./players";
import type { Platform } from "./players-parse";

export function enabledPlatforms(): Record<Platform, boolean> {
  return { sc: platformEnabled("sc"), twitch: platformEnabled("twitch"), kick: platformEnabled("kick") };
}
