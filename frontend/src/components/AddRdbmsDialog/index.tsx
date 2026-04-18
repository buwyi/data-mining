import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Steps, Table, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkDatasourceTableExists,
  createRdbmsDatasource,
  testDatasourceConnection,
} from '../../api/datasourceApi'
import type {
  ConnectionTestResult,
  DatasourceConnectionTestBody,
  RdbmsDatasourceColumnPayload,
} from '../../types/datasource'

const TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,24}$/

export type AddRdbmsDialogProps = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

type ConnFormValues = {
  url: string
  userName: string
  password: string
  sql: string
}

type MetaFormValues = {
  tableName: string
  duration: number
  previewMode: string
}

const defaultConn: Partial<ConnFormValues> = {
  sql: 'SELECT * FROM your_table LIMIT 100',
}

const defaultMeta: Partial<MetaFormValues> = {
  duration: 60,
  previewMode: 'ONLY100',
}

function mapJdbcTypeToTipdm(dataType: string): string {
  const s = dataType.toLowerCase()
  if (/(int|decimal|number|double|float|numeric|bigint|smallint|real|money)/.test(s)) return 'numeric'
  if (s.includes('timestamp') || s.includes('datetime')) return 'timestamp'
  if (s.includes('date') && !s.includes('update')) return 'date'
  return 'text'
}

function buildRdbmsColumnsFromTest(r: ConnectionTestResult): RdbmsDatasourceColumnPayload[] {
  if (r.columns.length > 0) {
    return r.columns.map((c) => ({
      name: c.name,
      dataType: mapJdbcTypeToTipdm(c.dataType),
      comment: '',
      length: 255,
      scale: 0,
      format: '',
    }))
  }
  const row0 = r.data[0]
  if (row0 && typeof row0 === 'object') {
    return Object.keys(row0).map((name) => ({
      name,
      dataType: 'text',
      comment: '',
      length: 255,
      scale: 0,
      format: '',
    }))
  }
  return []
}

