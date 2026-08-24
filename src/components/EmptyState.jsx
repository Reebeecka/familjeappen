export default function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="empty-state">
      {icon ? (
        <span className="empty-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {title ? <p className="empty-title">{title}</p> : null}
      {description ? <p className="empty-desc">{description}</p> : null}
      {action ?? null}
    </div>
  )
}
