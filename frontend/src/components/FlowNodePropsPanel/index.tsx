import { SearchOutlined } from '@ant-design/icons'
import {
  App,
  Checkbox,
  Collapse,
  Input,
  InputNumber,
  Radio,
  Select,
  Tabs,
  Typography,
} from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../i18n/I18nProvider'
import { FeatureValueTable } from '../FeatureValueTable'
import { PropFieldSurface } from '../PropFieldSurface'
import { ScriptCodeEditor, type ScriptCodeLanguage } from '../ScriptCodeEditor'
import { readWireNodeId, type FlowLinkWire, type FlowNodeWire } from '../../domain/flow'
import { useProjectStore } from '../../stores/projectStore'
import { FlowNodeInputDataGrid } from '../FlowNodeInputDataGrid'
import { parsePlainObjectValue } from '../../utils/featureValueObject'
import { wireElementValueToEditString, parseWireElementCommit } from '../../utils/flowNodeElementValue'
import { buildGridColumnPickOptions } from '../../utils/flowNodeColumnPickOptions'
import {
  buildExtraPatchWithGridColumnTypes,
  readGridColumnTypes,
  readGridRowsFromElement,
} from '../../utils/flowNodeGridModel'
import {
  readElementAllowClear,
  readElementMaxLength,
  readElementNumberMax,
  readElementNumberMin,
  readElementNumberStep,
  readElementReadOnly,
  readElementRequired,
  readElementRexpPattern,
  readElementSelectShowSearch,
  readElementTextAreaRows,
  readElementType,
  readElementVisible,
  setTabElementPatch,
  setTabElementValue,
  validateStringAgainstElementRexp,
} from '../../utils/flowNodeTabUtils'
import { parseTipdmOptionString } from '../../utils/tipdmElementOptions'

import styles from './FlowNodePropsPanel.module.css'

const { Text, Paragraph } = Typography

