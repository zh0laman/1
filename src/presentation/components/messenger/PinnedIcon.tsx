import type { CSSProperties } from 'react'

interface PinnedIconProps {
  size?: number
  color?: string
  style?: CSSProperties
}

export default function PinnedIcon({
  size = 16,
  color = 'currentColor',
  style,
}: PinnedIconProps) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'inline-block',
        flexShrink: 0,
        ...style,
      }}
    >
      <g transform="rotate(-33 10 10)">
        <path
          d="M6.65 3.1C6.65 2.44 7.19 1.9 7.85 1.9H12.15C12.81 1.9 13.35 2.44 13.35 3.1V4.98C13.35 5.34 13.49 5.68 13.74 5.94L15.07 7.25C15.81 7.99 15.29 9.25 14.25 9.25H11.25V13.35C11.25 13.76 10.91 14.1 10.5 14.1H9.5C9.09 14.1 8.75 13.76 8.75 13.35V9.25H5.75C4.71 9.25 4.19 7.99 4.93 7.25L6.26 5.94C6.51 5.68 6.65 5.34 6.65 4.98V3.1Z"
          fill={color}
        />
        <path
          d="M10 14.2V17.6"
          stroke={color}
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
}
