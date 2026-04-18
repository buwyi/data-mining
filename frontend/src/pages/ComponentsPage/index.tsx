import { Alert, Button, Card, Col, Row, Space, Spin, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAlgorithmList, fetchWidgetList } from '../../api/componentApi'
import {
  ComponentLibraryTree,
  type ComponentLibraryTreeHandle,
  type ComponentWorkbenchSelection,
} from '../../components/ComponentLibraryTree'
import { useI18n } from '../../i18n/I18nProvider'
import { useComponentTreeRootIds } from '../../hooks/useComponentTreeRootIds'
import {
  ALGORITHM_LIST_TABLE_PREFERRED_KEYS,
  pickTableDisplayKeys,
  WIDGET_LIST_TABLE_PREFERRED_KEYS,
} from '../../utils/tableDisplayKeys'

const { Paragraph, Text, Title } = Typography

const WIDGET_TABLE_MAX_COLS = 12
const ALGORITHM_TABLE_MAX_COLS = 10

function buildColumns(keys: string[]): ColumnsType<Record<string, unknown>> {
  return keys.map((k) => ({
    title: k,
    dataIndex: k,
    key: k,
    width:
      k === 'id' || k === 'elementType' || k === 'widgetId'
        ? 88
        : k === 'codeName' || k === 'code'
          ? 140
          : k === 'description' || k === 'value'
            ? 220
            : undefined,
    ellipsis: k !== 'description' && k !== 'value',
    render: (v: unknown) => {
      if (v === null || v === undefined) return '—'
      if (typeof v === 'object') {
        try {
          return JSON.stringify(v)
        } catch {
          return String(v)
        }
      }
      return String(v)
    },
  }))
}

function widgetRowKey(record: Record<string, unknown>, index?: number): string {
  const id = record.id
  if (typeof id === 'number' && Number.isFinite(id)) return `w-${id}`
  if (typeof id === 'string' && /^\d+$/.test(id)) return `w-${id}`
  return `w-${index ?? 0}`
}