function elementMatchesNameFilter(el: Record<string, unknown>, qNorm: string): boolean {
  if (!qNorm) return true
  const label = typeof el.label === 'string' ? el.label : ''
  const name = typeof el.name === 'string' ? el.name : ''
  return label.toLowerCase().includes(qNorm) || name.toLowerCase().includes(qNorm)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function readElementDescriptionText(el: Record<string, unknown>): string | null {
  const d = el.description
  if (typeof d !== 'string') return null
  const t = d.trim()
  return t.length > 0 ? t : null
}

type ElementRendererProps = {
  el: Record<string, unknown>
  tabIndex: number
  elIndex: number
  nodeId: string
  onCommit: (tabIndex: number, elIndex: number, value: unknown) => void
  onMergeElement: (tabIndex: number, elIndex: number, patch: Record<string, unknown>) => void
  warn: (msg: string) => void
  /** 用于从上游解析列名（inputData / outputData），供对象数组表格列下拉 */
  flowContext?: { wire: FlowNodeWire; nodes: FlowNodeWire[]; links: FlowLinkWire[] }
}

/** 先校验必填（trim 后非空），再按需 `rexp`；任一失败则不 `doCommit`（受控值不变） */
function runCommitWithRexpCheck(
  el: Record<string, unknown>,
  label: string,
  warn: (msg: string) => void,
  stringToCheck: string,
  doCommit: () => void,
): void {
  if (readElementRequired(el) && stringToCheck.trim() === '') {
    warn(`「${label}」为必填项`)
    return
  }
  const pat = readElementRexpPattern(el)
  if (!pat || stringToCheck === '') {
    doCommit()
    return
  }
  const r = validateStringAgainstElementRexp(stringToCheck, pat)
  if (r === 'mismatch') {
    warn(`「${label}」格式不符合要求`)
    return
  }
  if (r === 'invalid_pattern') {
    warn(`参数「${label}」的校验规则无效，仍保存当前值`)
  }
  doCommit()
}

function renderOneElement(p: ElementRendererProps) {
  const { el, tabIndex, elIndex, nodeId, onCommit, onMergeElement, warn, flowContext } = p
  if (!readElementVisible(el)) return null

  const label = typeof el.label === 'string' ? el.label : `参数 ${elIndex}`
  const placeholder = typeof el.placeholder === 'string' ? el.placeholder : undefined
  const type = readElementType(el)
  const ro = readElementReadOnly(el)
  const descText = readElementDescriptionText(el)
  const maxLen = readElementMaxLength(el)
  const maxLenProps = maxLen !== undefined ? { maxLength: maxLen } : {}

  const commit = (value: unknown) => onCommit(tabIndex, elIndex, value)
  const tableObj = parsePlainObjectValue(el.value)

  const commitFeatureObject = (next: Record<string, unknown>) => {
    if (readElementRequired(el) && Object.keys(next).length === 0) {
      warn(`「${label}」为必填项`)
      return
    }
    commit(next)
  }

  switch (type) {
    case 1: {
      const v = el.value
      const str = v === undefined || v === null ? '' : String(v)
      if (tableObj !== null) {
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly={ro}
          >
            <FeatureValueTable value={tableObj} readOnly={ro} onChange={commitFeatureObject} />
          </PropFieldSurface>
        )
      }
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="text"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <Input
            size="small"
            variant="filled"
            value={str}
            placeholder={placeholder}
            disabled={ro}
            {...maxLenProps}
            onChange={(e) =>
              runCommitWithRexpCheck(el, label, warn, e.target.value, () =>
                commit(e.target.value),
              )
            }
          />
        </PropFieldSurface>
      )
    }
    case 2: {
      const v = el.value
      const num = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : null
      const nMin = readElementNumberMin(el)
      const nMax = readElementNumberMax(el)
      const nStep = readElementNumberStep(el)
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="number"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <InputNumber
            size="small"
            variant="filled"
            style={{ width: '100%' }}
            value={num !== null && Number.isFinite(num) ? num : null}
            placeholder={placeholder}
            disabled={ro}
            min={nMin}
            max={nMax}
            {...(nStep !== undefined ? { step: nStep } : {})}
            onChange={(n) => {
              if (n === null || n === undefined) {
                if (readElementRequired(el)) {
                  warn(`「${label}」为必填项`)
                  return
                }
                commit('')
                return
              }
              const s = String(n)
              runCommitWithRexpCheck(el, label, warn, s, () => commit(n))
            }}
          />
        </PropFieldSurface>
      )
    }
    case 3: {
      const opts = parseTipdmOptionString(el.options)
      const val = el.value === undefined || el.value === null ? undefined : String(el.value)
      const selectOptions = opts.map((o) => ({ label: o.label, value: o.value }))
      const showSearch = readElementSelectShowSearch(el, selectOptions.length)
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="choice"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <Select
            size="small"
            variant="filled"
            style={{ width: '100%' }}
            allowClear={readElementAllowClear(el)}
            showSearch={showSearch}
            optionFilterProp="label"
            placeholder={placeholder ?? '请选择'}
            value={val}
            disabled={ro}
            options={selectOptions}
            onChange={(v) => {
              const next = v ?? ''
              runCommitWithRexpCheck(el, label, warn, next, () => commit(next))
            }}
          />
        </PropFieldSurface>
      )
    }
    case 4: {
      const v = el.value
      const str = v === undefined || v === null ? '' : String(v)
      if (tableObj !== null) {
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly={ro}
          >
            <FeatureValueTable value={tableObj} readOnly={ro} onChange={commitFeatureObject} />
          </PropFieldSurface>
        )
      }
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="textarea"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <Input.TextArea
            rows={readElementTextAreaRows(el, 3)}
            size="small"
            variant="filled"
            value={str}
            placeholder={placeholder}
            disabled={ro}
            {...maxLenProps}
            onChange={(e) =>
              runCommitWithRexpCheck(el, label, warn, e.target.value, () =>
                commit(e.target.value),
              )
            }
          />
        </PropFieldSurface>
      )
    }
    case 6: {
      const opts = parseTipdmOptionString(el.options)
      const val = el.value === undefined || el.value === null ? undefined : String(el.value)
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="choice"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <Radio.Group
            disabled={ro}
            value={val}
            optionType="button"
            buttonStyle="solid"
            size="small"
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            onChange={(e) => {
              const next = e.target.value
              runCommitWithRexpCheck(el, label, warn, next, () => commit(next))
            }}
          >
            {opts.map((o) => (
              <Radio key={o.value} value={o.value} style={{ width: '100%', margin: 0 }}>
                {o.label}
              </Radio>
            ))}
          </Radio.Group>
        </PropFieldSurface>
      )
    }
    case 7: {
      const raw = el.value
      const checked = raw === true || raw === 'true' || raw === 1 || raw === '1'
      const optLabel = typeof el.options === 'string' ? el.options : ''
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="toggle"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(0,0,0,0.08)',
              background: checked ? 'rgba(22, 119, 255, 0.06)' : '#fff',
              transition: 'background 0.2s ease',
            }}
          >
            <Checkbox
              disabled={ro}
              checked={checked}
              onChange={(e) => {
                if (readElementRequired(el) && !e.target.checked) {
                  warn(`「${label}」为必填项`)
                  return
                }
                commit(e.target.checked)
              }}
            >
              <span style={{ fontWeight: 500 }}>{optLabel || label}</span>
            </Checkbox>
          </div>
        </PropFieldSurface>
      )
    }
    case 8:
    case 9:
    case 10: {
      const v = el.value
      const str = v === undefined || v === null ? '' : String(v)
      const lang: ScriptCodeLanguage = type === 8 ? 'sql' : type === 9 ? 'r' : 'python'
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="code"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <ScriptCodeEditor
            value={str}
            language={lang}
            readOnly={ro}
            rows={readElementTextAreaRows(el, 8)}
            placeholder={placeholder}
            onChange={(next) => {
              const cut =
                maxLen !== undefined && next.length > maxLen ? next.slice(0, maxLen) : next
              runCommitWithRexpCheck(el, label, warn, cut, () => commit(cut))
            }}
          />
        </PropFieldSurface>
      )
    }
    case 0: {
      const v = el.value
      if (tableObj !== null) {
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly
          >
            <FeatureValueTable value={tableObj} readOnly />
          </PropFieldSurface>
        )
      }
      let body = ''
      if (v !== undefined && v !== null) {
        body = typeof v === 'string' ? v : wireElementValueToEditString(v)
      }
      const fromOptions = typeof el.options === 'string' ? el.options.trim() : ''
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="readonly"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly
        >
          <Paragraph
            style={{
              fontSize: 12,
              marginBottom: 0,
              whiteSpace: 'pre-wrap',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.04)',
              border: '1px dashed rgba(0,0,0,0.12)',
            }}
          >
            {body || fromOptions || '（无展示内容）'}
          </Paragraph>
        </PropFieldSurface>
      )
    }
    case 5: {
      if (tableObj !== null) {
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly={ro}
          >
            <FeatureValueTable value={tableObj} readOnly={ro} onChange={commitFeatureObject} />
          </PropFieldSurface>
        )
      }
      const str = wireElementValueToEditString(el.value)
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="code"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <Input.TextArea
            rows={readElementTextAreaRows(el, 4)}
            size="small"
            className="nodrag"
            variant="filled"
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            value={str}
            placeholder={placeholder}
            disabled={ro}
            {...maxLenProps}
            onChange={(e) => {
              const raw = e.target.value
              runCommitWithRexpCheck(el, label, warn, raw, () =>
                commit(parseWireElementCommit(raw)),
              )
            }}
          />
        </PropFieldSurface>
      )
    }
    case 11:
    case 12:
    case 13:
    case 14: {
      const gridRows = readGridRowsFromElement(el)
      if (gridRows !== null) {
        const requiredGrid = readElementRequired(el)
        const commitGrid = (next: Record<string, unknown>[]) => {
          if (requiredGrid && next.length === 0) {
            warn(`「${label}」为必填项，至少保留一行数据`)
            return
          }
          onMergeElement(tabIndex, elIndex, { inputData: next, value: next })
        }
        const columnPickOptions =
          flowContext && nodeId
            ? buildGridColumnPickOptions(
                el,
                flowContext.wire,
                nodeId,
                gridRows,
                flowContext.nodes,
                flowContext.links,
              )
            : undefined
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly={ro}
          >
            <FlowNodeInputDataGrid
              rowKeyPrefix={`${nodeId}-t${tabIndex}-e${elIndex}`}
              rows={gridRows}
              readOnly={ro}
              requireAtLeastOneRow={requiredGrid}
              columnTypes={readGridColumnTypes(el)}
              columnPickOptions={columnPickOptions}
              onChange={commitGrid}
              onColumnTypesChange={(types) =>
                onMergeElement(tabIndex, elIndex, {
                  extra: buildExtraPatchWithGridColumnTypes(el, types),
                })
              }
            />
          </PropFieldSurface>
        )
      }
      if (tableObj !== null) {
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly={ro}
          >
            <FeatureValueTable value={tableObj} readOnly={ro} onChange={commitFeatureObject} />
          </PropFieldSurface>
        )
      }
      const str = wireElementValueToEditString(el.value)
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant="code"
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          <Input.TextArea
            rows={readElementTextAreaRows(el, 8)}
            size="small"
            className="nodrag"
            variant="filled"
            style={{ fontFamily: 'monospace', fontSize: 12 }}
            value={str}
            placeholder={placeholder}
            disabled={ro}
            {...maxLenProps}
            onChange={(e) => {
              const raw = e.target.value
              runCommitWithRexpCheck(el, label, warn, raw, () =>
                commit(parseWireElementCommit(raw)),
              )
            }}
          />
        </PropFieldSurface>
      )
    }
    default: {
      if (tableObj !== null) {
        return (
          <PropFieldSurface
            key={`${nodeId}-${tabIndex}-${elIndex}`}
            variant="grid"
            label={label}
            required={readElementRequired(el)}
            toolTip={el.toolTip}
            description={descText}
            readOnly={ro}
          >
            <FeatureValueTable value={tableObj} readOnly={ro} onChange={commitFeatureObject} />
          </PropFieldSurface>
        )
      }
      const str = wireElementValueToEditString(el.value)
      const multiline = str.includes('\n') || str.length > 80
      return (
        <PropFieldSurface
          key={`${nodeId}-${tabIndex}-${elIndex}`}
          variant={multiline ? 'textarea' : 'text'}
          label={label}
          required={readElementRequired(el)}
          toolTip={el.toolTip}
          description={descText}
          readOnly={ro}
        >
          {multiline ? (
            <Input.TextArea
              rows={readElementTextAreaRows(el, 6)}
              size="small"
              className="nodrag"
              variant="filled"
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              value={str}
              placeholder={placeholder}
              disabled={ro}
              {...maxLenProps}
              onChange={(e) => {
                const raw = e.target.value
                runCommitWithRexpCheck(el, label, warn, raw, () =>
                  commit(parseWireElementCommit(raw)),
                )
              }}
            />
          ) : (
            <Input
              size="small"
              variant="filled"
              value={str}
              placeholder={placeholder}
              disabled={ro}
              {...maxLenProps}
              onChange={(e) => {
                const raw = e.target.value
                runCommitWithRexpCheck(el, label, warn, raw, () =>
                  commit(parseWireElementCommit(raw)),
                )
              }}
            />
          )}
        </PropFieldSurface>
      )
    }
  }
}

