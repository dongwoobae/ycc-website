import type { BulletinFormInput } from '@/lib/actions/bulletins'
import type { BulletinTable } from '@/lib/types'

export function parseBodyLines(text: string) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.at(-1) === '') lines.pop()
  return lines
}

export function normalizeBodyLines(value: string[]) {
  const lines = [...value]
  while (lines.at(-1) === '') lines.pop()
  return lines
}

export function formatTableCells(cells: string[]) {
  for (const cell of cells) {
    if (cell.includes('\t')) throw new Error('Table cells cannot contain tabs.')
    if (cell.includes('\n') || cell.includes('\r')) throw new Error('Table cells cannot contain line breaks.')
  }
  return cells.join('\t')
}

export function parseTableCells(line: string, expectedColumnCount?: number) {
  const cells = line.split('\t')
  if (expectedColumnCount !== undefined && expectedColumnCount > 0 && cells.length !== expectedColumnCount) {
    throw new Error(`Table row must have ${expectedColumnCount} columns.`)
  }
  return cells
}

export function parseTableRows(lines: string[], expectedColumnCount?: number) {
  const normalizedLines = normalizeBodyLines(lines)
  const inferredColumnCount = expectedColumnCount || (normalizedLines[0] ? normalizedLines[0].split('\t').length : 0)
  return normalizedLines.map((line) => parseTableCells(line, inferredColumnCount || undefined))
}

export function normalizeTable(table: BulletinTable) {
  const headers = normalizeBodyLines(table.headers)
  const expectedColumnCount = headers.length || (table.rows[0]?.length ?? 0)
  const rows = table.rows.map((row) => parseTableCells(formatTableCells(row), expectedColumnCount || undefined))
  return { ...table, headers, rows }
}

export function normalizeBulletinInput(input: BulletinFormInput): BulletinFormInput {
  return {
    ...input,
    sections: input.sections.map((section) => ({
      ...section,
      ...(section.body ? { body: normalizeBodyLines(section.body) } : {}),
      ...(section.tables ? { tables: section.tables.map(normalizeTable) } : {}),
      ...(section.offerings ? { offerings: section.offerings.map((offering) => ({ ...offering, names: normalizeBodyLines(offering.names) })) } : {}),
    })),
  }
}
