export const PROFILE_EMOJIS = [
  '😀', '😎', '🤓', '🥳', '😊', '🙂', '😇', '🤩',
  '🦊', '🐱', '🐶', '🐼', '🦁', '🐸', '🦄', '🐙',
  '🌟', '🔥', '💎', '🎯', '🚀', '⚡', '🎨', '🎵',
  '🌈', '🌸', '🍀', '🍕', '☕', '🎮', '💻', '📚',
] as const

export function isValidProfileEmoji(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return /\p{Extended_Pictographic}/u.test(trimmed)
}

export function normalizeProfileEmoji(value: string): string {
  return [...value.trim()][0] ?? ''
}
