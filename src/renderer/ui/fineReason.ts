// "This one is fine" asks for a reason afterwards (#189): the panels call askFineReason once the mark is saved, and the host
// (FineReasonHost, mounted once in the app) shows the small bar. Nothing here blocks the mark.

export interface FineAsk { checkId: string; key: string; label: string }
let listener: ((ask: FineAsk) => void) | null = null
export const askFineReason = (ask: FineAsk): void => { listener?.(ask) }
export const onFineAsk = (fn: (ask: FineAsk) => void): (() => void) => { listener = fn; return () => { if (listener === fn) listener = null } }
