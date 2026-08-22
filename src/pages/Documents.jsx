import { useEffect, useRef, useState } from 'react'
import './Documents.css'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const BUCKET = 'documents'
const ALL_FOLDERS = '__all__'
const NO_FOLDER = '__none__'

function getFolderName(doc) {
  return doc.folder?.trim() || 'Utan mapp'
}

function isImage(doc) {
  return doc.mime_type?.startsWith('image/')
}

function isPdf(doc) {
  return doc.mime_type === 'application/pdf'
}

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
  const [folder, setFolder] = useState('')
  const [folderFilter, setFolderFilter] = useState(ALL_FOLDERS)
  const [previewUrls, setPreviewUrls] = useState({})
  const [previewErrors, setPreviewErrors] = useState({})
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

  useEffect(() => {
    const imageDocuments = items.filter(isImage)
    if (imageDocuments.length === 0) {
      setPreviewUrls({})
      setPreviewErrors({})
      return
    }

    let active = true

    const loadPreviews = async () => {
      const results = await Promise.all(
        imageDocuments.map(async (doc) => {
          const { data, error: signError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(doc.storage_path, 3600)
          return { doc, signedUrl: data?.signedUrl, signError }
        }),
      )
      if (!active) return

      const urls = {}
      const errors = {}
      results.forEach(({ doc, signedUrl, signError }) => {
        if (signError) errors[doc.id] = 'Förhandsvisning kunde inte laddas.'
        else urls[doc.id] = signedUrl
      })
      setPreviewUrls(urls)
      setPreviewErrors(errors)
    }

    loadPreviews()

    return () => {
      active = false
    }
  }, [items])

  const folders = [...new Set(items.map((doc) => doc.folder?.trim()).filter(Boolean))].sort(
    (first, second) => first.localeCompare(second, 'sv'),
  )

  const filteredItems = items.filter((doc) => {
    if (folderFilter === ALL_FOLDERS) return true
    if (folderFilter === NO_FOLDER) return !doc.folder?.trim()
    return doc.folder?.trim() === folderFilter
  })

  const groupedItems = filteredItems.reduce((groups, doc) => {
    const folderName = getFolderName(doc)
    if (!groups[folderName]) groups[folderName] = []
    groups[folderName].push(doc)
    return groups
  }, Object.create(null))

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
        folder: folder.trim() || null,
        household_id: householdId,
        created_by: user?.id,
      })
      if (insertError) {
        const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([path])
        if (cleanupError) {
          throw new Error(
            `${insertError.message} Den uppladdade filen kunde inte tas bort: ${cleanupError.message}`,
          )
        }
        throw insertError
      }
    } catch (err) {
      setError(err.message ?? 'Uppladdningen misslyckades.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleOpen = async (doc, download = false) => {
    setError(null)
    setBusyId(doc.id)
    try {
      const { data, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.storage_path, 60, download ? { download: doc.name } : undefined)
      if (signError) throw signError
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err.message ?? 'Kunde inte öppna filen.')
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (doc) => {
    if (
      !window.confirm(`Vill du ta bort dokumentet "${doc.name}"? Detta går inte att ångra.`)
    )
      return

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
        <label className="doc-folder-field">
          Mapp
          <input
            type="text"
            list="document-folders"
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            placeholder="Till exempel Försäkringar"
            disabled={uploading}
          />
          <datalist id="document-folders">
            {folders.map((folderName) => (
              <option key={folderName} value={folderName} />
            ))}
          </datalist>
        </label>
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

      {!loading && items.length > 0 && (
        <>
          <label className="doc-filter">
            Visa mapp
            <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}>
              <option value={ALL_FOLDERS}>Alla mappar</option>
              {folders.map((folderName) => (
                <option key={folderName} value={folderName}>
                  {folderName}
                </option>
              ))}
              {items.some((doc) => !doc.folder?.trim()) && (
                <option value={NO_FOLDER}>Utan mapp</option>
              )}
            </select>
          </label>

          {filteredItems.length === 0 && <p className="muted">Inga dokument i den mappen.</p>}

          <div className="doc-groups">
            {Object.entries(groupedItems).map(([folderName, documents]) => (
              <section key={folderName} className="doc-group">
                <h2 className="doc-group-title">📁 {folderName}</h2>
                <ul className="list">
                  {documents.map((doc) => (
                    <li key={doc.id} className="list-item doc-item">
                      {isImage(doc) && previewUrls[doc.id] && (
                        <img
                          className="doc-preview"
                          src={previewUrls[doc.id]}
                          alt={`Förhandsvisning av ${doc.name}`}
                        />
                      )}
                      <div className="doc-details">
                        <div className="doc-info">
                          <span className="doc-name">{doc.name}</span>
                          <span className="muted small">
                            {formatSize(doc.size)}
                            {doc.size != null ? ' · ' : ''}
                            {formatDate(doc.created_at)}
                          </span>
                          {previewErrors[doc.id] && (
                            <span className="error small">{previewErrors[doc.id]}</span>
                          )}
                        </div>
                        <div className="doc-actions">
                          {isPdf(doc) && (
                            <button
                              type="button"
                              className="btn ghost doc-preview-btn"
                              onClick={() => handleOpen(doc)}
                              disabled={busyId === doc.id}
                            >
                              Förhandsgranska
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn icon"
                            onClick={() => handleOpen(doc, true)}
                            disabled={busyId === doc.id}
                            aria-label={`Ladda ner ${doc.name}`}
                            title="Ladda ner"
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            className="btn icon"
                            onClick={() => handleRemove(doc)}
                            disabled={busyId === doc.id}
                            aria-label={`Ta bort dokumentet ${doc.name}`}
                            title="Ta bort"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
