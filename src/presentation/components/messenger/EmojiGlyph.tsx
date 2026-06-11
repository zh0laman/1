import { useState } from 'react'
import type { CSSProperties } from 'react'

const EMOJI_FONT_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'
const JOYPIXELS_ASSET_BASE_URL = 'https://cdn.jsdelivr.net/gh/joypixels/emoji-assets@10.0.0/png/64'

const emojiToCodepointPath = (emoji: string): string =>
  Array.from(emoji)
    .map((symbol) => symbol.codePointAt(0)?.toString(16))
    .filter((part): part is string => Boolean(part))
    .join('-')

interface EmojiGlyphProps {
  emoji: string
  size: number
  style?: CSSProperties
}

export default function EmojiGlyph({ emoji, size, style }: EmojiGlyphProps) {
  const [failedEmoji, setFailedEmoji] = useState<string | null>(null)
  const isFallback = failedEmoji === emoji

  if (isFallback) {
    return (
      <span
        style={{
          fontSize: size,
          lineHeight: 1,
          fontFamily: EMOJI_FONT_STACK,
          ...style,
        }}
      >
        {emoji}
      </span>
    )
  }

  return (
    <img
      src={`${JOYPIXELS_ASSET_BASE_URL}/${emojiToCodepointPath(emoji)}.png`}
      alt={emoji}
      draggable={false}
      loading="lazy"
      width={size}
      height={size}
      onError={() => setFailedEmoji(emoji)}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
