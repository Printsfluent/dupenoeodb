export const TABLE_EMOJIS = [
  '📊', '📋', '📁', '📂', '🗂️', '📌', '📎', '📝',
  '📸', '📷', '🎬', '🎥', '🎙️', '🎧', '🎵', '🎮',
  '💼', '💰', '💳', '🛒', '🛍️', '📦', '🚚', '🏪',
  '👥', '👤', '💬', '💌', '📧', '📞', '📱', '💻',
  '🌐', '🔗', '⭐', '🔥', '💎', '🎯', '🚀', '⚡',
  '🎨', '🖌️', '✏️', '📚', '📖', '🏆', '🎉', '✅',
  '❤️', '💙', '💚', '💜', '🧡', '💛', '🤍', '🖤',
  '🐱', '🐶', '🦊', '🐼', '🦁', '🦄', '🌸', '🌈', '📅',
] as const

export interface SocialLogo {
  id: string
  label: string
  /** Brand hex without # for Simple Icons CDN */
  color: string
  keywords: string[]
}

export const SOCIAL_LOGOS: SocialLogo[] = [
  { id: 'instagram', label: 'Instagram', color: 'E4405F', keywords: ['instagram', 'insta', 'ig'] },
  { id: 'facebook', label: 'Facebook', color: '0866FF', keywords: ['facebook', 'fb', 'meta'] },
  { id: 'x', label: 'X (Twitter)', color: '000000', keywords: ['twitter', 'x', 'tweet'] },
  { id: 'tiktok', label: 'TikTok', color: '000000', keywords: ['tiktok', 'tt'] },
  { id: 'youtube', label: 'YouTube', color: 'FF0000', keywords: ['youtube', 'yt'] },
  { id: 'linkedin', label: 'LinkedIn', color: '0A66C2', keywords: ['linkedin'] },
  { id: 'snapchat', label: 'Snapchat', color: 'FFFC00', keywords: ['snapchat', 'snap'] },
  { id: 'pinterest', label: 'Pinterest', color: 'BD081C', keywords: ['pinterest'] },
  { id: 'reddit', label: 'Reddit', color: 'FF4500', keywords: ['reddit'] },
  { id: 'discord', label: 'Discord', color: '5865F2', keywords: ['discord'] },
  { id: 'telegram', label: 'Telegram', color: '26A5E4', keywords: ['telegram'] },
  { id: 'whatsapp', label: 'WhatsApp', color: '25D366', keywords: ['whatsapp', 'wa'] },
  { id: 'threads', label: 'Threads', color: '000000', keywords: ['threads'] },
  { id: 'mastodon', label: 'Mastodon', color: '6364FF', keywords: ['mastodon'] },
  { id: 'twitch', label: 'Twitch', color: '9146FF', keywords: ['twitch'] },
  { id: 'spotify', label: 'Spotify', color: '1DB954', keywords: ['spotify'] },
  { id: 'github', label: 'GitHub', color: '181717', keywords: ['github', 'gh'] },
  { id: 'gitlab', label: 'GitLab', color: 'FC6D26', keywords: ['gitlab'] },
  { id: 'google', label: 'Google', color: '4285F4', keywords: ['google'] },
  { id: 'apple', label: 'Apple', color: '000000', keywords: ['apple'] },
  { id: 'microsoft', label: 'Microsoft', color: '5E5E5E', keywords: ['microsoft', 'ms'] },
  { id: 'slack', label: 'Slack', color: '4A154B', keywords: ['slack'] },
  { id: 'notion', label: 'Notion', color: '000000', keywords: ['notion'] },
  { id: 'figma', label: 'Figma', color: 'F24E1E', keywords: ['figma'] },
  { id: 'dribbble', label: 'Dribbble', color: 'EA4C89', keywords: ['dribbble'] },
  { id: 'behance', label: 'Behance', color: '1769FF', keywords: ['behance'] },
  { id: 'medium', label: 'Medium', color: '000000', keywords: ['medium'] },
  { id: 'tumblr', label: 'Tumblr', color: '36465D', keywords: ['tumblr'] },
  { id: 'vimeo', label: 'Vimeo', color: '1AB7EA', keywords: ['vimeo'] },
  { id: 'soundcloud', label: 'SoundCloud', color: 'FF5500', keywords: ['soundcloud'] },
  { id: 'patreon', label: 'Patreon', color: '000000', keywords: ['patreon'] },
  { id: 'substack', label: 'Substack', color: 'FF6719', keywords: ['substack'] },
  { id: 'bluesky', label: 'Bluesky', color: '1185FE', keywords: ['bluesky'] },
  { id: 'line', label: 'LINE', color: '00C300', keywords: ['line'] },
  { id: 'wechat', label: 'WeChat', color: '07C160', keywords: ['wechat', 'weixin'] },
  { id: 'signal', label: 'Signal', color: '3A76F0', keywords: ['signal'] },
  { id: 'messenger', label: 'Messenger', color: '0866FF', keywords: ['messenger'] },
  { id: 'shopify', label: 'Shopify', color: '7AB55C', keywords: ['shopify'] },
  { id: 'stripe', label: 'Stripe', color: '635BFF', keywords: ['stripe'] },
  { id: 'paypal', label: 'PayPal', color: '003087', keywords: ['paypal'] },
  { id: 'amazon', label: 'Amazon', color: 'FF9900', keywords: ['amazon'] },
  { id: 'airbnb', label: 'Airbnb', color: 'FF5A5F', keywords: ['airbnb'] },
  { id: 'uber', label: 'Uber', color: '000000', keywords: ['uber'] },
]

