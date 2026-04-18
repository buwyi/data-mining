import {
  AlignLeftOutlined,
  BranchesOutlined,
  CheckSquareOutlined,
  CodeOutlined,
  EyeOutlined,
  FieldNumberOutlined,
  FontSizeOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { Tooltip } from 'antd'
import type { ReactNode } from 'react'

import styles from './PropFieldSurface.module.css'

export type PropFieldVariant =
  | 'text'
  | 'number'
  | 'choice'
  | 'textarea'
  | 'code'
  | 'toggle'
  | 'grid'
  | 'readonly'

const variantClass: Record<PropFieldVariant, string> = {
  text: styles.variantText,
  number: styles.variantNumber,
  choice: styles.variantChoice,
  textarea: styles.variantTextarea,
  code: styles.variantCode,
  toggle: styles.variantToggle,
  grid: styles.variantGrid,
  readonly: styles.variantReadonly,
}

function VariantIcon({ variant }: { variant: PropFieldVariant }) {
  const cls = `${styles.iconWrap} ${variantClass[variant]}`
  switch (variant) {
    case 'number':
      return (
        <span className={cls} aria-hidden>
          <FieldNumberOutlined />
        </span>
      )
    case 'choice':
      return (
        <span className={cls} aria-hidden>
          <BranchesOutlined />
        </span>
      )
    case 'textarea':
      return (
        <span className={cls} aria-hidden>
          <AlignLeftOutlined />
        </span>
      )
    case 'code':
      return (
        <span className={cls} aria-hidden>
          <CodeOutlined />
        </span>
      )
    case 'toggle':
      return (
        <span className={cls} aria-hidden>
          <CheckSquareOutlined />
        </span>
      )
    case 'grid':
      return (
        <span className={cls} aria-hidden>
          <TableOutlined />
        </span>
      )
    case 'readonly':
      return (
        <span className={cls} aria-hidden>
          <EyeOutlined />
        </span>
      )
    case 'text':
    default:
      return (
        <span className={cls} aria-hidden>
          <FontSizeOutlined />
        </span>
      )
  }
}

export type PropFieldSurfaceProps = {
  variant: PropFieldVariant
  label: string
  required?: boolean
  toolTip?: unknown
  description?: string | null
  readOnly?: boolean
  children: ReactNode
  /** 控件下方的辅助说明（如技术提示） */
  footer?: ReactNode
  /** 为单选列表等附加 className */
  controlClassName?: string
}

export function PropFieldSurface({
  variant,
  label,
  required,
  toolTip,
  description,
  readOnly,
  children,
  footer,
  controlClassName,
}: PropFieldSurfaceProps) {
  const tip = typeof toolTip === 'string' && toolTip.length > 0 ? toolTip : null

  return (
    <div
      className={`${styles.surface} ${readOnly ? styles.surfaceReadOnly : ''}`}
      data-prop-variant={variant}
    >
      <div className={styles.inner}>
        <div className={styles.head}>
          <VariantIcon variant={variant} />
          <div className={styles.labelCol}>
            <div className={styles.labelRow}>
              {required ? (
                <span className={styles.required} title="必填">
                  *
                </span>
              ) : null}
              <span className={styles.labelText}>{label}</span>
              {tip ? (
                <Tooltip title={tip.split(';').join('\n')}>
                  <span className={styles.helpIcon} tabIndex={0} role="note" aria-label="参数说明">
                    ?
                  </span>
                </Tooltip>
              ) : null}
            </div>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
        </div>
        <div className={`${styles.control} ${controlClassName ?? ''}`.trim()}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </div>
    </div>
  )
}
