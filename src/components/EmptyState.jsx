import { isValidElement } from 'react'

function renderIcon(Icon) {
  if (!Icon) return null
  if (typeof Icon === 'string' || typeof Icon === 'number' || isValidElement(Icon)) {
    return Icon
  }
  return <Icon size={30} strokeWidth={1.6} />
}

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-icon" aria-hidden="true">
          {renderIcon(Icon)}
        </span>
      ) : null}
      {title ? <p className="empty-title">{title}</p> : null}
      {description ? <p className="empty-desc">{description}</p> : null}
      {action ?? null}
    </div>
  )
}
