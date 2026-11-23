import type { HealthCondition } from './types'
import { CLEANUP_RULES } from './cleanupRules'

// The Photos checks in the order they are listed (the order of the Photos rules in the registry)
export const HEALTH_CONDITIONS = CLEANUP_RULES.filter(r => r.report === 'photos').map(r => r.id.slice('photos:'.length) as HealthCondition)
