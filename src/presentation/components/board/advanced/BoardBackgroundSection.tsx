import { useMemo, useState } from 'react'
import AppConfirmDialog from '../../../../shared/ui/AppConfirmDialog'

export interface BackgroundPresetViewModel {
  id: string
  name: string
  preview: string
}

interface BoardBackgroundSectionProps {
  presets: BackgroundPresetViewModel[]
  activePresetId: string
  currentBackgroundLabel: string
  isImageBackground: boolean
  isLoading: boolean
  onPresetSelect: (presetId: string) => Promise<void>
  onUploadImage: (file: File) => Promise<void>
  onDeleteBackground: () => Promise<void>
  onRestorePreset: () => Promise<void>
}

export default function BoardBackgroundSection({
  presets,
  activePresetId,
  currentBackgroundLabel,
  isImageBackground,
  isLoading,
  onPresetSelect,
  onUploadImage,
  onDeleteBackground,
  onRestorePreset,
}: BoardBackgroundSectionProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const activePreset = useMemo(
    () => presets.find((item) => item.id === activePresetId) ?? presets[0] ?? null,
    [activePresetId, presets],
  )

  return (
    <section className="rounded-2xl border border-[#E2EAF5] bg-white p-4">
      <h4 className="text-base font-bold text-[#0A1628]">Фон доски</h4>
      <p className="mt-1 text-xs text-[#7186A7]">Выберите цветовой пресет или загрузите изображение фона для текущей доски.</p>

      <div className="mt-3 rounded-xl border border-[#EEF3FB] bg-[#F9FCFF] px-3 py-2 text-sm text-[#486284]">
        Текущий фон: <span className="font-semibold text-[#0A1628]">{currentBackgroundLabel}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {presets.map((preset) => {
          const isActive = preset.id === activePresetId
          return (
            <button
              key={preset.id}
              type="button"
              aria-label={`Выбрать фон ${preset.name}`}
              disabled={isLoading}
              onClick={() => {
                void onPresetSelect(preset.id)
              }}
              className={`group rounded-xl border p-1 text-left transition ${
                isActive ? 'border-[#1E88E5] bg-[#EBF4FE]' : 'border-[#DDE3EE] bg-white hover:border-[#BFD0E9]'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="h-9 w-full rounded-lg" style={{ background: preset.preview }} />
              <p className="mt-1 truncate px-0.5 text-[11px] font-semibold text-[#0A1628]">{preset.name}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-xl border border-[#DDE3EE] bg-white px-3 text-sm font-semibold text-[#334E73] transition hover:bg-[#F9FAFB]">
          Загрузить изображение
          <input
            type="file"
            className="hidden"
            disabled={isLoading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void onUploadImage(file)
                event.target.value = ''
              }
            }}
          />
        </label>

        {isImageBackground ? (
          <button
            type="button"
            disabled={isLoading || !activePreset}
            onClick={() => {
              if (!activePreset) return
              void onRestorePreset()
            }}
            className="h-10 rounded-xl border border-[#DDE3EE] bg-[#F5FAFF] px-3 text-sm font-semibold text-[#1E88E5] transition hover:bg-[#EAF4FF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Вернуть цветовой пресет
          </button>
        ) : null}

        <button
          type="button"
          disabled={isLoading}
          onClick={() => setConfirmDeleteOpen(true)}
          className="h-10 rounded-xl border border-[#F3D5D5] bg-[#FFF6F6] px-3 text-sm font-semibold text-[#C53030] transition hover:bg-[#FDEEEE] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Удалить фон
        </button>
      </div>

      <AppConfirmDialog
        open={confirmDeleteOpen}
        title="Удаление фона"
        message="Удалить текущий фон доски?"
        confirmText="Удалить"
        isLoading={isLoading}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          void onDeleteBackground().finally(() => {
            setConfirmDeleteOpen(false)
          })
        }}
      />
    </section>
  )
}
