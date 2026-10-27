import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authService, type AuthSession, type User } from './authService'

const STORAGE_KEY = 'duongsat.auth.session'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<User>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readSession(): AuthSession | null {
  try {
    const savedSession = localStorage.getItem(STORAGE_KEY)
    return savedSession ? (JSON.parse(savedSession) as AuthSession) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readSession)

  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [session])

  const value: AuthContextValue = {
    user: session?.user ?? null,
    isAuthenticated: Boolean(session),
    async signIn(email, password) {
      setSession(await authService.login(email, password))
    },
    signUp: (email, password) => authService.register(email, password),
    signOut: () => setSession(null),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider')
  }

  return context
}