'use client'

import { ButtonHTMLAttributes, MouseEvent } from 'react'
import { useFormStatus } from 'react-dom'

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pendingLabel?: string
  pendingOverride?: boolean
  confirmMessage?: string
}

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

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button type={type} disabled={disabled || pending} onClick={handleClick} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
