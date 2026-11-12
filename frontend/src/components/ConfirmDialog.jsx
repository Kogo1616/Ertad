import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// A styled replacement for window.confirm():
//   const confirm = useConfirm()
//   if (!(await confirm({ title, message, confirmLabel, danger: true }))) return
// Built on the native <dialog> (showModal), so focus is trapped, Esc closes it and the page behind is inert.

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null) // { title, message, confirmLabel, cancelLabel, danger, resolve }
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)

  const confirm = useCallback((options) => new Promise((resolve) => setRequest({ ...options, resolve })), [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!request || !dialog) return
    if (!dialog.open) dialog.showModal()
    // Destructive actions start on "cancel" so Enter never deletes by accident.
    ;(request.danger ? cancelRef : confirmRef).current?.focus()
  }, [request])

  const close = (result) => {
    request?.resolve(result)
    dialogRef.current?.close()
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onCancel={(e) => { e.preventDefault(); close(false) }}           // Esc
        onClick={(e) => { if (e.target === dialogRef.current) close(false) }} // click on the backdrop
      >
        {request && (
          <div className="dialog-body">
            {request.danger && (
              <span className="dialog-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v5M14 11v5" />
                </svg>
              </span>
            )}
            <h2 id="confirm-title" className="dialog-title">{request.title}</h2>
            {request.message && <p id="confirm-message" className="dialog-message">{request.message}</p>}
            <div className="dialog-actions">
              <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={() => close(false)}>
                {request.cancelLabel ?? 'გაუქმება'}
              </button>
              <button ref={confirmRef} type="button" className={'btn' + (request.danger ? ' btn-danger' : '')} onClick={() => close(true)}>
                {request.confirmLabel ?? 'დადასტურება'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmContext)
