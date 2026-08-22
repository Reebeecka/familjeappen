import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useCollection } from '../lib/useCollection'
import './Recipes.css'

const MEAL_TYPES = [
  { value: 'frukost', label: 'Frukost' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'middag', label: 'Middag' },
]

const EMPTY_FORM = {
  title: '',
  sourceUrl: '',
  imageUrl: '',
  servings: '',
  ingredients: '',
  steps: '',
}

function todayKey() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function linesFrom(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function formFromRecipe(recipe) {
  return {
    title: recipe.title ?? '',
    sourceUrl: recipe.source_url ?? '',
    imageUrl: recipe.image_url ?? '',
    servings: recipe.servings ? String(recipe.servings) : '',
    ingredients: (recipe.ingredients ?? []).join('\n'),
    steps: (recipe.steps ?? []).join('\n'),
  }
}

function RecipeForm({ initialForm, isEditing, onCancel, onSave }) {
  const [form, setForm] = useState(initialForm)
  const [isSaving, setIsSaving] = useState(false)

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) return

    setIsSaving(true)
    await onSave({
      title: form.title.trim(),
      source_url: form.sourceUrl.trim() || null,
      image_url: form.imageUrl.trim() || null,
      servings: form.servings ? Number(form.servings) : null,
      ingredients: linesFrom(form.ingredients),
      steps: linesFrom(form.steps),
    })
    setIsSaving(false)
  }

  return (
    <form className="card form recipe-form" onSubmit={handleSubmit}>
      <h2>{isEditing ? 'Redigera recept' : 'Nytt recept'}</h2>

      <label>
        Titel
        <input
          type="text"
          value={form.title}
          onChange={(event) => setField('title', event.target.value)}
          required
        />
      </label>

      <div className="recipe-form-grid">
        <label>
          Källänk
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(event) => setField('sourceUrl', event.target.value)}
            placeholder="https://…"
          />
        </label>
        <label>
          Bildlänk
          <input
            type="url"
            value={form.imageUrl}
            onChange={(event) => setField('imageUrl', event.target.value)}
            placeholder="https://…"
          />
        </label>
      </div>

      <label>
        Portioner
        <input
          type="number"
          min="1"
          step="1"
          value={form.servings}
          onChange={(event) => setField('servings', event.target.value)}
        />
      </label>

      <label>
        Ingredienser <span className="small">(en per rad)</span>
        <textarea
          value={form.ingredients}
          onChange={(event) => setField('ingredients', event.target.value)}
          rows="7"
          placeholder={'2 dl mjöl\n1 tsk salt'}
        />
      </label>

      <label>
        Gör så här <span className="small">(ett steg per rad)</span>
        <textarea
          value={form.steps}
          onChange={(event) => setField('steps', event.target.value)}
          rows="7"
          placeholder={'Blanda ingredienserna.\nGrädda i ugnen.'}
        />
      </label>

      <div className="recipe-form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Avbryt
        </button>
        <button type="submit" className="btn primary" disabled={isSaving}>
          {isSaving ? 'Sparar…' : 'Spara recept'}
        </button>
      </div>
    </form>
  )
}

