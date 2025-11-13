import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  isAuthenticated: boolean
  user: { userId: string } | null
  login: (userId: string, password: string) => boolean
  logout: () => void
}

// Hardcoded credentials (for demo purposes)
const VALID_USER_ID = 'testuser'
const VALID_PASSWORD = '!2qwaszxT'

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      login: (userId: string, password: string) => {
        if (userId === VALID_USER_ID && password === VALID_PASSWORD) {
          set({ isAuthenticated: true, user: { userId } })
          return true
        }
        return false
      },
      logout: () => {
        set({ isAuthenticated: false, user: null })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)