export function ComponentsPage() {
  const { t } = useI18n()
  const { systemRootCatId, personalRootCatId } = useComponentTreeRootIds()
  const treeRef = useRef<ComponentLibraryTreeHandle>(null)
  const [workbenchSelection, setWorkbenchSelection] = useState<ComponentWorkbenchSelection>(null)
  const onWorkbenchSelectionChange = useCallback((s: ComponentWorkbenchSelection) => {
    setWorkbenchSelection(s)
  }, [])
  const [widgets, setWidgets] = useState<Record<string, unknown>[]>([])
  const [algorithms, setAlgorithms] = useState<Record<string, unknown>[]>([])
  const [widgetLoading, setWidgetLoading] = useState(true)
  const [algorithmLoading, setAlgorithmLoading] = useState(true)
  const [widgetError, setWidgetError] = useState<string | null>(null)
  const [algorithmError, setAlgorithmError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setWidgetLoading(true)
    setWidgetError(null)
    void fetchWidgetList()
      .then((rows) => {
        if (!cancelled) setWidgets(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setWidgetError(e instanceof Error ? e.message : t('datasourcePage.msg.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setWidgetLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  useEffect(() => {
    let cancelled = false
    setAlgorithmLoading(true)
    setAlgorithmError(null)
    void fetchAlgorithmList()
      .then((rows) => {
        if (!cancelled) setAlgorithms(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setAlgorithmError(e instanceof Error ? e.message : t('datasourcePage.msg.loadFailed'))
      })
      .finally(() => {
        if (!cancelled) setAlgorithmLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  const widgetColumns = useMemo(
    () =>
      buildColumns(
        pickTableDisplayKeys(widgets, WIDGET_LIST_TABLE_PREFERRED_KEYS, WIDGET_TABLE_MAX_COLS),
      ),
    [widgets],
  )
  const algorithmColumns = useMemo(
    () =>
      buildColumns(
        pickTableDisplayKeys(
          algorithms,
          ALGORITHM_LIST_TABLE_PREFERRED_KEYS,
          ALGORITHM_TABLE_MAX_COLS,
        ),
      ),
    [algorithms],
  )

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={10} xl={8}>
        <ComponentLibraryTree
          ref={treeRef}
          systemRootCatId={systemRootCatId}
          personalRootCatId={personalRootCatId}
          onWorkbenchSelectionChange={onWorkbenchSelectionChange}
        />
      </Col>
      <Col xs={24} lg={14} xl={16}>
        <Card bordered={false} size="small" title={t('shell.workbench')}>
          {workbenchSelection?.kind === 'comp' ? (
            <>
              <Paragraph style={{ marginBottom: 12 }}>
                <Text strong>{workbenchSelection.title}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {t('componentsPage.comp.idLabel', { id: workbenchSelection.componentId })}
                </Text>
              </Paragraph>
              <Space wrap>
                <Button
                  type="primary"
                  onClick={() => void treeRef.current?.openDetail(workbenchSelection.componentId)}
                >
                  {t('componentsPage.btn.detail')}
                </Button>
                <Button onClick={() => treeRef.current?.openScript(workbenchSelection.componentId)}>
                  {t('componentsPage.btn.scriptMain')}
                </Button>
              </Space>
            </>
          ) : workbenchSelection?.kind === 'cat' ? (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('componentsPage.hint.cat', { title: workbenchSelection.title })}
            </Paragraph>
          ) : (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('componentsPage.hint.pickComp')}
            </Paragraph>
          )}
        </Card>

        <Card bordered={false} size="small" title={t('componentsPage.card.helpTitle')} style={{ marginTop: 16 }}>
          <Title level={5} style={{ marginTop: 0 }}>
            {t('componentsPage.doc.sectionTitle')}
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 8 }}>
            {t('componentsPage.doc.line1a')}
            <Text code>{'GET /api/cat/{catId}/childs'}</Text>
            {t('componentsPage.doc.line1b')}
            <Text code>public/config.json</Text>
            {t('componentsPage.doc.line1c')}
            <Text code>componentSystemCatId</Text>
            {t('componentsPage.doc.line1d')}
            <Text code>componentPersonalCatId</Text>
            {t('componentsPage.doc.line1e')}
            <Text code>VITE_COMPONENT_SYSTEM_CAT_ID</Text>
            {t('componentsPage.doc.line1f')}
            <Text code>VITE_COMPONENT_PERSONAL_CAT_ID</Text>
            {t('componentsPage.doc.line1g')}
          </Paragraph>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('componentsPage.doc.p2a')}
            <strong>{t('shell.workbench')}</strong>
            {t('componentsPage.doc.p2b')}
            <strong>{t('componentsPage.btn.detail')}</strong>
            {t('componentsPage.doc.p2c')}
            <Text code>id</Text>
            {t('componentsPage.doc.p2d')}
            <Text code>{'DELETE /api/element/{id}'}</Text>
            {t('componentsPage.doc.p2e')}
            <Text code>GET /api/widget/list</Text>
            {t('componentsPage.doc.p2f')}
            <Text code>GET /api/algorithm/list</Text>
            {t('componentsPage.doc.p2g')}
          </Paragraph>
        </Card>

        <Card bordered={false} size="small" title={t('componentsPage.card.widgets')} style={{ marginTop: 16 }}>
          {widgetError ? <Alert type="error" message={widgetError} showIcon /> : null}
          <Spin spinning={widgetLoading}>
            <Table
              size="small"
              rowKey={widgetRowKey}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              scroll={{ x: 'max-content' }}
              columns={widgetColumns}
              dataSource={widgets}
              locale={{
                emptyText: widgetLoading ? t('componentsPage.table.loading') : t('componentsPage.table.empty'),
              }}
            />
          </Spin>
        </Card>

        <Card bordered={false} size="small" title={t('componentsPage.card.algorithms')} style={{ marginTop: 16 }}>
          {algorithmError ? <Alert type="error" message={algorithmError} showIcon /> : null}
          <Spin spinning={algorithmLoading}>
            <Table
              size="small"
              rowKey={(_, i) => `a-${i}`}
              pagination={{ pageSize: 8, showSizeChanger: true }}
              scroll={{ x: 'max-content' }}
              columns={algorithmColumns}
              dataSource={algorithms}
              locale={{
                emptyText: algorithmLoading
                  ? t('componentsPage.table.loading')
                  : t('componentsPage.table.empty'),
              }}
            />
          </Spin>
    </Card>
      </Col>
    </Row>
  )
}