function RecipeDetail({ recipe, onBack, onEdit, onDelete }) {
  const { user, householdId } = useAuth()
  const [mealDate, setMealDate] = useState(todayKey())
  const [mealType, setMealType] = useState('middag')
  const [isWorking, setIsWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')

  const runAction = async (action, successMessage) => {
    setIsWorking(true)
    setMessage('')
    setActionError('')
    const { error } = await action()
    if (error) setActionError(error.message)
    else setMessage(successMessage)
    setIsWorking(false)
  }

  const addIngredients = () => {
    const rows = (recipe.ingredients ?? []).map((ingredient) => ({
      name: ingredient,
      checked: false,
      household_id: householdId,
      created_by: user?.id,
      updated_by: user?.id,
    }))
    if (rows.length === 0) return
    runAction(
      () => supabase.from('shopping_items').insert(rows),
      'Ingredienserna lades på inköpslistan.',
    )
  }

  const planMeal = (event) => {
    event.preventDefault()
    runAction(
      () =>
        supabase.from('meals').insert({
          meal_date: mealDate,
          meal_type: mealType,
          title: recipe.title,
          household_id: householdId,
          created_by: user?.id,
          updated_by: user?.id,
        }),
      'Måltiden planerades.',
    )
  }

  return (
    <div className="recipe-detail">
      <button type="button" className="btn ghost recipe-back" onClick={onBack}>
        ← Alla recept
      </button>

      <article className="card">
        {recipe.image_url && (
          <img className="recipe-detail-image" src={recipe.image_url} alt="" />
        )}
        <div className="recipe-detail-heading">
          <div>
            <h1 className="page-title">{recipe.title}</h1>
            {recipe.servings && <p className="muted">{recipe.servings} portioner</p>}
          </div>
          <div className="recipe-detail-controls">
            <button type="button" className="btn ghost" onClick={onEdit}>
              Redigera
            </button>
            <button type="button" className="btn icon" onClick={onDelete} aria-label="Ta bort">
              🗑️
            </button>
          </div>
        </div>

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noreferrer" className="recipe-source">
            Visa originalrecept
          </a>
        )}

        <section className="recipe-section">
          <h2>Ingredienser</h2>
          {(recipe.ingredients ?? []).length > 0 ? (
            <ul>
              {recipe.ingredients.map((ingredient, index) => (
                <li key={`${ingredient}-${index}`}>{ingredient}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Inga ingredienser angivna.</p>
          )}
        </section>

        <section className="recipe-section">
          <h2>Gör så här</h2>
          {(recipe.steps ?? []).length > 0 ? (
            <ol>
              {recipe.steps.map((step, index) => (
                <li key={`${step}-${index}`}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="muted">Inga steg angivna.</p>
          )}
        </section>
      </article>

      <section className="card recipe-actions">
        <h2>Använd receptet</h2>
        <button
          type="button"
          className="btn secondary"
          onClick={addIngredients}
          disabled={isWorking || (recipe.ingredients ?? []).length === 0}
        >
          Lägg ingredienser på inköpslistan
        </button>

        <form className="recipe-meal-form" onSubmit={planMeal}>
          <label>
            Datum
            <input
              type="date"
              value={mealDate}
              onChange={(event) => setMealDate(event.target.value)}
              required
            />
          </label>
          <label>
            Måltid
            <select value={mealType} onChange={(event) => setMealType(event.target.value)}>
              {MEAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn primary" disabled={isWorking}>
            Planera som måltid
          </button>
        </form>

        {message && <p className="info">{message}</p>}
        {actionError && <p className="error">{actionError}</p>}
      </section>
    </div>
  )
}

export default function Recipes() {
  const { items, loading, error, add, update, remove } = useCollection('recipes')
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [draftForm, setDraftForm] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState('')

  const openNewForm = () => {
    setEditingRecipe(null)
    setDraftForm(EMPTY_FORM)
  }

  const handleImport = async (event) => {
    event.preventDefault()
    const url = importUrl.trim()
    if (!url) return

    setIsImporting(true)
    setImportError('')
    const { data, error: invokeError } = await supabase.functions.invoke('import-recipe', {
      body: { url },
    })

    if (invokeError || !data?.title) {
      setImportError('Kunde inte läsa receptet automatiskt – fyll i manuellt')
    } else {
      setEditingRecipe(null)
      setDraftForm({
        title: data.title ?? '',
        sourceUrl: url,
        imageUrl: data.image ?? data.image_url ?? '',
        servings: data.servings ? String(data.servings) : '',
        ingredients: Array.isArray(data.ingredients) ? data.ingredients.join('\n') : '',
        steps: Array.isArray(data.steps) ? data.steps.join('\n') : '',
      })
    }
    setIsImporting(false)
  }

  const handleSave = async (fields) => {
    if (editingRecipe) await update(editingRecipe.id, fields)
    else await add(fields)
    setDraftForm(null)
    setEditingRecipe(null)
    setSelectedRecipe(null)
  }

  const handleDelete = async () => {
    if (!selectedRecipe || !window.confirm(`Ta bort "${selectedRecipe.title}"?`)) return
    await remove(selectedRecipe.id)
    setSelectedRecipe(null)
  }

  if (selectedRecipe && !draftForm) {
    const currentRecipe = items.find((recipe) => recipe.id === selectedRecipe.id) ?? selectedRecipe
    return (
      <div className="page">
        <RecipeDetail
          recipe={currentRecipe}
          onBack={() => setSelectedRecipe(null)}
          onEdit={() => {
            setEditingRecipe(currentRecipe)
            setDraftForm(formFromRecipe(currentRecipe))
          }}
          onDelete={handleDelete}
        />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="recipe-page-heading">
        <h1 className="page-title">Receptbok 📖</h1>
        {!draftForm && (
          <button type="button" className="btn primary" onClick={openNewForm}>
            Nytt recept
          </button>
        )}
      </div>

      {!draftForm && (
        <form className="card recipe-import" onSubmit={handleImport}>
          <label htmlFor="recipe-import-url">Importera från länk</label>
          <div className="add-row">
            <input
              id="recipe-import-url"
              type="url"
              value={importUrl}
              onChange={(event) => setImportUrl(event.target.value)}
              placeholder="https://…"
              required
            />
            <button type="submit" className="btn secondary" disabled={isImporting}>
              {isImporting ? 'Läser…' : 'Importera'}
            </button>
          </div>
          {importError && <p className="error">{importError}</p>}
        </form>
      )}

      {draftForm && (
        <RecipeForm
          key={editingRecipe?.id ?? `${draftForm.sourceUrl}-${draftForm.title}`}
          initialForm={draftForm}
          isEditing={Boolean(editingRecipe)}
          onCancel={() => {
            setDraftForm(null)
            setEditingRecipe(null)
          }}
          onSave={handleSave}
        />
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Laddar…</p>}
      {!loading && items.length === 0 && !draftForm && (
        <p className="muted">Inga recept än. Lägg till ett eller importera från en länk.</p>
      )}

      {!draftForm && (
        <ul className="recipe-list">
          {items.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                className="card recipe-card"
                onClick={() => setSelectedRecipe(recipe)}
              >
                {recipe.image_url ? (
                  <img className="recipe-card-image" src={recipe.image_url} alt="" loading="lazy" />
                ) : (
                  <span className="recipe-card-placeholder" aria-hidden="true">
                    🍲
                  </span>
                )}
                <span className="recipe-card-copy">
                  <strong>{recipe.title}</strong>
                  {recipe.servings && <span className="muted small">{recipe.servings} portioner</span>}
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
