export function xpToNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.35))
}
