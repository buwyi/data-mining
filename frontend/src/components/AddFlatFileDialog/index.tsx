import { InboxOutlined } from '@ant-design/icons'
import { App, Button, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Steps, Switch, Table, Upload } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkDatasourceTableExists,
  checkFlatFileExistsByMd5,
  createFlatDatasource,
  uploadFlatCsvFile,
} from '../../api/datasourceApi'
import { useConfigStore } from '../../stores/configStore'
import type { FlatFileColumnDraft } from '../../types/datasource'
import { computeFileMd5Hex } from '../../utils/fileMd5'
import type { CsvDelimiterKey } from '../../utils/parseCsvPreview'
import { parseCsvPreviewSample } from '../../utils/parseCsvPreview'

const TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]{0,24}$/
const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]{0,31}$/

export type AddFlatFileDialogProps = {
  open: boolean
  onClose: () => void
  /** 创建并上传成功后的回调（例如刷新列表） */
  onSuccess?: () => void
}

type WizardFormValues = {
  tableName: string
  delimiter: CsvDelimiterKey
  encoding: string
  duration: number
  previewMode: string
  firstRowAsColumnName: boolean
  dataTypeInference: boolean
}

const defaultFormValues: Partial<WizardFormValues> = {
  delimiter: 'comma',
  encoding: 'UTF-8',
  duration: 60,
  previewMode: 'ONLY100',
  firstRowAsColumnName: true,
  dataTypeInference: true,
}

