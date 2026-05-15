import { test, expect } from '@playwright/test'

/**
 * 与毕业论文第 6 章表 \ref{tab:test-cases} 对应：
 * TC-A2 登录页；TC-A1 未登录路由守卫（根路径与受保护子路径）。
 */
test.describe('TC-A 认证与路由（烟测）', () => {
  test('TC-A2：登录页展示标题与 OAuth 相关说明', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
    await expect(page.getByText(/OAuth/)).toBeVisible()
  })

  test('TC-A1：未登录访问根路径重定向至登录页', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  })

  test('TC-A1：未登录访问 /home/components 重定向至登录页', async ({ page }) => {
    await page.goto('/home/components')
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
  })
})
