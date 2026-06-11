import { useState, useEffect } from 'react'
import type { BoardOptionViewModel, BoardStatsViewModel } from '../../view-models/BoardViewModel'
import type { BoardController } from '../../controllers/BoardController'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import BoardStatsDashboard from './BoardStatsDashboard'

interface MultiBoardStatsModalProps {
  open: boolean
  onClose: () => void
  boards: BoardOptionViewModel[]
  boardController: BoardController
}

export default function MultiBoardStatsModal({ open, onClose, boards, boardController }: MultiBoardStatsModalProps) {
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([])
  const [stats, setStats] = useState<BoardStatsViewModel | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showConfig, setShowConfig] = useState(true)

  useEffect(() => {
    if (open) {
      setSelectedBoardIds([])
      setStats(null)
      setShowConfig(true)
      setError('')
    }
  }, [open])

  if (!open) return null

  const handleToggleBoard = (id: string) => {
    setSelectedBoardIds((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedBoardIds(boards.map((b) => b.id))
  }

  const handleClearSelection = () => {
    setSelectedBoardIds([])
  }

  const handleLoadStats = async () => {
    setIsLoading(true)
    setError('')
    try {
      // If empty array, backend will load for all boards, but let's pass the array
      const data = await boardController.loadMultiBoardStats(selectedBoardIds)
      setStats(data)
      setShowConfig(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить статистику'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (stats && !showConfig) {
    return (
      <BoardStatsDashboard
        stats={stats}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-[#091728]/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#DCE4F1] bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#E1E7F2] px-6 py-4">
          <div className="flex items-center gap-3">
            <MaterialSymbol name="analytics" size={24} color="#1E88E5" />
            <h2 className="text-lg font-bold text-[#0A1628]">Общая статистика</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#4D6486] transition hover:bg-[#F3F7FE]"
          >
            <MaterialSymbol name="close" size={20} color="currentColor" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <p className="mb-4 text-sm text-[#4A5F7A]">
            Выберите доски для формирования отчета. Если ничего не выбрано, статистика будет рассчитана по всем доступным доскам.
          </p>

          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-semibold text-[#1E88E5] hover:underline"
            >
              Выбрать все
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs font-semibold text-[#EF4444] hover:underline"
            >
              Очистить выбор
            </button>
            <span className="ml-auto text-xs font-bold text-[#64748B]">
              Выбрано: {selectedBoardIds.length} из {boards.length}
            </span>
          </div>

          <div className="grid max-h-[300px] grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-[#E1E7F2] p-2 bg-[#F8FAFC]">
            {boards.map((board) => (
              <label
                key={board.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                  selectedBoardIds.includes(board.id)
                    ? 'border-[#1E88E5] bg-[#EBF4FE]'
                    : 'border-transparent hover:bg-[#F1F5F9]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedBoardIds.includes(board.id)}
                  onChange={() => handleToggleBoard(board.id)}
                  className="h-4 w-4 rounded border-[#DDE3EE] text-[#1E88E5] focus:ring-[#1E88E5]"
                />
                <span className="text-sm font-semibold text-[#0A1628] truncate">{board.name}</span>
              </label>
            ))}
            {boards.length === 0 && (
              <div className="col-span-1 sm:col-span-2 text-center text-sm text-[#64748B] py-4">
                У вас нет доступных досок.
              </div>
            )}
          </div>

          {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[#E1E7F2] bg-[#F8FAFC] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#DDE3EE] bg-white px-4 py-2 text-sm font-semibold text-[#4A5F7A] transition hover:bg-[#F3F7FE]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleLoadStats}
            disabled={isLoading || boards.length === 0}
            className="flex items-center gap-2 rounded-lg bg-[#1E88E5] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#1878CA] disabled:opacity-50"
          >
            {isLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <MaterialSymbol name="monitoring" size={18} color="currentColor" />
            )}
            Показать статистику
          </button>
        </footer>
      </div>
    </div>
  )
}
