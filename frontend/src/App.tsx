import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppBootstrap } from './components/AppBootstrap'
import { RequireAuth } from './components/RequireAuth'
import { AppLayout } from './layouts/AppLayout'
import { ComponentsPage } from './pages/ComponentsPage'
import { DataSourcePage } from './pages/DataSourcePage'
import { LoginPage } from './pages/LoginPage'
import { MainPage } from './pages/MainPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OAuthCallbackPage } from './pages/OAuthCallbackPage'
import { ProjectPage } from './pages/ProjectPage'

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntdApp>
        <AppBootstrap>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/home/main" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
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
                <Route path="project" element={<ProjectPage />} />
                <Route path="components" element={<ComponentsPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </AppBootstrap>
      </AntdApp>
    </ConfigProvider>
  )
}
