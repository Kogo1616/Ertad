import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api } from './api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null) // null = loading
  const reload = useCallback(() => api('/auth/me').then(setMe).catch(() => setMe({ authenticated: false })), [])
  useEffect(() => { reload() }, [reload])

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    await reload()
  }
  return <AuthContext.Provider value={{ me, reload, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
export const isBuyer = (me) => me?.authenticated && me.role === 'Buyer'
