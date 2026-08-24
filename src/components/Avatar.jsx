import { UserRound } from 'lucide-react'
import './Avatar.css'

function initialsFromName(name) {
  if (!name) return ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function Avatar({ profile, size = 40, className = '' }) {
  const color = profile?.color || 'var(--primary)'
  const name = profile?.display_name || ''
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.42),
    '--avatar-color': color,
  }

  let content
  if (profile?.avatar_url) {
    content = <img src={profile.avatar_url} alt="" className="avatar-img" />
  } else if (profile?.avatar) {
    content = <span aria-hidden="true">{profile.avatar}</span>
  } else if (name) {
    content = <span aria-hidden="true">{initialsFromName(name)}</span>
  } else {
    content = <UserRound size={Math.round(size * 0.55)} strokeWidth={1.75} aria-hidden="true" />
  }

  return (
    <span className={`avatar ${className}`.trim()} style={style} title={name || undefined}>
      {content}
    </span>
  )
}
