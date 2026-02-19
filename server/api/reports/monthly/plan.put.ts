import { readBody } from 'h3'
import { requireSessionUser } from '../../../utils/session'
import { upsertMonthlyPlan } from '../../../utils/db'
import { parseMonthlyPlanInput } from '../../../utils/validation'

export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)
  const body = await readBody(event)
  const input = parseMonthlyPlanInput(body)

  return {
    plan: await upsertMonthlyPlan(user.id, input)
  }
})
