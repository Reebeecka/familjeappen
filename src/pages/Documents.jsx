import { useEffect, useRef, useState } from 'react'
import './Documents.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const BUCKET = 'documents'

function formatSize(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function Documents() {
  const { householdId, user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!householdId) return

    let active = true

    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false })
      if (!active) return
      if (fetchError) setError(fetchError.message)
      else setItems(data ?? [])
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel(`documents-${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          setItems((current) => {
            if (payload.eventType === 'INSERT') {
              if (current.some((row) => row.id === payload.new.id)) return current
              return [payload.new, ...current]
            }
            if (payload.eventType === 'UPDATE') {
              return current.map((row) => (row.id === payload.new.id ? payload.new : row))
            }
            if (payload.eventType === 'DELETE') {
              return current.filter((row) => row.id !== payload.old.id)
            }
            return current
          })
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [householdId])

  const handleUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)

    try {
      const path = `${householdId}/${crypto.randomUUID()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file)
      if (uploadError) throw uploadError

      const { error: insertError } = await supabase.from('documents').insert({
        name: file.name,
        storage_path: path,
        size: file.size,
        mime_type: file.type,
        household_id: householdId,
        created_by: user?.id,
      })
      if (insertError) throw insertError
    } catch (err) {
      setError(err.message ?? 'Uppladdningen misslyckades.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleOpen = async (doc) => {
    setError(null)
    setBusyId(doc.id)
    try {
      const { data, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 60)
      if (signError) throw signError
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message ?? 'Kunde inte öppna filen.')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (doc) => {
    setError(null)
    setBusyId(doc.id)
    try {
      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([doc.storage_path])
      if (storageError) throw storageError

      const { error: deleteError } = await supabase.from('documents').delete().eq('id', doc.id)
      if (deleteError) throw deleteError

      setItems((current) => current.filter((row) => row.id !== doc.id))
    } catch (err) {
      setError(err.message ?? 'Kunde inte ta bort filen.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Dokument 📁</h1>

      <div className="card doc-upload">
        <p className="muted">Ladda upp kvitton, avtal och andra viktiga filer.</p>
        <label className="btn primary doc-upload-btn">
          {uploading ? 'Laddar upp…' : 'Välj fil att ladda upp'}
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            disabled={uploading}
            hidden
          />
        </label>
        {uploading && <p className="muted small">Laddar upp filen, vänta…</p>}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && items.length === 0 && <p className="muted">Inga dokument ännu.</p>}

      <ul className="list">
        {items.map((doc) => (
          <li key={doc.id} className="list-item doc-item">
            <div className="doc-info">
              <span className="doc-name">{doc.name}</span>
              <span className="muted small">
                {formatSize(doc.size)}
                {doc.size != null ? ' · ' : ''}
                {formatDate(doc.created_at)}
              </span>
            </div>
            <div className="doc-actions">
              <button
                type="button"
                className="btn icon"
                onClick={() => handleOpen(doc)}
                disabled={busyId === doc.id}
                aria-label="Öppna"
              >
                ⬇️
              </button>
              <button
                type="button"
                className="btn icon"
                onClick={() => handleRemove(doc)}
                disabled={busyId === doc.id}
                aria-label="Ta bort"
              >
                🗑️
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
