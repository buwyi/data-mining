import { CloudServerOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { App, AutoComplete, Button, Card, Input, Popconfirm, Space, Table, Tabs, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteDatasource,
  fetchDatasourceTableNameFilter,
  fetchSharedDatasources,
  searchDatasources,
  syncDatasourceTable,
} from '../../api/datasourceApi'
import { AddFlatFileDialog } from '../../components/AddFlatFileDialog'
import { AddRdbmsDialog } from '../../components/AddRdbmsDialog'
import { DatasourceConnectionModal } from '../../components/DatasourceConnectionModal'
import { DatasourcePreviewModal } from '../../components/DatasourcePreviewModal'
import { DatasourceShareModal } from '../../components/DatasourceShareModal'
import { DatasourceStructureModal } from '../../components/DatasourceStructureModal'
import {
  inferDatasourceOriginKind,
  pickDatasourceDeleteId,
  pickDatasourceRowLabel,
  pickDatasourceSyncStatusText,
  pickDatasourceSyncTableName,
  pickDatasourceTimeRaw,
  type DatasourceListRow,
} from '../../types/datasource'
import { useI18n } from '../../i18n/I18nProvider'
import {
  applyDatasourceRowsDemoThisMonthTimes,
  formatDatasourceTimeForList,
} from '../../utils/datasourceListTimeFormat'
import { syncStatusTagColor } from '../../utils/datasourceSyncStatusUi'

const { Title, Paragraph } = Typography

type ListTab = 'mine' | 'shared'

export function DataSourcePage() {
  const { t, locale } = useI18n()
  const { message } = App.useApp()
  const [flatOpen, setFlatOpen] = useState(false)
  const [rdbmsOpen, setRdbmsOpen] = useState(false)
  const [tab, setTab] = useState<ListTab>('mine')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<DatasourceListRow[]>([])
  const [total, setTotal] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewTableId, setPreviewTableId] = useState<string | null>(null)
  const [previewLabel, setPreviewLabel] = useState('')
  const [connOpen, setConnOpen] = useState(false)
  const [connTableId, setConnTableId] = useState<string | null>(null)
  const [connLabel, setConnLabel] = useState('')
  const [syncingRowKey, setSyncingRowKey] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareDataSourceId, setShareDataSourceId] = useState<string | null>(null)
  const [shareLabel, setShareLabel] = useState('')
  const [structureOpen, setStructureOpen] = useState(false)
  const [structureTableName, setStructureTableName] = useState<string | null>(null)
  const [structureLabel, setStructureLabel] = useState('')
  const [filterSuggest, setFilterSuggest] = useState<{ value: string }[]>([])
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const params = { pageNumber, pageSize, keyword: keyword.trim() || undefined }
      const page =
        tab === 'mine' ? await searchDatasources(params) : await fetchSharedDatasources(params)
      setRows(applyDatasourceRowsDemoThisMonthTimes(page.rows))
      setTotal(page.total)
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('datasourcePage.msg.loadFailed'))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [keyword, message, pageNumber, pageSize, t, tab])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(
    () => () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
    },
    [],
  )

  const runTableNameFilterSuggest = useCallback((prefix: string) => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current)
    const t = prefix.trim()
    if (!t) {
      setFilterSuggest([])
      return
    }
    filterDebounceRef.current = setTimeout(() => {
      void fetchDatasourceTableNameFilter({ prefix: t, limit: 20 })
        .then((names) => setFilterSuggest(names.map((v) => ({ value: v }))))
        .catch(() => setFilterSuggest([]))
    }, 350)
  }, [])

  const onSearch = useCallback(() => {
    setPageNumber(1)
    setKeyword(keywordInput.trim())
  }, [keywordInput])

  const refreshAfterMutation = useCallback(() => {
    void loadList()
  }, [loadList])

  const onSyncRow = useCallback(
    async (row: DatasourceListRow, rowKey: string) => {
      const name = pickDatasourceSyncTableName(row) ?? pickDatasourceDeleteId(row)
      if (!name) {
        message.warning(t('datasourcePage.msg.syncTableParseFail'))
        return
      }
      const label = pickDatasourceRowLabel(row)
      const msgKey = `datasource-sync-${rowKey}`
      setSyncingRowKey(rowKey)
      message.open({
        key: msgKey,
        type: 'loading',
        content: t('datasourcePage.msg.syncing', { label }),
        duration: 0,
      })
      try {
        const { detail } = await syncDatasourceTable(name)
        message.destroy(msgKey)
        message.success(detail ?? t('datasourcePage.msg.syncSubmitted'))
        await loadList()
      } catch (e) {
        message.destroy(msgKey)
        message.error(e instanceof Error ? e.message : t('datasourcePage.msg.syncFailed'))
      } finally {
        setSyncingRowKey(null)
      }
    },
    [loadList, message, t],
  )

  const onDelete = useCallback(
    async (row: DatasourceListRow) => {
      const id = pickDatasourceDeleteId(row)
      if (!id) {
        message.warning(t('datasourcePage.msg.deleteIdParseFail'))
        return
      }
      setDeletingId(id)
      try {
        await deleteDatasource(id)
        message.success(t('datasourcePage.msg.deleted'))
        await loadList()
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('datasourcePage.msg.deleteFailed'))
      } finally {
        setDeletingId(null)
      }
    },
    [loadList, message, t],
  )

  const showSyncStatusCol = useMemo(
    () => rows.some((r) => pickDatasourceSyncStatusText(r) != null),
    [rows],
  )

  const columns: ColumnsType<DatasourceListRow> = useMemo(() => {
    const cols: ColumnsType<DatasourceListRow> = [
      {
        title: t('datasourcePage.col.label'),
        key: 'label',
        width: 128,
        ellipsis: true,
        render: (_: unknown, row) => pickDatasourceRowLabel(row),
      },
      {
        title: t('datasourcePage.col.type'),
        key: 'type',
        width: 104,
        ellipsis: true,
        render: (_: unknown, row) =>
          t(
            inferDatasourceOriginKind(row) === 'file'
              ? 'datasourcePage.type.file'
              : 'datasourcePage.type.database',
          ),
      },
    ]
    if (showSyncStatusCol) {
      cols.push({
        title: t('datasourcePage.col.syncStatus'),
        key: 'syncStatus',
        width: 130,
        ellipsis: true,
        render: (_: unknown, row) => {
          const statusText = pickDatasourceSyncStatusText(row)
          return statusText ? (
            <Tag color={syncStatusTagColor(statusText)}>{statusText}</Tag>
          ) : (
            '—'
          )
        },
      })
    }
    cols.push(
      {
        title: t('datasourcePage.col.time'),
        key: 'time',
        width: 256,
        ellipsis: true,
        render: (_: unknown, row) => {
          const raw = pickDatasourceTimeRaw(row)
          if (raw === '') return '—'
          return formatDatasourceTimeForList(raw, t, locale)
        },
      },
      {
        title: t('datasourcePage.col.actions'),
        key: 'actions',
        width: 400,
        fixed: 'right',
        render: (_: unknown, row, index) => {
          const pathId = pickDatasourceDeleteId(row)
          const rowKey = pathId ?? `ds-row-${String(index)}`
          const delBusy = pathId != null && deletingId === pathId
          const syncBusy = syncingRowKey === rowKey
          const label = pickDatasourceRowLabel(row)
          const logicalTable = pickDatasourceSyncTableName(row) ?? pathId
          return (
            <Space size={0} wrap>
              <Button
                type="link"
                size="small"
                disabled={!pathId}
                onClick={() => {
                  if (!pathId) return
                  setPreviewTableId(pathId)
                  setPreviewLabel(label)
                  setPreviewOpen(true)
                }}
              >
                {t('datasourcePage.action.preview')}
              </Button>
              <Button
                type="link"
                size="small"
                disabled={!pathId}
                onClick={() => {
                  if (!pathId) return
                  setConnTableId(pathId)
                  setConnLabel(label)
                  setConnOpen(true)
                }}
              >
                {t('datasourcePage.action.connect')}
              </Button>
              <Button
                type="link"
                size="small"
                disabled={!(pickDatasourceSyncTableName(row) ?? pathId)}
                loading={syncBusy}
                onClick={() => void onSyncRow(row, rowKey)}
              >
                {t('datasourcePage.action.sync')}
              </Button>
              <Button
                type="link"
                size="small"
                disabled={tab !== 'mine' || !pathId}
                onClick={() => {
                  if (!pathId) return
                  setShareDataSourceId(pathId)
                  setShareLabel(label)
                  setShareOpen(true)
                }}
              >
                {t('datasourcePage.action.share')}
              </Button>
              <Button
                type="link"
                size="small"
                disabled={!logicalTable}
                onClick={() => {
                  if (!logicalTable) return
                  setStructureTableName(logicalTable)
                  setStructureLabel(label)
                  setStructureOpen(true)
                }}
              >
                {t('datasourcePage.action.structure')}
              </Button>
              <Popconfirm
                title={t('datasourcePage.deleteConfirm.title')}
                description={t('datasourcePage.deleteConfirm.desc')}
                okText={t('datasourcePage.popconfirm.okDelete')}
                okType="danger"
                disabled={tab === 'shared' || !pathId}
                onConfirm={() => void onDelete(row)}
              >
                <Button type="link" size="small" danger disabled={tab === 'shared' || !pathId} loading={delBusy}>
                  {t('datasourcePage.action.delete')}
                </Button>
              </Popconfirm>
            </Space>
          )
        },
      },
    )
    return cols
  }, [deletingId, locale, onDelete, onSyncRow, showSyncStatusCol, syncingRowKey, t, tab])

  return (
    <Card bordered={false}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }} wrap>
          <Title level={4} style={{ margin: 0 }}>
            {t('menu.datasource')}
          </Title>
          <Space wrap>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setFlatOpen(true)}>
              {t('datasourcePage.btnNewCsv')}
            </Button>
            <Button icon={<CloudServerOutlined />} onClick={() => setRdbmsOpen(true)}>
              {t('datasourcePage.btnNewDb')}
            </Button>
          </Space>
        </Space>

        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('datasourcePage.listIntro')}
        </Paragraph>

        <Tabs
          activeKey={tab}
          onChange={(k) => {
            setTab(k as ListTab)
            setPageNumber(1)
          }}
          items={[
            { key: 'mine', label: t('datasourcePage.tab.mine') },
            { key: 'shared', label: t('datasourcePage.tab.shared') },
          ]}
        />

        <Space wrap style={{ width: '100%' }} align="start">
          <Input
            allowClear
            placeholder={t('datasourcePage.keywordPlaceholder')}
            style={{ width: 240 }}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onPressEnter={() => onSearch()}
          />
          <AutoComplete
            style={{ width: 220 }}
            options={filterSuggest}
            placeholder={t('datasourcePage.filterPlaceholder')}
            allowClear
            onSearch={runTableNameFilterSuggest}
            onSelect={(v) => setKeywordInput(String(v))}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={() => onSearch()}>
            {t('datasourcePage.search')}
          </Button>
          <Button onClick={() => void loadList()} loading={loading}>
            {t('datasourcePage.refresh')}
          </Button>
        </Space>

        <Table<DatasourceListRow>
          size="small"
          rowKey={(row, index) => pickDatasourceDeleteId(row) ?? `ds-${index}`}
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: showSyncStatusCol ? 1120 : 1000 }}
          pagination={{
            current: pageNumber,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (totalCount) => t('mainPage.paginationTotal', { total: totalCount }),
            onChange: (p, ps) => {
              setPageNumber(p)
              setPageSize(ps ?? 10)
            },
          }}
        />
      </Space>

      <AddFlatFileDialog
        open={flatOpen}
        onClose={() => setFlatOpen(false)}
        onSuccess={() => {
          setTab('mine')
          setPageNumber(1)
          void refreshAfterMutation()
        }}
      />
      <AddRdbmsDialog
        open={rdbmsOpen}
        onClose={() => setRdbmsOpen(false)}
        onSuccess={() => {
          setTab('mine')
          setPageNumber(1)
          void refreshAfterMutation()
        }}
      />
      <DatasourcePreviewModal
        open={previewOpen}
        tableId={previewTableId}
        titleLabel={previewLabel}
        onClose={() => {
          setPreviewOpen(false)
          setPreviewTableId(null)
        }}
      />
      <DatasourceConnectionModal
        open={connOpen}
        tableId={connTableId}
        titleLabel={connLabel}
        onClose={() => {
          setConnOpen(false)
          setConnTableId(null)
        }}
      />
      <DatasourceShareModal
        open={shareOpen}
        dataSourceId={shareDataSourceId}
        titleLabel={shareLabel}
        onClose={() => {
          setShareOpen(false)
          setShareDataSourceId(null)
        }}
        onSuccess={() => void refreshAfterMutation()}
      />
      <DatasourceStructureModal
        open={structureOpen}
        tableName={structureTableName}
        titleLabel={structureLabel}
        onClose={() => {
          setStructureOpen(false)
          setStructureTableName(null)
        }}
      />
    </Card>
  )
}
