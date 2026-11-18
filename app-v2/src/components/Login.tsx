import { useState, type FormEvent } from 'react';
import { sb } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message === 'Failed to fetch'
      ? 'No hay conexión con el servidor. Si persiste, el proyecto de Supabase puede estar pausado.'
      : 'Correo o contraseña incorrectos. Revísalos y vuelve a intentarlo.');
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="logo"><i aria-hidden="true" />Manualia</div>
        <h1>Inicia sesión</h1>
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </main>
  );
}