export function AddRdbmsDialog({ open, onClose, onSuccess }: AddRdbmsDialogProps) {
  const { message } = App.useApp()
  const [connForm] = Form.useForm<ConnFormValues>()
  const [metaForm] = Form.useForm<MetaFormValues>()
  const [step, setStep] = useState(0)
  const [testLoading, setTestLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [connectionPayload, setConnectionPayload] = useState<DatasourceConnectionTestBody | null>(null)

  const resetWizard = useCallback(() => {
    setStep(0)
    setTestLoading(false)
    setSubmitting(false)
    setTestResult(null)
    setConnectionPayload(null)
    connForm.resetFields()
    metaForm.resetFields()
    connForm.setFieldsValue({ ...defaultConn })
    metaForm.setFieldsValue({ tableName: '', ...defaultMeta })
  }, [connForm, metaForm])

  useEffect(() => {
    if (open) resetWizard()
  }, [open, resetWizard])

  const handleCancel = () => {
    if (testLoading || submitting) return
    resetWizard()
    onClose()
  }

  const onTestConnection = useCallback(async () => {
    try {
      await connForm.validateFields(['url', 'userName', 'password', 'sql'])
    } catch {
      return
    }
    const v = connForm.getFieldsValue()
    const body: DatasourceConnectionTestBody = {
      url: v.url.trim(),
      userName: v.userName.trim(),
      password: v.password,
      sql: v.sql.trim(),
    }
    setTestLoading(true)
    try {
      const result = await testDatasourceConnection(body)
      setTestResult(result)
      setConnectionPayload(body)
      if (result.columns.length === 0 && result.data.length === 0) {
        message.warning('测试成功但未返回列或数据行，请检查 SQL 是否返回结果集')
      } else {
        message.success('连接测试成功')
      }
    } catch (e) {
      setTestResult(null)
      setConnectionPayload(null)
      message.error(e instanceof Error ? e.message : '连接测试失败')
    } finally {
      setTestLoading(false)
    }
  }, [connForm, message])

  const previewColumns = useMemo((): ColumnsType<Record<string, unknown>> => {
    if (!testResult) return []
    const keys =
      testResult.columns.length > 0
        ? testResult.columns.map((c) => c.name)
        : testResult.data[0]
          ? Object.keys(testResult.data[0])
          : []
    return keys.map((k) => ({
      title: k,
      dataIndex: k,
      key: k,
      ellipsis: true,
      width: 140,
      render: (v: unknown) => (v == null ? '' : String(v)),
    }))
  }, [testResult])

  const columnSummary = useMemo(() => {
    if (!testResult) return []
    return buildRdbmsColumnsFromTest(testResult)
  }, [testResult])

  const columnSummaryCols: ColumnsType<RdbmsDatasourceColumnPayload> = useMemo(
    () => [
      { title: '字段名', dataIndex: 'name', key: 'name', ellipsis: true },
      { title: '类型', dataIndex: 'dataType', key: 'dataType', width: 100 },
    ],
    [],
  )

  const goNext = useCallback(() => {
    if (!testResult || !connectionPayload) {
      message.warning('请先完成连接测试')
      return
    }
    if (buildRdbmsColumnsFromTest(testResult).length === 0) {
      message.warning('没有可用的列定义，请调整 SQL 后重新测试')
      return
    }
    setStep(1)
  }, [connectionPayload, message, testResult])

  const onSubmit = useCallback(async () => {
    if (!connectionPayload || !testResult) {
      message.warning('请先完成连接测试')
      return
    }
    try {
      await metaForm.validateFields()
    } catch {
      return
    }
    const meta = metaForm.getFieldsValue()
    const tableName = meta.tableName.trim()
    if (!TABLE_NAME_PATTERN.test(tableName)) {
      message.warning('表名须以小写字母开头，仅含小写字母、数字、下划线，长度不超过 25')
      return
    }
    const columns = buildRdbmsColumnsFromTest(testResult)
    if (columns.length === 0) {
      message.warning('没有可用的列定义')
      return
    }
    setSubmitting(true)
    try {
      const exists = await checkDatasourceTableExists(tableName)
      if (exists) {
        message.error('该表名已存在，请更换')
        return
      }
      await createRdbmsDatasource({
        tableName,
        duration: meta.duration,
        previewMode: meta.previewMode,
        columns,
        connection: connectionPayload,
      })
      message.success('已创建数据库数据源')
      resetWizard()
      onClose()
      onSuccess?.()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败')
    } finally {
      setSubmitting(false)
    }
  }, [connectionPayload, message, metaForm, onClose, onSuccess, resetWizard, testResult])

  return (
    <Modal
      title="新建数据源（数据库）"
      open={open}
      onCancel={handleCancel}
      width={720}
      footer={null}
      destroyOnClose
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 20 }}
        items={[{ title: '连接与预览' }, { title: '表名与提交' }]}
      />

      {step === 0 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            请先测试连接是否可用，再填写目标表信息并提交创建。
          </Typography.Paragraph>
          <Form form={connForm} layout="vertical" initialValues={defaultConn}>
            <Form.Item
              label="JDBC URL"
              name="url"
              rules={[{ required: true, message: '请输入 JDBC URL' }]}
            >
              <Input placeholder="jdbc:mysql://host:3306/dbname" autoComplete="off" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="用户名" name="userName" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input autoComplete="off" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="查询 SQL" name="sql" rules={[{ required: true, message: '请输入 SQL' }]}>
              <Input.TextArea rows={4} placeholder="须返回结果集，用于推断列" />
            </Form.Item>
          </Form>
          <Button type="primary" onClick={() => void onTestConnection()} loading={testLoading}>
            测试连接
          </Button>
          {testResult && (testResult.data.length > 0 || testResult.columns.length > 0) ? (
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              <Table<Record<string, unknown>>
                size="small"
                bordered
                pagination={false}
                scroll={{ x: 'max-content' }}
                columns={previewColumns}
                dataSource={testResult.data}
                rowKey={(_, i) => `r-${String(i)}`}
              />
            </div>
          ) : null}
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Form form={metaForm} layout="vertical" initialValues={defaultMeta}>
            <Form.Item
              label="数据源表名（平台内标识）"
              name="tableName"
              rules={[{ required: true, message: '请输入表名' }]}
              extra="小写字母开头，仅 a-z、0-9、_，与 CSV 数据源规则一致。"
            >
              <Input placeholder="my_query_result" autoComplete="off" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="存储有效期（天）" name="duration">
                  <InputNumber min={1} max={180} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="预览设置" name="previewMode">
                  <Select
                    options={[
                      { value: 'ONLY100', label: '预览前100条' },
                      { value: 'PAGEABLE', label: '分页显示' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            <Table<RdbmsDatasourceColumnPayload>
              size="small"
              bordered
              pagination={false}
              columns={columnSummaryCols}
              dataSource={columnSummary}
              rowKey={(r) => r.name}
            />
          </div>
        </Space>
      )}

      <div
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: 8,
        }}
      >
        <Button onClick={handleCancel} disabled={testLoading || submitting}>
          取消
        </Button>
        {step === 0 && (
          <Button type="primary" onClick={goNext} disabled={testLoading}>
            下一步
          </Button>
        )}
        {step === 1 && (
          <>
            <Button onClick={() => setStep(0)} disabled={submitting}>
              上一步
            </Button>
            <Button type="primary" loading={submitting} onClick={() => void onSubmit()}>
              创建数据源
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
