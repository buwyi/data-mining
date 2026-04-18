import { App as AntdApp, ConfigProvider } from 'antd'
import enUS from 'antd/locale/en_US'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppBootstrap } from './components/AppBootstrap'
import { RuntimeThemeProvider } from './components/RuntimeThemeProvider'
import { FlowRunFailureModalBridge } from './components/FlowRunFailureModalBridge'
import { RealtimeSocketBridge } from './components/RealtimeSocketBridge'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { ComponentsPage } from './pages/ComponentsPage'
import { DataSourcePage } from './pages/DataSourcePage'
import { LoginPage } from './pages/LoginPage'
import { ForbiddenPage } from './pages/ForbiddenPage'
import { MainPage } from './pages/MainPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { ProjectPage } from './pages/ProjectPage'
import { DatasourceSocketNotifyBridge } from './components/DatasourceSocketNotifyBridge'
import { I18nProvider, useI18n } from './i18n/I18nProvider'
import { ProjectShowLegacyRedirect } from './pages/ProjectShowLegacyRedirect'
import { ProjectShowPage } from './pages/ProjectShowPage'

function AppRoutes() {
  return (
    <BrowserRouter>
      <RealtimeSocketBridge />
      <DatasourceSocketNotifyBridge />
      <FlowRunFailureModalBridge />
      <Routes>
        <Route path="/" element={<Navigate to="/home/main" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/show" element={<ProjectShowLegacyRedirect />} />
        <Route path="/show/:projectId" element={<ProjectShowPage />} />
        <Route
          path="/home"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="main" element={<MainPage />} />
          <Route path="datasource" element={<DataSourcePage />} />
          <Route path="project/:projectId" element={<ProjectPage />} />
          <Route path="project" element={<ProjectPage />} />
          <Route path="components" element={<ComponentsPage />} />
          <Route path="forbidden" element={<ForbiddenPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

/** 与 `I18nProvider` 中的应用语言同步 Ant Design 组件文案（日期、分页等）。 */
function AppWithAntdLocale() {
  const { locale } = useI18n()
  const antdLocale = locale === 'en' ? enUS : zhCN
  return (
    <ConfigProvider locale={antdLocale}>
      <AntdApp>
        <AppBootstrap>
          <RuntimeThemeProvider>
            <AppRoutes />
          </RuntimeThemeProvider>
        </AppBootstrap>
      </AntdApp>
    </ConfigProvider>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppWithAntdLocale />
    </I18nProvider>
  )
}
