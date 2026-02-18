import { getOptionalSessionUser } from '../../utils/session'

export default defineEventHandler((event) => {
  const user = getOptionalSessionUser(event)

  if (!user) {
    return {
      user: null
    }
  }

  return {
    user
  }
})