export function AddFlatFileDialog({ open, onClose, onSuccess }: AddFlatFileDialogProps) {
  const { message } = App.useApp()
  const [form] = Form.useForm<WizardFormValues>()
  const maxFileMb = useConfigStore((s) => s.config?.databaseUploadFileSize ?? 10)

  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [fileMd5, setFileMd5] = useState<string | null>(null)
  const [md5State, setMd5State] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [columnsDraft, setColumnsDraft] = useState<FlatFileColumnDraft[]>([])
  const [previewTitles, setPreviewTitles] = useState<{ name: string; key: string }[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [submitting, setSubmitting] = useState(false)

  const resetWizard = useCallback(() => {
    setStep(0)
    setFile(null)
    setFileMd5(null)
    setMd5State('idle')
    setColumnsDraft([])
    setPreviewTitles([])
    setPreviewRows([])
    setSubmitting(false)
    form.setFieldsValue({ tableName: '', ...defaultFormValues })
  }, [form])

  useEffect(() => {
    if (open) {
      resetWizard()
    }
  }, [open, resetWizard])

  useEffect(() => {
    if (!file) {
      setFileMd5(null)
      setMd5State('idle')
      return
    }
    let cancelled = false
    setMd5State('loading')
    setFileMd5(null)
    void computeFileMd5Hex(file)
      .then((hex) => {
        if (!cancelled) {
          setFileMd5(hex)
          setMd5State('ready')
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMd5State('error')
          message.error('计算文件 MD5 失败')
        }
      })
    return () => {
      cancelled = true
    }
  }, [file, message])

  const handleCancel = () => {
    if (submitting) return
    resetWizard()
    onClose()
  }

  const goPreview = async () => {
    try {
      await form.validateFields()
    } catch {
      return
    }
    if (!file) {
      message.warning('请选择 CSV 文件')
      return
    }
    if (md5State === 'loading') {
      message.warning('正在计算文件校验码，请稍候')
      return
    }
    if (md5State !== 'ready' || !fileMd5) {
      message.warning('文件校验码未就绪，请重新选择文件')
      return
    }

    const v = form.getFieldsValue()
    try {
      const parsed = await parseCsvPreviewSample(
        file,
        v.encoding,
        v.delimiter,
        v.firstRowAsColumnName,
        v.dataTypeInference,
        v.previewMode,
      )
      setColumnsDraft(parsed.dataColumnName)
      setPreviewTitles(parsed.dataListTitle)
      setPreviewRows(parsed.dataList)
      setStep(1)
      message.success('数据结构解析成功')
    } catch (e) {
      message.warning(e instanceof Error ? e.message : '预览解析失败')
    }
  }

  const validateFieldNames = (): boolean => {
    for (const c of columnsDraft) {
      if (!FIELD_NAME_PATTERN.test(c.name.trim())) {
        message.warning(
          `字段名【${c.name}】不合法：须以小写英文字母开头，仅含小写字母、数字、下划线，长度 1–32`,
        )
        return false
      }
    }
    return true
  }

  const submitCreateAndUpload = async () => {
    try {
      await form.validateFields(['tableName'])
    } catch {
      return
    }
    if (!file || !fileMd5) {
      message.warning('请先完成文件选择与解析')
      return
    }
    if (columnsDraft.length < 1) {
      message.warning('请先完成预览与字段设置')
      return
    }
    if (!validateFieldNames()) return

    const v = form.getFieldsValue()
    const tableName = v.tableName.trim()

    setSubmitting(true)
    try {
      const exists = await checkDatasourceTableExists(tableName)
      if (exists) {
        message.warning('数据表名已存在，请修改后重试')
        return
      }

      const uploadId = await createFlatDatasource({
        tableName,
        fileMD5: fileMd5,
        duration: v.duration,
        previewMode: v.previewMode,
        columns: columnsDraft.map((c) => ({
          name: c.name.trim(),
          dataType: c.dataType,
          comment: c.comment ?? '',
          formatter: c.format ?? '',
          length: c.length,
          scale: c.scale,
        })),
      })

      const alreadyThere = await checkFlatFileExistsByMd5(uploadId, fileMd5)
      if (alreadyThere) {
        message.success('添加成功')
        onSuccess?.()
        handleCancel()
        return
      }

      await uploadFlatCsvFile({
        uploadId,
        file,
        delimiter: v.delimiter,
        encoding: v.encoding,
      })
      message.success('文件上传成功')
      onSuccess?.()
      handleCancel()
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败')
    } finally {
      setSubmitting(false)
    }
  }

  const previewTableColumns: ColumnsType<Record<string, string>> = useMemo(
    () =>
      previewTitles.map((t) => ({
        title: t.name,
        dataIndex: t.key,
        key: t.key,
        ellipsis: true,
        width: 150,
      })),
    [previewTitles],
  )

  const patchColumn = useCallback((index: number, patch: Partial<FlatFileColumnDraft>) => {
    setColumnsDraft((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }, [])

  const fieldColumns: ColumnsType<FlatFileColumnDraft> = useMemo(
    () => [
      {
        title: '原字段',
        key: 'oldName',
        width: 120,
        render: (_, row) => <Input size="small" disabled value={row.oldName} />,
      },
      {
        title: '字段名',
        key: 'name',
        width: 140,
        render: (_, row, index) => (
          <Input
            size="small"
            maxLength={30}
            value={row.name}
            onChange={(e) => patchColumn(index, { name: e.target.value })}
          />
        ),
      },
      {
        title: '类型',
        key: 'dataType',
        width: 120,
        render: (_, row, index) => (
          <Select
            size="small"
            style={{ width: '100%' }}
            value={row.dataType}
            options={[
              { value: 'numeric', label: '数值' },
              { value: 'text', label: '字符' },
              { value: 'date', label: '日期' },
              { value: 'timestamp', label: '时间' },
            ]}
            onChange={(val) => patchColumn(index, { dataType: val as FlatFileColumnDraft['dataType'] })}
          />
        ),
      },
      {
        title: '长度',
        key: 'length',
        width: 100,
        render: (_, row, index) => (
          <InputNumber
            size="small"
            min={1}
            max={255}
            style={{ width: '100%' }}
            value={row.length}
            onChange={(n) => patchColumn(index, { length: n ?? 255 })}
          />
        ),
      },
      {
        title: '精度',
        key: 'scale',
        width: 100,
        render: (_, row, index) => (
          <InputNumber
            size="small"
            min={0}
            max={10}
            style={{ width: '100%' }}
            value={row.scale}
            onChange={(n) => patchColumn(index, { scale: n ?? 0 })}
          />
        ),
      },
      {
        title: '备注',
        key: 'comment',
        render: (_, row, index) => (
          <Input size="small" maxLength={30} value={row.comment} onChange={(e) => patchColumn(index, { comment: e.target.value })} />
        ),
      },
    ],
    [patchColumn],
  )

  const beforeUpload = (f: File) => {
    const maxBytes = maxFileMb * 1024 * 1024
    if (f.size > maxBytes) {
      message.warning(`文件大小超出限制，不能超过 ${maxFileMb}MB`)
      return Upload.LIST_IGNORE
    }
    const lower = f.name.toLowerCase()
    if (!lower.endsWith('.csv')) {
      message.warning('仅支持 CSV 文件')
      return Upload.LIST_IGNORE
    }
    setFile(f)
    return false
  }

  const stepItems = [{ title: '文件属性' }, { title: '预览数据' }, { title: '字段设置' }]

  return (
    <Modal
      title="新建数据源"
      open={open}
      onCancel={handleCancel}
      width="min(960px, 92vw)"
      footer={null}
      destroyOnHidden
      maskClosable={!submitting}
    >
      <Steps size="small" current={step} items={stepItems} style={{ marginBottom: 16 }} />

      {step === 0 && (
        <div style={{ maxHeight: 'min(420px, 55vh)', overflow: 'auto', paddingRight: 4 }}>
          <Form form={form} layout="vertical" initialValues={defaultFormValues}>
            <Form.Item label="上传文件">
              <Upload.Dragger accept=".csv" maxCount={1} showUploadList={!!file} beforeUpload={beforeUpload} onRemove={() => setFile(null)}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽 CSV 到此区域</p>
                <p className="ant-upload-hint">单文件，不超过 {maxFileMb}MB；选择后将自动计算 MD5</p>
              </Upload.Dragger>
              {file && (
                <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(0,0,0,0.45)' }}>
                  已选：{file.name}
                  {md5State === 'loading' && ' · 正在计算 MD5…'}
                  {md5State === 'ready' && ' · MD5 已就绪'}
                  {md5State === 'error' && ' · MD5 计算失败'}
                </div>
              )}
            </Form.Item>

            <Form.Item
              label="新建目标表名"
              name="tableName"
              rules={[
                { required: true, message: '请输入表名' },
                {
                  pattern: TABLE_NAME_PATTERN,
                  message: '小写英文字母开头，仅小写字母、数字、下划线，长度 1–25',
                },
              ]}
            >
              <Input placeholder="同步到平台中的表名" allowClear />
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item label="列分隔符" name="delimiter">
                  <Select
                    options={[
                      { value: 'comma', label: '逗号（,）' },
                      { value: 'semicolon', label: '分号（;）' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="文件编码" name="encoding">
                  <Select
                    options={[
                      { value: 'UTF-8', label: 'UTF-8' },
                      { value: 'GBK', label: 'GBK' },
                      { value: 'GB2312', label: 'GB2312' },
                      { value: 'ASCII', label: 'ASCII' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="存储有效期（天）" name="duration">
                  <InputNumber min={1} max={180} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
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

            <Form.Item label="首行作为列名" name="firstRowAsColumnName" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
            <Form.Item label="首行数据类型识别" name="dataTypeInference" valuePropName="checked">
              <Switch checkedChildren="开启" unCheckedChildren="关闭" />
            </Form.Item>
          </Form>
        </div>
      )}

      {step === 1 && (
        <div style={{ maxHeight: 'min(360px, 50vh)', overflow: 'auto' }}>
          <Table<Record<string, string>>
            size="small"
            bordered
            pagination={false}
            scroll={{ x: 'max-content', y: 280 }}
            columns={previewTableColumns}
            dataSource={previewRows}
            rowKey={(_, index) => `preview-${String(index)}`}
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <p style={{ marginBottom: 8, color: '#ff4d4f' }}>注意：字段名须以小写字母开头，仅含小写字母、数字、下划线。</p>
          <div style={{ maxHeight: 'min(360px, 50vh)', overflow: 'auto' }}>
            <Table<FlatFileColumnDraft>
              size="small"
              bordered
              pagination={false}
              scroll={{ x: 'max-content', y: 260 }}
              columns={fieldColumns}
              dataSource={columnsDraft}
              rowKey={(_, index) => `col-${String(index)}`}
            />
          </div>
        </div>
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
        <Space wrap>
          {step === 0 && (
            <Button
              onClick={() => {
                resetWizard()
                message.info('已重置')
              }}
            >
              重置
            </Button>
          )}
          {step > 0 && (
            <Button disabled={submitting} onClick={() => setStep((s) => s - 1)}>
              上一步
            </Button>
          )}
          <Button onClick={handleCancel} disabled={submitting}>
            取消
          </Button>
          {step === 0 && (
            <Button type="primary" onClick={() => void goPreview()} disabled={submitting}>
              下一步
            </Button>
          )}
          {step === 1 && (
            <Button type="primary" onClick={() => setStep(2)} disabled={submitting}>
              下一步
            </Button>
          )}
          {step === 2 && (
            <Button type="primary" loading={submitting} onClick={() => void submitCreateAndUpload()}>
              确定
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  )
}
