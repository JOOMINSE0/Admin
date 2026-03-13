import { useState } from 'react'
import styles from './CollapsibleSection.module.css'

type CollapsibleSectionProps = {
  title: string
  icon?: string
  children: React.ReactNode
  defaultOpen?: boolean
}

export default function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.header}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
        <span className={`${styles.arrow} ${open ? styles.arrowDown : ''}`}>›</span>
      </button>
      {open && <div className={styles.body}>{children}</div>}
    </section>
  )
}
