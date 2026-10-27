export interface User {
  email: string
  displayName: string
}

export interface AuthSession {
  user: User
  token: string
}

interface Account {
  user: User
  password: string
}

const accounts: Account[] = [
  {
    user: { email: 'demo@duongsat.vn', displayName: 'Khách demo' },
    password: 'Tau123456',
  },
]

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

const createDisplayName = (email: string) => {
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
  return name ? name.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('vi')) : email
}

export const authService = {
  async register(email: string, password: string): Promise<User> {
    await delay(500)
    const normalizedEmail = email.trim().toLocaleLowerCase('vi')

    if (accounts.some((account) => account.user.email === normalizedEmail)) {
      throw new Error('Email này đã được đăng ký')
    }

    const user = { email: normalizedEmail, displayName: createDisplayName(normalizedEmail) }
    accounts.push({ user, password })
    return user
  },

  async login(email: string, password: string): Promise<AuthSession> {
    await delay(500)
    const normalizedEmail = email.trim().toLocaleLowerCase('vi')
    const account = accounts.find(
      (item) => item.user.email === normalizedEmail && item.password === password,
    )

    if (!account) {
      throw new Error('Email hoặc mật khẩu không chính xác')
    }

    return {
      user: account.user,
      token: `mock_${globalThis.crypto.randomUUID()}`,
    }
  },
}