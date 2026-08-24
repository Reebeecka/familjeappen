export default function EmptyState({ icon: Icon, title, description, action }) {
  const isComponent = typeof Icon === 'function'

  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-icon" aria-hidden="true">
          {isComponent ? <Icon size={30} strokeWidth={1.6} /> : Icon}
        </span>
      ) : null}
      {title ? <p className="empty-title">{title}</p> : null}
      {description ? <p className="empty-desc">{description}</p> : null}
      {action ?? null}
    </div>
  )
}
