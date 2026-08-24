import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { useHouseholdMembers } from '../lib/useHouseholdMembers'
import { isListItemOverdue, useListItems } from '../lib/useListItems'
import { supabase } from '../lib/supabase'
import './ListDetail.css'

const PRIORITIES = [
  { value: 'låg', label: 'Låg' },
  { value: 'normal', label: 'Normal' },
  { value: 'hög', label: 'Hög' },
]

const PRIORITY_LABELS = new Map(PRIORITIES.map(({ value, label }) => [value, label]))
const PRIORITY_RANK = { hög: 0, normal: 1, låg: 2 }

function getDateDifference(dueDate) {
  const [year, month, day] = dueDate.split('-').map(Number)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const due = Date.UTC(year, month - 1, day)
  return Math.round((due - today) / 86_400_000)
}

function formatDueDate(dueDate) {
  if (!dueDate) return null
  const difference = getDateDifference(dueDate)
  if (difference === 0) return 'Idag'
  if (difference === 1) return 'Imorgon'

  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dueDate}T00:00:00`))
}

function sortDisplayItems(items) {
  return [...items].sort((first, second) => {
    if (first.done !== second.done) return Number(first.done) - Number(second.done)

    const overdueDifference =
      Number(isListItemOverdue(second)) - Number(isListItemOverdue(first))
    if (overdueDifference) return overdueDifference

    const priorityDifference =
      (PRIORITY_RANK[first.priority] ?? PRIORITY_RANK.normal) -
      (PRIORITY_RANK[second.priority] ?? PRIORITY_RANK.normal)
    if (priorityDifference) return priorityDifference

    if (first.due_date || second.due_date) {
      if (!first.due_date) return 1
      if (!second.due_date) return -1
      const dueDateDifference = first.due_date.localeCompare(second.due_date)
      if (dueDateDifference) return dueDateDifference
    }

    const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER
    const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER
    if (firstPosition !== secondPosition) return firstPosition - secondPosition
    return new Date(first.created_at) - new Date(second.created_at)
  })
}

function ListItem({
  item,
  subtasks,
  listType,
  members,
  membersById,
  membersLoading,
  isSubtask = false,
  subtaskParentId,
  subtaskTitle,
  addingSubtask,
  onSubtaskTitleChange,
  onShowSubtaskForm,
  onCancelSubtask,
  onAddSubtask,
  update,
  remove,
}) {
  const [areSubtasksExpanded, setAreSubtasksExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const isShopping = listType === 'shopping'
  const isTodo = listType === 'todo'
  const assignedMember = membersById.get(item.assigned_to)
  const completedSubtasks = subtasks.filter((subtask) => subtask.done).length
  const subtaskProgress = subtasks.length ? (completedSubtasks / subtasks.length) * 100 : 0
  const overdue = isTodo && isListItemOverdue(item)
  const priority = item.priority ?? 'normal'
  const showPriorityBadge = isTodo && priority !== 'normal'
  const canHaveSubtasks = !isSubtask && listType !== 'shopping'
  const hasEditor = isTodo || canHaveSubtasks
  const itemClasses = [
    'list-item',
    'list-detail-item',
    item.done ? 'done' : '',
    overdue ? 'overdue' : '',
    isTodo && item.priority === 'hög' ? 'high-priority' : '',
    isSubtask ? 'subtask' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const itemNoun = isSubtask ? 'deluppgiften' : isShopping ? 'varan' : 'uppgiften'

  return (
    <li className={isSubtask ? 'list-detail-subtask-entry' : 'list-detail-parent-entry'}>
      <div className={itemClasses}>
        <div className="list-detail-item-content">
          <div className="list-detail-item-main">
            <label className="check-label">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => update(item.id, { done: !item.done })}
              />
              <span>{item.title}</span>
            </label>

            {(showPriorityBadge ||
              (isTodo && item.due_date) ||
              (!isSubtask && subtasks.length > 0)) && (
              <div className="list-detail-status">
                {showPriorityBadge && (
                  <span
                    className={`list-detail-priority-badge priority-${priority}`}
                    title={`Prioritet: ${PRIORITY_LABELS.get(priority) ?? 'Normal'}`}
                  >
                    {PRIORITY_LABELS.get(priority) ?? 'Normal'}
                  </span>
                )}
                {isTodo && item.due_date && (
                  <span className={overdue ? 'list-detail-due overdue' : 'list-detail-due muted'}>
                    <span aria-hidden="true">◷</span>{' '}
                    {overdue
                      ? `Försenad · ${formatDueDate(item.due_date)}`
                      : formatDueDate(item.due_date)}
                  </span>
                )}
                {!isSubtask && subtasks.length > 0 && (
                  <button
                    type="button"
                    className="list-detail-progress-toggle"
                    onClick={() => setAreSubtasksExpanded((current) => !current)}
                    aria-expanded={areSubtasksExpanded}
                  >
                    <span
                      className="list-detail-progress-track"
                      role="progressbar"
                      aria-label={`${completedSubtasks} av ${subtasks.length} deluppgifter klara`}
                      aria-valuemin="0"
                      aria-valuemax={subtasks.length}
                      aria-valuenow={completedSubtasks}
                    >
                      <span
                        className="list-detail-progress-value"
                        style={{ width: `${subtaskProgress}%` }}
                      />
                    </span>
                    <span>
                      {completedSubtasks}/{subtasks.length}
                    </span>
                    <span aria-hidden="true">{areSubtasksExpanded ? '▾' : '▸'}</span>
                  </button>
                )}
              </div>
            )}

            {isShopping && (item.quantity || item.category) && (
              <div className="list-detail-shopping-meta">
                {item.quantity && (
                  <span className="list-detail-meta-chip">Antal: {item.quantity}</span>
                )}
                {item.category && <span className="list-detail-meta-chip">{item.category}</span>}
              </div>
            )}

            {isTodo && assignedMember && (
              <span className="list-detail-member muted small">
                <span
                  className="list-detail-member-dot"
                  style={{ backgroundColor: assignedMember.color || 'var(--muted)' }}
                  aria-hidden="true"
                />
                {assignedMember.display_name || 'Namnlös medlem'}
              </span>
            )}
          </div>

          {hasEditor && (
            <button
              type="button"
              className="btn ghost list-detail-edit-toggle"
              onClick={() => setIsEditing((current) => !current)}
              aria-expanded={isEditing}
            >
              {isEditing ? 'Dölj' : 'Redigera'}
            </button>
          )}

          {hasEditor && isEditing && (
            <div className="list-detail-editor">
              {isTodo && (
                <div className="list-detail-edit-fields">
                  <label className="small">
                    Förfallodatum
                    <input
                      type="date"
                      value={item.due_date ?? ''}
                      onChange={(event) =>
                        update(item.id, { due_date: event.target.value || null })
                      }
                    />
                  </label>
                  <label className="small">
                    Prioritet
                    <select
                      value={item.priority ?? 'normal'}
                      onChange={(event) => update(item.id, { priority: event.target.value })}
                    >
                      {PRIORITIES.map((priorityOption) => (
                        <option key={priorityOption.value} value={priorityOption.value}>
                          {priorityOption.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {isTodo && (
                <label className="small list-detail-assignment">
                  Tilldela till
                  <select
                    value={item.assigned_to ?? ''}
                    onChange={(event) =>
                      update(item.id, { assigned_to: event.target.value || null })
                    }
                    disabled={membersLoading}
                  >
                    <option value="">Ingen</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.display_name || 'Namnlös medlem'}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {canHaveSubtasks && (
                <button
                  type="button"
                  className="btn ghost list-detail-add-subtask"
                  onClick={() => onShowSubtaskForm(item.id)}
                >
                  + Lägg till deluppgift
                </button>
              )}

              {canHaveSubtasks && subtaskParentId === item.id && (
                <form className="list-detail-subtask-form" onSubmit={onAddSubtask}>
                  <label>
                    Deluppgift
                    <input
                      type="text"
                      value={subtaskTitle}
                      onChange={(event) => onSubtaskTitleChange(event.target.value)}
                      placeholder="Ny deluppgift…"
                      autoFocus
                    />
                  </label>
                  <div className="list-detail-subtask-actions">
                    <button type="button" className="btn ghost" onClick={onCancelSubtask}>
                      Avbryt
                    </button>
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={addingSubtask || !subtaskTitle.trim()}
                    >
                      {addingSubtask ? 'Sparar…' : 'Lägg till'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn icon list-detail-remove"
          onClick={() => {
            if (
              !window.confirm(
                `Vill du ta bort ${itemNoun} "${item.title}"? Detta går inte att ångra.`,
              )
            )
              return
            remove(item.id)
          }}
          aria-label={`Ta bort ${itemNoun} ${item.title}`}
        >
          🗑️
        </button>
      </div>

      {!isSubtask && subtasks.length > 0 && areSubtasksExpanded && (
        <ul className="list-detail-subtasks">
          {sortDisplayItems(subtasks).map((subtask) => (
            <ListItem
              key={subtask.id}
              item={subtask}
              subtasks={[]}
              listType={listType}
              members={members}
              membersById={membersById}
              membersLoading={membersLoading}
              isSubtask
              update={update}
              remove={remove}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function ListDetail() {
  const { listId } = useParams()
  const { householdId } = useAuth()
  const { members, loading: membersLoading } = useHouseholdMembers()
  const { items, loading, error, add, update, remove } = useListItems(listId)
  const listScopeKey = householdId && listId ? `${householdId}:${listId}` : null
  const [listResult, setListResult] = useState({
    scopeKey: null,
    list: null,
    error: null,
  })
  const [title, setTitle] = useState('')
  const [quantity, setQuantity] = useState('')
  const [category, setCategory] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('normal')
  const [submitting, setSubmitting] = useState(false)
  const [subtaskParentId, setSubtaskParentId] = useState(null)
  const [subtaskTitle, setSubtaskTitle] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)

  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )
  const topLevelItems = useMemo(
    () => sortDisplayItems(items.filter((item) => !item.parent_id)),
    [items],
  )
  const subtasksByParent = useMemo(() => {
    const groupedSubtasks = new Map()
    items.forEach((item) => {
      if (!item.parent_id) return
      const parentSubtasks = groupedSubtasks.get(item.parent_id) ?? []
      parentSubtasks.push(item)
      groupedSubtasks.set(item.parent_id, parentSubtasks)
    })
    return groupedSubtasks
  }, [items])

  useEffect(() => {
    if (!listScopeKey) return

    let active = true

    const loadList = async () => {
      const { data, error: fetchError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .maybeSingle()

      if (!active) return
      setListResult({
        scopeKey: listScopeKey,
        list: fetchError ? null : data,
        error: fetchError?.message ?? null,
      })
    }
    loadList()

    const channel = supabase
      .channel(`list-detail-${householdId}-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lists',
          filter: `id=eq.${listId}`,
        },
        (payload) => {
          setListResult((current) => {
            if (current.scopeKey !== listScopeKey) return current
            if (payload.eventType === 'UPDATE') return { ...current, list: payload.new }
            if (payload.eventType === 'DELETE') return { ...current, list: null }
            return current
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId, listId, listScopeKey])

  const hasLoadedList = listResult.scopeKey === listScopeKey
  const list = hasLoadedList ? listResult.list : null
  const listError = hasLoadedList ? listResult.error : null
  const listLoading = Boolean(listScopeKey && !hasLoadedList)

  const listType = list?.type ?? 'todo'
  const isShopping = listType === 'shopping'
  const isSimple = listType === 'simple'
  const isTodo = listType === 'todo'

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !list || submitting) return

    setSubmitting(true)
    const wasAdded = await add({
      title: trimmedTitle,
      done: false,
      assigned_to: isTodo ? assignedTo || null : null,
      quantity: isShopping ? quantity.trim() || null : null,
      category: isShopping ? category.trim() || null : null,
      due_date: isTodo ? dueDate || null : null,
      priority: isTodo ? priority : 'normal',
      parent_id: null,
    })
    setSubmitting(false)

    if (wasAdded) {
      setTitle('')
      setQuantity('')
      setCategory('')
      setAssignedTo('')
      setDueDate('')
      setPriority('normal')
    }
  }

  const handleShowSubtaskForm = (parentId) => {
    setSubtaskParentId(parentId)
    setSubtaskTitle('')
  }

  const handleCancelSubtask = () => {
    setSubtaskParentId(null)
    setSubtaskTitle('')
  }

  const handleAddSubtask = async (event) => {
    event.preventDefault()
    const trimmedTitle = subtaskTitle.trim()
    if (!trimmedTitle || !subtaskParentId || addingSubtask) return

    setAddingSubtask(true)
    const wasAdded = await add({
      title: trimmedTitle,
      done: false,
      parent_id: subtaskParentId,
      priority: 'normal',
    })
    setAddingSubtask(false)

    if (wasAdded) handleCancelSubtask()
  }

  if (listLoading) {
    return (
      <div className="page">
        <Spinner />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="page">
        <Link to="/listor" className="list-detail-back">
          ← Tillbaka till listor
        </Link>
        <h1 className="page-title">Listan hittades inte</h1>
        <p className={listError ? 'error' : 'muted'}>
          {listError || 'Listan kan ha tagits bort.'}
        </p>
      </div>
    )
  }

  const itemLabel = isShopping ? 'Vara' : isSimple ? 'Punkt' : 'Uppgift'
  const itemPlaceholder = isShopping ? 'Ny vara…' : isSimple ? 'Ny punkt…' : 'Ny uppgift…'
  const fallbackIcon = isShopping ? '🛒' : isSimple ? '🗒️' : '✅'
  const emptyTitle = isShopping
    ? 'Inköpslistan är tom'
    : isSimple
      ? 'Listan är tom'
      : 'Inga uppgifter än'
  const emptyDescription = isShopping
    ? 'Lägg till den första varan ovan.'
    : 'Lägg till den första punkten ovan.'

  return (
    <div className="page">
      <header className="list-detail-header">
        <Link to="/listor" className="list-detail-back">
          ← Listor
        </Link>
        <h1 className="page-title">
          {list.icon || fallbackIcon} {list.name}
        </h1>
      </header>

      <form
        onSubmit={handleAdd}
        className="form card list-detail-form"
        aria-busy={submitting}
      >
        <label>
          {itemLabel}
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={itemPlaceholder}
          />
        </label>

        {isShopping && (
          <div className="list-detail-fields">
            <label>
              Antal (valfritt)
              <input
                type="text"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="Till exempel 2 st"
              />
            </label>
            <label>
              Kategori (valfritt)
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Till exempel Mejeri"
              />
            </label>
          </div>
        )}

        {isTodo && (
          <>
            <label>
              Tilldela till
              <select
                value={assignedTo}
                onChange={(event) => setAssignedTo(event.target.value)}
                disabled={membersLoading}
              >
                <option value="">Ingen</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.display_name || 'Namnlös medlem'}
                  </option>
                ))}
              </select>
            </label>

            <div className="list-detail-fields">
              <label>
                Förfallodatum (valfritt)
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <label>
                Prioritet
                <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                  {PRIORITIES.map((priorityOption) => (
                    <option key={priorityOption.value} value={priorityOption.value}>
                      {priorityOption.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}

        <button type="submit" className="btn primary" disabled={submitting || !title.trim()}>
          {submitting ? 'Sparar…' : 'Lägg till'}
        </button>
      </form>

      {(error || listError) && <p className="error">{error || listError}</p>}
      {loading && <Spinner />}
      {!loading && items.length === 0 && (
        <EmptyState icon={fallbackIcon} title={emptyTitle} description={emptyDescription} />
      )}

      <ul className="list list-detail-list">
        {topLevelItems.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            subtasks={subtasksByParent.get(item.id) ?? []}
            listType={listType}
            members={members}
            membersById={membersById}
            membersLoading={membersLoading}
            subtaskParentId={subtaskParentId}
            subtaskTitle={subtaskTitle}
            addingSubtask={addingSubtask}
            onSubtaskTitleChange={setSubtaskTitle}
            onShowSubtaskForm={handleShowSubtaskForm}
            onCancelSubtask={handleCancelSubtask}
            onAddSubtask={handleAddSubtask}
            update={update}
            remove={remove}
          />
        ))}
      </ul>
    </div>
  )
}
