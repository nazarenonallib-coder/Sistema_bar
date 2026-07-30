import { useState } from 'react'
import * as api from '../api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api.login(username.trim(), password)
      api.setToken(data.token)
      api.setUsuario(data.usuario)
      onLogin(data.usuario)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-1">Sistema</p>
        <h1 className="text-2xl font-black text-gray-800 mb-6">Chepola</h1>

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Usuario
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
          required
          className="w-full border rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full border rounded-lg px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />

        {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {submitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
