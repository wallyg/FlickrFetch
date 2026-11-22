import { useCallback, useEffect, useState } from 'react'
import { ruleState } from '../../shared/cleanupRules'
import type { CleanupRuleSettings, CleanupRuleState } from '../../shared/cleanupRules'

// The user's choice for each Cleanup check (Off / Optional / On), kept in the app settings. `version` goes up
// whenever a choice changes, so the reports know to fetch their numbers again.
export function useCleanupRules(reloadKey = 0): {
  stateOf: (id: string) => CleanupRuleState
  setState: (id: string, state: CleanupRuleState) => Promise<void>
  version: number
} {
  const [rules, setRules] = useState<CleanupRuleSettings>({})
  const [version, setVersion] = useState(0)
  // Read on first use, and again when the Settings window has been closed (the choices can change there)
  useEffect(() => {
    void window.flickrAPI.getSettings().then(s => { setRules(s.cleanupRules ?? {}); if (reloadKey > 0) setVersion(v => v + 1) })
  }, [reloadKey])
  const stateOf = useCallback((id: string): CleanupRuleState => ruleState(rules, id), [rules])
  const setState = useCallback(async (id: string, state: CleanupRuleState): Promise<void> => {
    const next = { ...rules, [id]: state }
    setRules(next)
    await window.flickrAPI.setSettings({ cleanupRules: next })
    setVersion(v => v + 1)
  }, [rules])
  return { stateOf, setState, version }
}
