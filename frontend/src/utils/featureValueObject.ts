/**
 * 将节点参数 `value` 解析为「平面对象」以便用「特征名 / 特征值」表格展示。
 * 支持：JSON 对象、JSON 对象字符串、JSON 数组（元组行或 {name/key, value} 行）、运行时已是数组的情况。
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** `[["a",1],["b",2]]` → `{a:1,b:2}` */
function tupleArrayToPlainObject(arr: unknown[]): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  for (const row of arr) {
    if (!Array.isArray(row) || row.length === 0) return null
    const k = row[0]
    if (typeof k !== 'string' || k === '') return null
    out[k] = row.length > 1 ? row[1] : ''
  }
  return out
}

/**
 * `[{name:"x",value:1}]` 或字段元数据行（无 `value` 时剩余字段作为值对象）→ 平面键值。
 */
function objectArrayToPlainObject(arr: unknown[]): Record<string, unknown> | null {
  if (arr.length === 0) return {}
  const out: Record<string, unknown> = {}
  for (const item of arr) {
    if (!isRecord(item)) return null
    let rowKey: string | null = null
    if (typeof item.name === 'string' && item.name !== '') rowKey = item.name
    else if (typeof item.key === 'string' && item.key !== '') rowKey = item.key
    else if (typeof item.field === 'string' && item.field !== '') rowKey = item.field
    if (!rowKey) return null
    if (Object.prototype.hasOwnProperty.call(item, 'value')) out[rowKey] = item.value
    else if (Object.prototype.hasOwnProperty.call(item, 'val')) out[rowKey] = item.val
    else {
      const copy = { ...item }
      delete copy.name
      delete copy.key
      delete copy.field
      out[rowKey] = Object.keys(copy).length === 0 ? '' : copy
    }
  }
  return out
}

function arrayJsonToPlainObject(arr: unknown[]): Record<string, unknown> | null {
  if (arr.length === 0) return {}
  const first = arr[0]
  if (Array.isArray(first)) return tupleArrayToPlainObject(arr)
  if (isRecord(first)) return objectArrayToPlainObject(arr)
  return null
}

export function parsePlainObjectValue(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (Array.isArray(value)) {
    return arrayJsonToPlainObject(value)
  }
  if (typeof value === 'string') {
    const t = value.trim()
    if (t === '' || t === '{}') return {}
    if (!((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']')))) {
      return null
    }
    try {
      const p = JSON.parse(t) as unknown
      if (p !== null && typeof p === 'object' && !Array.isArray(p)) {
        return p as Record<string, unknown>
      }
      if (Array.isArray(p)) {
        return arrayJsonToPlainObject(p)
      }
    } catch {
      return null
    }
  }
  return null
}
