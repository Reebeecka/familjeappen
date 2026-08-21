export default function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="card setup-card">
        <h1>Nästan klart! 🛠️</h1>
        <p>
          Appen är igång, men den saknar kopplingen till Supabase (din databas och inloggning).
        </p>
        <ol>
          <li>
            Öppna filen <code>.env.local</code> i projektmappen.
          </li>
          <li>
            Klistra in din <strong>Supabase URL</strong> och <strong>anon-nyckel</strong>.
          </li>
          <li>Spara filen och starta om appen.</li>
        </ol>
        <p>
          Allt står steg för steg i <code>PLANERING.md</code>.
        </p>
      </div>
    </div>
  )
}
