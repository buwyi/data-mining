/** 深拷贝后合并 `tabs[tabIndex].elements[elIndex]` 的字段，供 `PUT /api/component/{id}` */
export function applyPatchToComponentTabs(
  tabs: unknown,
  tabIndex: number,
  elIndex: number,
  patch: Record<string, unknown>,
): unknown[] {
  if (!Array.isArray(tabs)) {
    throw new Error('组件 tabs 不是数组')
  }
  const next = JSON.parse(JSON.stringify(tabs)) as unknown[]
  const tab = next[tabIndex]
  if (tab === null || typeof tab !== 'object' || Array.isArray(tab)) {
    throw new Error('无效的参数页签')
  }
  const t = tab as Record<string, unknown>
  const elementsRaw = t.elements
  if (!Array.isArray(elementsRaw)) {
    throw new Error('页签下无 elements 数组')
  }
  const elements = [...elementsRaw]
  const cur = elements[elIndex]
  if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) {
    throw new Error('无效的参数元素')
  }
  elements[elIndex] = { ...(cur as Record<string, unknown>), ...patch }
  t.elements = elements
  return next
}

export function appendEmptyTab(tabs: unknown, tabName: string): unknown[] {
  const base = Array.isArray(tabs) ? tabs : []
  const next = JSON.parse(JSON.stringify(base)) as unknown[]
  next.push({
    tabName,
    elements: [] as unknown[],
  })
  return next
}

export function setTabNameAt(tabs: unknown, tabIndex: number, tabName: string): unknown[] {
  if (!Array.isArray(tabs)) {
    throw new Error('组件 tabs 不是数组')
  }
  const next = JSON.parse(JSON.stringify(tabs)) as unknown[]
  const tab = next[tabIndex]
  if (tab === null || typeof tab !== 'object' || Array.isArray(tab)) {
    throw new Error('无效的参数页签')
  }
  ;(tab as Record<string, unknown>).tabName = tabName
  return next
}

export function removeTabAt(tabs: unknown, tabIndex: number): unknown[] {
  if (!Array.isArray(tabs)) {
    throw new Error('组件 tabs 不是数组')
  }
  const next = JSON.parse(JSON.stringify(tabs)) as unknown[]
  next.splice(tabIndex, 1)
  return next
}

export function appendElementToTab(
  tabs: unknown,
  tabIndex: number,
  element: Record<string, unknown>,
): unknown[] {
  if (!Array.isArray(tabs)) {
    throw new Error('组件 tabs 不是数组')
  }
  const next = JSON.parse(JSON.stringify(tabs)) as unknown[]
  const tab = next[tabIndex]
  if (tab === null || typeof tab !== 'object' || Array.isArray(tab)) {
    throw new Error('无效的参数页签')
  }
  const t = tab as Record<string, unknown>
  const elementsRaw = t.elements
  const elements = Array.isArray(elementsRaw) ? [...elementsRaw] : []
  elements.push(element)
  t.elements = elements
  return next
}
