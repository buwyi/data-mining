import { test, expect } from '@playwright/test'

test.describe('smoke', () => {
  test('登录页展示标题与 OAuth 说明', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
    await expect(page.getByText(/OAuth/)).toBeVisible()
  })

  test('未登录访问根路径最终进入登录页', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  })
})
