import type { Bulletin, BulletinSection } from '@/lib/types'

function SectionBlock({ section }: { section: BulletinSection }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-paper p-5 shadow-subtle">
      <h2 className="font-serif text-2xl font-extrabold tracking-tight text-ink">{section.title}</h2>
      {section.body && (
        <div className="mt-4 space-y-1 text-sm leading-6 text-ink-muted">
          {section.body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      {section.rows && (
        <dl className="mt-5 divide-y divide-line">
          {section.rows.map((row) => (
            <div key={`${row.label}-${row.value}`} className="grid gap-2 py-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold text-ink">{row.label}</dt>
              <dd className="leading-6 text-ink-muted">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.tables?.map((table) => (
        <div key={table.title} className="mt-5 overflow-x-auto">
          <h3 className="mb-3 font-semibold text-ink">{table.title}</h3>
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface text-ink">
                {table.headers.map((header) => (
                  <th key={header} className="border border-line px-3 py-2 text-left font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.join('-')}>
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className="border border-line px-3 py-2 leading-6 text-ink-muted">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {section.offerings && (
        <div className="mt-5 grid gap-4">
          {section.offerings.map((offering) => (
            <div key={offering.category} className="rounded-lg bg-surface p-4">
              <h3 className="font-semibold text-ink">{offering.category}</h3>
              <p className="mt-2 leading-7 text-ink-muted">{offering.names.join(' ')}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function BulletinView({ bulletin }: { bulletin: Bulletin }) {
  return (
    <article className="space-y-6">
      <header className="rounded-lg border border-line bg-paper p-8 text-center shadow-subtle">
        <p className="text-sm font-semibold text-accent-deep">
          {bulletin.volume} {bulletin.issue} · {bulletin.bulletinDate}
        </p>
        <h1 className="mt-4 font-serif text-4xl font-extrabold leading-tight tracking-tight text-ink">
          영천중앙교회 주보
        </h1>
        <p className="mt-5 text-xl text-ink">{bulletin.theme}</p>
        <p className="mt-2 text-ink-muted">({bulletin.scripture})</p>
        <div className="mt-6 text-sm leading-6 text-ink-muted">
          <p>{bulletin.churchInfo.address}</p>
          <p>
            전화 {bulletin.churchInfo.phone}
            {bulletin.churchInfo.phone2 && `, ${bulletin.churchInfo.phone2}`}
          </p>
          <p>{bulletin.churchInfo.blog}</p>
        </div>
      </header>
      <div className="grid gap-6">
        {bulletin.sections.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>
    </article>
  )
}
