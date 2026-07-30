'use client'

import { ButtonHTMLAttributes, MouseEvent, useState } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pendingLabel?: string
  pendingOverride?: boolean
  confirmMessage?: string
}

/**
 * form action 제출 버튼. confirmMessage 를 주면 바로 제출하지 않고 확인 모달을 띄운다.
 *
 * 모달은 portal 없이 form 안에 인라인으로 렌더된다 — 모달의 확인 버튼이
 * type="submit" 이므로 감싸는 form 을 그대로 제출할 수 있고, 액션 성공으로
 * 행이 사라지면 모달도 함께 unmount 된다. 제출 중에는 모달을 닫을 수 없다.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  pendingOverride,
  confirmMessage,
  disabled,
  onClick,
  type = 'submit',
  ...props
}: SubmitButtonProps) {
  const { pending: formPending } = useFormStatus()
  const pending = pendingOverride ?? formPending
  const [confirming, setConfirming] = useState(false)

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage) {
      event.preventDefault()
      setConfirming(true)
      return
    }
    onClick?.(event)
  }

  return (
    <>
      <button type={type} disabled={disabled || pending} onClick={handleClick} {...props}>
        {pending && pendingLabel ? pendingLabel : children}
      </button>
      {confirming && confirmMessage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => {
            if (!pending) setConfirming(false)
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-paper p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm leading-6 text-ink">{confirmMessage}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirming(false)}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink-muted transition hover:bg-surface disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={pending}
                onClick={onClick}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {pending && pendingLabel ? pendingLabel : children}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
