export type FieldKind = 'string' | 'number' | 'boolean' | 'enum' | 'string-list' | 'json'

export interface SchemaField {
  name: string
  label: string
  description?: string
  required: boolean
  kind: FieldKind
  options?: string[]
  placeholder?: string
  default?: unknown
}

type JsonSchema = {
  type?: string | string[]
  title?: string
  description?: string
  properties?: Record<string, JsonSchema>
  required?: string[]
  enum?: unknown[]
  items?: JsonSchema
  default?: unknown
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  additionalProperties?: unknown
}

function classify(schema: JsonSchema): FieldKind {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type
  if (schema.enum?.length) return 'enum'
  if (schema.oneOf?.length || schema.anyOf?.length) return 'json'
  if (type === 'boolean') return 'boolean'
  if (type === 'integer' || type === 'number') return 'number'
  if (type === 'array') {
    const itemsType = Array.isArray(schema.items?.type) ? schema.items?.type[0] : schema.items?.type
    if (itemsType === 'string' && !schema.items?.enum?.length) return 'string-list'
    return 'json'
  }
  if (type === 'object' || schema.properties) return 'json'
  return 'string'
}

export function fieldsFromSchema(schema: unknown): SchemaField[] {
  if (!schema || typeof schema !== 'object') return []
  const root = schema as JsonSchema
  const properties = root.properties
  if (!properties || typeof properties !== 'object') return []
  const required = new Set(Array.isArray(root.required) ? root.required : [])

  return Object.entries(properties).map(([name, raw]) => {
    const field = (raw ?? {}) as JsonSchema
    const kind = classify(field)
    return {
      name,
      label: typeof field.title === 'string' && field.title ? field.title : name,
      description: typeof field.description === 'string' ? field.description : undefined,
      required: required.has(name),
      kind,
      options: field.enum?.map((option) => String(option)),
      placeholder: kind === 'string-list' ? '每行一个值' : undefined,
      default: field.default
    }
  })
}

export function fieldsFromPromptArguments(
  args: Array<{ name: string; description?: string; required?: boolean }> | undefined
): SchemaField[] {
  return (args ?? []).map((arg) => ({
    name: arg.name,
    label: arg.name,
    description: arg.description,
    required: arg.required === true,
    kind: 'string' as const
  }))
}

export function initialValues(fields: SchemaField[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.default !== undefined) {
      values[field.name] = field.default
    } else if (field.kind === 'boolean') {
      values[field.name] = false
    } else if (field.kind === 'string-list') {
      values[field.name] = ''
    } else {
      values[field.name] = ''
    }
  }
  return values
}

export function toArguments(fields: SchemaField[], values: Record<string, unknown>): Record<string, unknown> {
  const args: Record<string, unknown> = {}
  for (const field of fields) {
    const value = values[field.name]
    if (field.kind === 'boolean') {
      args[field.name] = value === true
      continue
    }
    if (field.kind === 'number') {
      if (value === '' || value === undefined || value === null) continue
      const num = Number(value)
      if (!Number.isNaN(num)) args[field.name] = num
      continue
    }
    if (field.kind === 'string-list') {
      const lines = String(value ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
      if (lines.length || field.required) args[field.name] = lines
      continue
    }
    if (field.kind === 'json') {
      const text = String(value ?? '').trim()
      if (!text) continue
      try {
        args[field.name] = JSON.parse(text)
      } catch {
        // leave invalid JSON out; the form marks it invalid
      }
      continue
    }
    const text = String(value ?? '')
    if (text === '' && !field.required) continue
    args[field.name] = text
  }
  return args
}

export function missingRequired(fields: SchemaField[], values: Record<string, unknown>): string[] {
  return fields
    .filter((field) => {
      if (!field.required) return false
      if (field.kind === 'boolean') return false
      const value = values[field.name]
      return value === undefined || value === null || String(value).trim() === ''
    })
    .map((field) => field.label)
}
