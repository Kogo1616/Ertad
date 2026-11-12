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
/** Admin or store staff: they manage deals and must never reserve or request a price as a buyer. */
export const isStaff = (me) => me?.authenticated && me.role !== 'Buyer'
export const staffRoleName = (me) => (me?.role === 'Admin' ? 'ადმინისტრატორი' : 'მაღაზიის თანამშრომელი')