export function FlowNodePropsPanel() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const selectedId = useProjectStore((s) => s.selectedWireNodeId)
  const nodes = useProjectStore((s) => s.flowData.nodes)
  const flowLinks = useProjectStore((s) => s.flowData.links)
  const updateFlowNodeWire = useProjectStore((s) => s.updateFlowNodeWire)

  const warn = useCallback((msg: string) => {
    message.warning(msg)
  }, [message])

  const wire = useMemo(() => {
    if (!selectedId) return null
    return (
      nodes.find((n) => {
        try {
          return readWireNodeId(n) === selectedId
        } catch {
          return false
        }
      }) ?? null
    )
  }, [selectedId, nodes])

  const elementFlowContext = useMemo(() => {
    if (!wire) return undefined
    return { wire, nodes, links: flowLinks }
  }, [wire, nodes, flowLinks])

  const onCommit = useCallback(
    (tabIndex: number, elIndex: number, value: unknown) => {
      if (!selectedId) return
      updateFlowNodeWire(selectedId, (w: FlowNodeWire) => setTabElementValue(w, tabIndex, elIndex, value))
    },
    [selectedId, updateFlowNodeWire],
  )

  const onMergeElement = useCallback(
    (tabIndex: number, elIndex: number, patch: Record<string, unknown>) => {
      if (!selectedId) return
      updateFlowNodeWire(selectedId, (w: FlowNodeWire) => setTabElementPatch(w, tabIndex, elIndex, patch))
    },
    [selectedId, updateFlowNodeWire],
  )

  const [fieldFilter, setFieldFilter] = useState('')
  useEffect(() => {
    setFieldFilter('')
  }, [selectedId])

  const fieldFilterNorm = fieldFilter.trim().toLowerCase()

  const tabSpecs = useMemo(() => {
    if (!wire) return []
    const tabsRaw = wire.tabs
    if (!Array.isArray(tabsRaw) || tabsRaw.length === 0) return []
    return tabsRaw.map((tab, tabIndex) => {
      const tr = isRecord(tab) ? tab : null
      const key = `tab-${tabIndex}`
      const tabName = String(tr?.tabName ?? `参数 ${tabIndex + 1}`)
      const elementsRaw = tr?.elements
      const elements: Record<string, unknown>[] = Array.isArray(elementsRaw)
        ? elementsRaw.filter(isRecord)
        : []
      return { key, tabName, tabIndex, elements }
    })
  }, [wire])

  const renderFilteredTabBody = useCallback(
    (tabIndex: number, elements: Record<string, unknown>[]) => {
      const indexed = elements.map((raw, elIndex) => ({ raw, elIndex }))
      const filtered = fieldFilterNorm
        ? indexed.filter(({ raw }) => elementMatchesNameFilter(raw, fieldFilterNorm))
        : indexed
      if (filtered.length === 0) {
        return (
          <div className={styles.tabBody}>
            <Text type="secondary">{t('flowNodePropsPanel.noFieldMatch')}</Text>
          </div>
        )
      }
      return (
        <div className={styles.tabBody}>
          {filtered.map(({ raw, elIndex }) =>
            renderOneElement({
              el: raw,
              tabIndex,
              elIndex,
              nodeId: selectedId ?? '',
              onCommit,
              onMergeElement,
              warn,
              flowContext: elementFlowContext,
            }),
          )}
        </div>
      )
    },
    [elementFlowContext, fieldFilterNorm, onCommit, onMergeElement, selectedId, t, warn],
  )

  const paramFilterBar = (
    <div className={styles.filterRow}>
      <Input
        allowClear
        size="small"
        prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.25)' }} aria-hidden />}
        placeholder={t('flowNodePropsPanel.filterPlaceholder')}
        value={fieldFilter}
        onChange={(e) => setFieldFilter(e.target.value)}
      />
    </div>
  )

  const title = wire && typeof wire.name === 'string' ? wire.name : null
  const descText =
    wire && typeof wire.description === 'string' && wire.description.trim().length > 0
      ? wire.description.trim()
      : null

  const descCollapseItems = useMemo(
    () =>
      descText
        ? [
            {
              key: 'component-desc',
              label: t('flowNodePropsPanel.componentDesc'),
              children: <div className={styles.descText}>{descText}</div>,
            },
          ]
        : [],
    [descText, t],
  )

  return (
    <div className={styles.root}>
      <div className={styles.topBar}>
        <div className={styles.titleRow}>
          <span className={styles.nodeTitle}>
            {title ?? t('flowNodePropsPanel.titleFallback')}
          </span>
        </div>
      </div>

      {!selectedId ? (
        <div className={styles.emptyHint}>{t('flowNodePropsPanel.emptySelectNode')}</div>
      ) : null}

      {selectedId && !wire ? (
        <div className={styles.emptyHint}>
          <Text type="danger">{t('flowNodePropsPanel.emptyWireMissing', { id: selectedId })}</Text>
        </div>
      ) : null}

      {wire ? (
        <div className={styles.bodyScroll}>
          {tabSpecs.length > 0 ? (
            <>
              <div className={styles.sectionLabel}>{t('flowNodePropsPanel.sectionParams')}</div>
              {paramFilterBar}
              {tabSpecs.length > 1 ? (
                <Tabs
                  key={selectedId ?? 'wire'}
                  type="card"
                  size="small"
                  className={styles.paramTabs}
                  defaultActiveKey={tabSpecs[0]?.key ?? 'tab-0'}
                  items={tabSpecs.map((spec) => ({
                    key: spec.key,
                    label: spec.tabName,
                    children: renderFilteredTabBody(spec.tabIndex, spec.elements),
                  }))}
                />
              ) : (
                <div className={styles.singleTabPane}>
                  {renderFilteredTabBody(tabSpecs[0]!.tabIndex, tabSpecs[0]!.elements)}
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyHint}>
              <Text type="secondary">{t('flowNodePropsPanel.emptyNoTabs')}</Text>
            </div>
          )}

          {descCollapseItems.length > 0 ? (
            <div className={styles.descFooter}>
              <Collapse
                key={`desc-${selectedId ?? 'x'}`}
                bordered={false}
                size="small"
                className={styles.descCollapse}
                defaultActiveKey={['component-desc']}
                items={descCollapseItems}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
