import { verifySession } from '@/lib/dal'

export default async function AdminSermonsPage() {
  await verifySession()

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-ink">Sermons</h1>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm text-bg hover:bg-accent-deep">
          New sermon
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl bg-paper shadow-sm">
        <table className="min-w-[44rem] w-full text-sm">
          <thead className="bg-surface text-ink-muted">
            <tr>
              {['Date', 'Title', 'Preacher', 'Worship', 'Published', 'Actions'].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line">
              <td className="px-4 py-3 text-ink-muted" colSpan={6}>
                No sermons have been added.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
