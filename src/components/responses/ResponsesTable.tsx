import type { ResponseFilter, ResponseSort } from '../../lib/adminResponses'
import type { AdminSubmission } from '../../types'
import { categoryName, entryDivisionName, statusName } from './labels'

interface ResponsesTableProps {
  rows: AdminSubmission[]
  verifiedCount: number
  search: string
  filter: ResponseFilter
  sort: ResponseSort
  onSearchChange: (value: string) => void
  onFilterChange: (value: ResponseFilter) => void
  onSortChange: (value: ResponseSort) => void
  onOpenImage: (path: string) => void
  onEdit: (row: AdminSubmission) => void
}

export function ResponsesTable({
  rows,
  verifiedCount,
  search,
  filter,
  sort,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onOpenImage,
  onEdit,
}: ResponsesTableProps) {
  return (
    <section className="card table-card">
      <div className="table-heading">
        <div>
          <h2>回答一覧</h2>
          <p>
            {rows.length}件表示・確認済み {verifiedCount}件
          </p>
        </div>
      </div>
      <div className="filters">
        <input
          type="search"
          placeholder="ユーザー名・IDで検索"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <select
          aria-label="絞り込み"
          value={filter}
          onChange={(event) =>
            onFilterChange(event.target.value as ResponseFilter)
          }
        >
          <option value="all">すべて</option>
          <option value="sena">十王星南</option>
          <option value="tsubame">雨夜燕</option>
          <option value="pending">未確認</option>
          <option value="verified">確認済み</option>
          <option value="invalid">無効</option>
        </select>
        <select
          aria-label="並び替え"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as ResponseSort)}
        >
          <option value="updated">最終更新日時</option>
          <option value="created">回答日時</option>
          <option value="score">確認済み評価値</option>
          <option value="name">ユーザー名</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>参加者</th>
              <th>部門</th>
              <th>応募部門</th>
              <th>評価値</th>
              <th>画像</th>
              <th>初回回答</th>
              <th>最終更新</th>
              <th>状態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const verificationStatus =
                row.review?.verification_status ?? 'pending'

              return (
                <tr key={row.id}>
                  <td>
                    <strong>{row.discord_username}</strong>
                    <small>
                      {row.producer_name} / {row.profile.user_id}
                    </small>
                  </td>
                  <td>{categoryName[row.category]}</td>
                  <td>{entryDivisionName[row.entry_division]}</td>
                  <td className="score">
                    {row.review?.confirmed_score?.toLocaleString() ?? '—'}
                  </td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => onOpenImage(row.score_image_path)}
                    >
                      評価値
                    </button>{' '}
                    /{' '}
                    <button
                      className="link-button"
                      onClick={() => onOpenImage(row.deck_image_path)}
                    >
                      デッキ
                    </button>
                    {row.beginner_proof_image_path && (
                      <>
                        {' '}
                        /{' '}
                        <button
                          className="link-button"
                          onClick={() =>
                            onOpenImage(row.beginner_proof_image_path!)
                          }
                        >
                          PID・Pレベル
                        </button>
                      </>
                    )}
                  </td>
                  <td>{new Date(row.created_at).toLocaleString('ja-JP')}</td>
                  <td>{new Date(row.updated_at).toLocaleString('ja-JP')}</td>
                  <td>
                    <span className={`status ${verificationStatus}`}>
                      {statusName[verificationStatus]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button secondary small"
                      onClick={() => onEdit(row)}
                    >
                      確認・編集
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
