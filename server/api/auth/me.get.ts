import { getOptionalSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = await getOptionalSessionUser(event)

  if (!user) {
    return {
      user: null
    }
  }

  return {
    user
  }
})
