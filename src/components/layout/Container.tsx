import type { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  className?: string
  size?: 'default' | 'wide'
}

const sizes = {
  default: 'max-w-6xl',
  wide: 'max-w-[1220px]',
}

export default function Container({ children, className = '', size = 'default' }: ContainerProps) {
  return <div className={`mx-auto w-full ${sizes[size]} px-5 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}
