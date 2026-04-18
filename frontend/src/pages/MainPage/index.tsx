import {
  ApartmentOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Carousel,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Space,
  Typography,
} from 'antd'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchBannerBbs,
  fetchBannerDocumentation,
  isProbableBannerImageUrl,
} from '../../api/bannerApi'
import { cloneProjectFromDocument } from '../../api/projectApi'
import { deleteTemplate, fetchTemplateList } from '../../api/templateApi'
import {
  pickCloneParentDocumentId,
  pickTemplateDescription,
  pickTemplateId,
  pickTemplateName,
  pickTemplateSourceProjectId,
  type TemplateListRow,
} from '../../types/template'
import { useI18n } from '../../i18n/I18nProvider'

const { Title, Paragraph, Text } = Typography

function openExternal(url: string) {
  try {
    const u = new URL(url, window.location.origin)
    if (u.origin === window.location.origin) {
      window.location.href = u.href
      return
    }
  } catch {
    /* fall through */
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function BannerCarouselSlide({ title, url }: { title: string; url: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  const tryImage = isProbableBannerImageUrl(url) && !imgFailed

  const inner: ReactNode = tryImage ? (
    <div
      role="link"
      tabIndex={0}
      onClick={() => openExternal(url)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          openExternal(url)
        }
      }}
      style={{
        position: 'relative',
        minHeight: 140,
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setImgFailed(true)}
        style={{
          width: '100%',
          height: 140,
          objectFit: 'cover',
          display: 'block',
          verticalAlign: 'top',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '20px 16px 12px',
          background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.72))',
        }}
      >
        <Text strong style={{ color: '#fff', fontSize: 15, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
          {title}
        </Text>
      </div>
    </div>
  ) : (
    <div
      style={{
        minHeight: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ant-color-fill-quaternary)',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <Button type="link" size="large" onClick={() => openExternal(url)}>
        {title}
      </Button>
    </div>
  )

  return <div>{inner}</div>
}

export function MainPage() {
  const { t } = useI18n()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [createForm] = Form.useForm<{ newName: string }>()
  const [createFromTplOpen, setCreateFromTplOpen] = useState(false)
  const [createFromTplRow, setCreateFromTplRow] = useState<TemplateListRow | null>(null)
  const [creatingFromTpl, setCreatingFromTpl] = useState(false)
  const [bbsLinks, setBbsLinks] = useState<Record<string, string>>({})
  const [docLinks, setDocLinks] = useState<Record<string, string>>({})
  const [bannerLoading, setBannerLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateListRow[]>([])
  const [total, setTotal] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [listLoading, setListLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setBannerLoading(true)
    void Promise.all([fetchBannerBbs().catch(() => ({})), fetchBannerDocumentation().catch(() => ({}))])
      .then(([bbs, doc]) => {
        if (cancelled) return
        setBbsLinks(bbs)
        setDocLinks(doc)
      })
      .catch(() => {
        if (!cancelled) {
          setBbsLinks({})
          setDocLinks({})
        }
      })
      .finally(() => {
        if (!cancelled) setBannerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    setListLoading(true)
    try {
      const { rows, total: t } = await fetchTemplateList(pageNumber, pageSize)
      setTemplates(rows as TemplateListRow[])
      setTotal(t)
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('mainPage.msg.loadFailed'))
      setTemplates([])
      setTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [message, pageNumber, pageSize, t])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const onDeleteTemplate = useCallback(
    async (row: TemplateListRow) => {
      const id = pickTemplateId(row)
      if (!id) {
        message.warning(t('mainPage.msg.pickIdFail'))
        return
      }
      setDeletingId(id)
      try {
        await deleteTemplate(id)
        message.success(t('mainPage.msg.deleted'))
        await loadTemplates()
      } catch (e) {
        message.error(e instanceof Error ? e.message : t('mainPage.msg.deleteFailed'))
      } finally {
        setDeletingId(null)
      }
    },
    [loadTemplates, message, t],
  )

  const openCreateFromTemplate = useCallback(
    (row: TemplateListRow) => {
      const sourcePid = pickTemplateSourceProjectId(row)
      if (sourcePid == null) {
        message.warning(t('mainPage.msg.noSourceProject'))
        return
      }
      setCreateFromTplRow(row)
      createForm.setFieldsValue({ newName: `${pickTemplateName(row)}${t('mainPage.copySuffix')}` })
      setCreateFromTplOpen(true)
    },
    [createForm, message, t],
  )

  const submitCreateFromTemplate = useCallback(async () => {
    if (!createFromTplRow) return
    const sourcePid = pickTemplateSourceProjectId(createFromTplRow)
    if (sourcePid == null) {
      message.warning(t('mainPage.msg.noSourceProject'))
      return
    }
    try {
      const { newName } = await createForm.validateFields()
      setCreatingFromTpl(true)
      const parentDocId = pickCloneParentDocumentId(createFromTplRow)
      const newId = await cloneProjectFromDocument(sourcePid, parentDocId, newName)
      message.success(t('mainPage.msg.created'))
      setCreateFromTplOpen(false)
      setCreateFromTplRow(null)
      createForm.resetFields()
      if (newId != null) {
        void navigate(`/home/project/${newId}`)
      } else {
        void navigate('/home/project')
      }
    } catch (e) {
      if (e && typeof e === 'object' && 'errorFields' in e) return
      message.error(e instanceof Error ? e.message : t('mainPage.msg.createFailed'))
    } finally {
      setCreatingFromTpl(false)
    }
  }, [createForm, createFromTplRow, message, navigate, t])

  const bbsEntries = Object.entries(bbsLinks)
  const docEntries = Object.entries(docLinks)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginTop: 0 }}>
          {t('breadcrumb.main')}
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('mainPage.quickHint')}
        </Paragraph>
        <Space wrap>
          <Link to="/home/project">
            <Button type="primary" icon={<ApartmentOutlined />}>
              {t('menu.project')}
            </Button>
          </Link>
          <Link to="/home/datasource">
            <Button icon={<DatabaseOutlined />}>{t('menu.datasource')}</Button>
          </Link>
        </Space>
      </div>

      <Card size="small" title={t('mainPage.bannerCardTitle')} loading={bannerLoading}>
        {bbsEntries.length === 0 && docEntries.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('mainPage.bannerEmpty')} />
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {bbsEntries.length > 0 && (
              <div>
                <Text strong>
                  <TeamOutlined /> {t('mainPage.community')}
                </Text>
                <Carousel autoplay dots style={{ marginTop: 8 }} adaptiveHeight>
                  {bbsEntries.map(([title, url]) => (
                    <BannerCarouselSlide key={`bbs-${title}-${url}`} title={title} url={url} />
                  ))}
                </Carousel>
              </div>
            )}
            {docEntries.length > 0 && (
              <div>
                <Text strong>
                  <FileTextOutlined /> {t('mainPage.docs')}
                </Text>
                <Carousel autoplay dots style={{ marginTop: 8 }} adaptiveHeight>
                  {docEntries.map(([title, url]) => (
                    <BannerCarouselSlide key={`doc-${title}-${url}`} title={title} url={url} />
                  ))}
                </Carousel>
              </div>
            )}
          </Space>
        )}
      </Card>

      <div>
        <Title level={5}>{t('mainPage.templatesTitle')}</Title>
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('mainPage.templatesHint')}
        </Paragraph>
        <Row gutter={[16, 16]}>
          {templates.length === 0 && !listLoading ? (
            <Col span={24}>
              <Empty description={t('mainPage.empty.noTemplates')} />
            </Col>
          ) : (
            templates.map((row, index) => {
              const tid = pickTemplateId(row)
              const sourcePid = pickTemplateSourceProjectId(row)
              const busy = tid != null && deletingId === tid
              const desc = pickTemplateDescription(row)
              return (
                <Col key={tid ?? `tpl-${pageNumber}-${index}`} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    size="small"
                    loading={listLoading}
                    title={pickTemplateName(row)}
                    styles={{ body: { minHeight: 88 } }}
                    extra={
                      <Space size={0} wrap>
                        <Button
                          type="link"
                          size="small"
                          disabled={sourcePid == null}
                          onClick={() => openCreateFromTemplate(row)}
                        >
                          {t('mainPage.card.createProject')}
                        </Button>
                        <Popconfirm
                          title={t('mainPage.popconfirm.title')}
                          okText={t('mainPage.popconfirm.ok')}
                          okType="danger"
                          disabled={!tid}
                          onConfirm={() => void onDeleteTemplate(row)}
                        >
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            disabled={!tid}
                            loading={busy}
                            aria-label={t('mainPage.deleteAria')}
                          />
                        </Popconfirm>
                      </Space>
                    }
                  >
                    <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
                      {desc || t('mainPage.noDescription')}
                    </Paragraph>
                  </Card>
                </Col>
              )
            })
          )}
        </Row>
        {total > 0 ? (
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination
              current={pageNumber}
              pageSize={pageSize}
              total={total}
              disabled={listLoading}
              showSizeChanger
              pageSizeOptions={[8, 12, 16, 24]}
              showTotal={(totalCount) => t('mainPage.paginationTotal', { total: totalCount })}
              onChange={(p, ps) => {
                setPageNumber(p)
                setPageSize(ps)
              }}
            />
          </div>
        ) : null}
      </div>

      <Modal
        title={t('mainPage.modal.title')}
        open={createFromTplOpen}
        okText={t('mainPage.modal.ok')}
        confirmLoading={creatingFromTpl}
        onCancel={() => {
          setCreateFromTplOpen(false)
          setCreateFromTplRow(null)
          createForm.resetFields()
        }}
        onOk={() => void submitCreateFromTemplate()}
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('mainPage.modal.body', {
            name: createFromTplRow ? pickTemplateName(createFromTplRow) : '—',
          })}
        </Paragraph>
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="newName"
            label={t('mainPage.form.label')}
            rules={[{ required: true, message: t('mainPage.form.ruleRequired') }]}
          >
            <Input allowClear placeholder={t('mainPage.form.placeholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