const SOCIAL_PREFIX = 'social:'

export type ParsedTableIcon =
  | { type: 'none' }
  | { type: 'emoji'; value: string }
  | { type: 'social'; id: string }

export function formatSocialTableIcon(id: string): string {
  return `${SOCIAL_PREFIX}${id}`
}

export function parseTableIcon(icon?: string | null): ParsedTableIcon {
  if (!icon?.trim()) return { type: 'none' }
  const value = icon.trim()
  if (value.startsWith(SOCIAL_PREFIX)) {
    const id = value.slice(SOCIAL_PREFIX.length)
    if (SOCIAL_LOGOS.some((logo) => logo.id === id)) {
      return { type: 'social', id }
    }
    return { type: 'none' }
  }
  if (/\p{Extended_Pictographic}/u.test(value)) {
    return { type: 'emoji', value: [...value][0] ?? value }
  }
  return { type: 'none' }
}

export function getSocialLogo(slug: string): SocialLogo | undefined {
  return SOCIAL_LOGOS.find((logo) => logo.id === slug)
}

export function getSocialLogoUrl(slug: string, color?: string): string {
  const logo = getSocialLogo(slug)
  const hex = (color ?? logo?.color ?? '888888').replace('#', '')
  return `https://cdn.simpleicons.org/${slug}/${hex}`
}

export function suggestTableIconFromName(name: string): string | null {
  const normalized = name.toLowerCase().trim()
  if (!normalized) return null

  for (const logo of SOCIAL_LOGOS) {
    if (
      normalized === logo.id ||
      normalized === logo.label.toLowerCase() ||
      logo.keywords.some((keyword) => normalized.includes(keyword))
    ) {
      return formatSocialTableIcon(logo.id)
    }
  }

  const emojiHints: Array<{ match: RegExp; emoji: string }> = [
    { match: /photo|image|camera|gallery/, emoji: '📸' },
    { match: /video|film|movie/, emoji: '🎬' },
    { match: /music|audio|song|playlist/, emoji: '🎵' },
    { match: /shop|store|product|inventory/, emoji: '🛒' },
    { match: /customer|client|contact|people|team/, emoji: '👥' },
    { match: /email|mail|inbox/, emoji: '📧' },
    { match: /chat|message|comment/, emoji: '💬' },
    { match: /task|todo|project/, emoji: '✅' },
    { match: /finance|money|budget|invoice/, emoji: '💰' },
    { match: /calendar|event|schedule/, emoji: '📅' },
  ]

  for (const hint of emojiHints) {
    if (hint.match.test(normalized)) return hint.emoji
  }

  return null
}

export function normalizeTableIcon(icon?: string | null): string | undefined {
  const parsed = parseTableIcon(icon)
  if (parsed.type === 'none') return undefined
  if (parsed.type === 'emoji') return parsed.value
  return formatSocialTableIcon(parsed.id)
}
