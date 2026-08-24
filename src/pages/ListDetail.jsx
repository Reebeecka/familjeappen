import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import EmptyState from '../components/EmptyState'
import Spinner from '../components/Spinner'
import { useAuth } from '../lib/AuthContext'
import { useHouseholdMembers } from '../lib/useHouseholdMembers'
import { isListItemOverdue, sortListItems, useListItems } from '../lib/useListItems'
import { supabase } from '../lib/supabase'
import './ListDetail.css'

const PRIORITIES = [
  { value: 'låg', label: 'Låg' },
  { value: 'normal', label: 'Normal' },
  { value: 'hög', label: 'Hög' },
]

function formatDueDate(dueDate) {
  if (!dueDate) return null
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${dueDate}T00:00:00`))
}

function ListItem({
  item,
  subtasks,
  isShopping,
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
  const assignedMember = membersById.get(item.assigned_to)
  const completedSubtasks = subtasks.filter((subtask) => subtask.done).length
  const overdue = isListItemOverdue(item)
  const itemClasses = [
    'list-item',
    'list-detail-item',
    item.done ? 'done' : '',
    overdue ? 'overdue' : '',
    item.priority === 'hög' ? 'high-priority' : '',
    isSubtask ? 'subtask' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={isSubtask ? 'list-detail-subtask-entry' : 'list-detail-parent-entry'}>
      <div className={itemClasses}>
        <div className="list-detail-item-content">
          <label className="check-label">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => update(item.id, { done: !item.done })}
            />
            <span>{item.title}</span>
          </label>

          <div className="list-detail-status">
            {item.priority === 'hög' && (
              <span className="list-detail-priority-badge">Hög prioritet</span>
            )}
            {item.due_date && (
              <span className={overdue ? 'list-detail-due overdue' : 'list-detail-due muted'}>
                {overdue ? 'Försenad' : 'Förfaller'} {formatDueDate(item.due_date)}
              </span>
            )}
            {!isSubtask && subtasks.length > 0 && (
              <span className="muted small">
                {completedSubtasks}/{subtasks.length} klara
              </span>
            )}
          </div>

          {isShopping && (item.quantity || item.category) && (
            <span className="muted small">
              {[item.quantity, item.category].filter(Boolean).join(' · ')}
            </span>
          )}

          {!isShopping && assignedMember && (
            <span className="list-detail-member muted small">
              <span
                className="list-detail-member-dot"
                style={{ backgroundColor: assignedMember.color || 'var(--muted)' }}
                aria-hidden="true"
              />
              {assignedMember.avatar && <span aria-hidden="true">{assignedMember.avatar}</span>}
              {assignedMember.display_name || 'Namnlös medlem'}
            </span>
          )}

          <div className="list-detail-edit-fields">
            <label className="small">
              Förfallodatum
              <input
                type="date"
                value={item.due_date ?? ''}
                onChange={(event) => update(item.id, { due_date: event.target.value || null })}
              />
            </label>
            <label className="small">
              Prioritet
              <select
                value={item.priority ?? 'normal'}
                onChange={(event) => update(item.id, { priority: event.target.value })}
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority.value} value={priority.value}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!isShopping && (
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
                    {member.avatar ? `${member.avatar} ` : ''}
                    {member.display_name || 'Namnlös medlem'}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isSubtask && (
            <button
              type="button"
              className="btn ghost list-detail-add-subtask"
              onClick={() => onShowSubtaskForm(item.id)}
            >
              + Lägg till deluppgift
            </button>
          )}

          {!isSubtask && subtaskParentId === item.id && (
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
                  {addingSubtask ? 'Lägger till…' : 'Lägg till'}
                </button>
              </div>
            </form>
          )}
        </div>

        <button
          type="button"
          className="btn icon list-detail-remove"
          onClick={() => {
            const itemType = isSubtask ? 'deluppgiften' : isShopping ? 'varan' : 'uppgiften'
            if (
              !window.confirm(
                `Vill du ta bort ${itemType} "${item.title}"? Detta går inte att ångra.`,
              )
            )
              return
            remove(item.id)
          }}
          aria-label={`Ta bort ${isSubtask ? 'deluppgiften' : isShopping ? 'varan' : 'uppgiften'} ${item.title}`}
        >
          🗑️
        </button>
      </div>

      {!isSubtask && subtasks.length > 0 && (
        <ul className="list-detail-subtasks">
          {sortListItems(subtasks).map((subtask) => (
            <ListItem
              key={subtask.id}
              item={subtask}
              subtasks={[]}
              isShopping={isShopping}
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
    () => sortListItems(items.filter((item) => !item.parent_id)),
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

  const handleAdd = async (event) => {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || !list || submitting) return

    setSubmitting(true)
    const wasAdded = await add({
      title: trimmedTitle,
      done: false,
      assigned_to: list.type === 'todo' ? assignedTo || null : null,
      quantity: list.type === 'shopping' ? quantity.trim() || null : null,
      category: list.type === 'shopping' ? category.trim() || null : null,
      due_date: dueDate || null,
      priority,
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

  const isShopping = list.type === 'shopping'

  return (
    <div className="page">
      <header className="list-detail-header">
        <Link to="/listor" className="list-detail-back">
          ← Listor
        </Link>
        <h1 className="page-title">
          {list.icon || (isShopping ? '🛒' : '✅')} {list.name}
        </h1>
      </header>

      <form onSubmit={handleAdd} className="form card list-detail-form">
        <label>
          {isShopping ? 'Vara' : 'Uppgift'}
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={isShopping ? 'Ny vara…' : 'Ny uppgift…'}
          />
        </label>

        {isShopping ? (
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
        ) : (
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
                  {member.avatar ? `${member.avatar} ` : ''}
                  {member.display_name || 'Namnlös medlem'}
                </option>
              ))}
            </select>
          </label>
        )}

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

        <button type="submit" className="btn primary" disabled={submitting || !title.trim()}>
          {submitting ? 'Lägger till…' : 'Lägg till'}
        </button>
      </form>

      {(error || listError) && <p className="error">{error || listError}</p>}
      {loading && <Spinner />}
      {!loading && items.length === 0 && (
        <EmptyState
          icon={isShopping ? '🗒️' : '✅'}
          title={isShopping ? 'Inköpslistan är tom' : 'Inga uppgifter än'}
          description={
            isShopping
              ? 'Lägg till den första varan ovan.'
              : 'Lägg till den första uppgiften ovan.'
          }
        />
      )}

      <ul className="list list-detail-list">
        {topLevelItems.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            subtasks={subtasksByParent.get(item.id) ?? []}
            isShopping={isShopping}
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
