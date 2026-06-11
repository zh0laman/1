import React, { useState, useEffect, useRef } from 'react'
import type { AlemAiProfile, AlemAiReminder } from '../../../../../infrastructure/repositories/HttpAlemAiRepository'
import AppSelect from '../../../../../shared/ui/AppSelect'
import {
  getProfile,
  updateProfile,
  listReminders,
  createReminder,
  markReminderDone,
  deleteReminder
} from '../api/client'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  token: string
  onProfileUpdated: (profile: AlemAiProfile) => void
}

const responseStyleOptions = [
  { value: 'friendly', label: 'Дружелюбный' },
  { value: 'professional', label: 'Деловой' },
  { value: 'concise', label: 'Краткий' },
  { value: 'detailed', label: 'Подробный' },
]

const personaOptions = [
  { value: 'default', label: 'Стандартная' },
  { value: 'expert', label: 'Эксперт' },
  { value: 'coach', label: 'Наставник' },
  { value: 'creative', label: 'Креативная' },
]

const backgroundTypeOptions = [
  { value: 'default', label: 'По умолчанию' },
  { value: 'color', label: 'Сплошной цвет' },
  { value: 'image', label: 'Фото' },
]

export default function SettingsModal({ isOpen, onClose, token, onProfileUpdated }: SettingsModalProps) {
  const [profile, setProfile] = useState<AlemAiProfile>({
    assistant_name: 'Ассистент',
    response_style: 'friendly',
    persona_preset: 'default',
    chat_accent_color: '#1d72e7',
    chat_background_type: 'default',
    chat_background_value: '',
  })
  const [reminders, setReminders] = useState<AlemAiReminder[]>([])
  const [reminderText, setReminderText] = useState('')
  const [reminderDueAt, setReminderDueAt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!isOpen || !token) return

    const loadData = async () => {
      setIsLoading(true)
      setError('')
      try {
        await Promise.all([
          (async () => {
            try {
              const profData = await getProfile(token)
              if (profData) {
                setProfile(profData)
                onProfileUpdated(profData)
              }
            } catch (err) {
              const is404 = 
                (err && typeof err === 'object' && ('status' in err) && (err as any).status === 404) ||
                (err instanceof Error && (err.message === 'Not Found' || err.message.includes('404')))

              if (is404) {
                console.log('Profile settings do not exist yet on server. Using default client-side values.')
              } else {
                setError(err instanceof Error ? err.message : 'Не удалось загрузить настройки профиля')
              }
            }
          })(),
          (async () => {
            try {
              const remsData = await listReminders(token)
              if (remsData) setReminders(remsData)
            } catch (err) {
              console.error('Failed to load reminders:', err)
            }
          })()
        ])
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [isOpen, token])

  const handleSaveProfile = async (updatedProfile?: AlemAiProfile) => {
    setError('')
    const targetProfile = updatedProfile || profile
    try {
      const saved = await updateProfile(token, targetProfile)
      if (saved) {
        setProfile(saved)
        onProfileUpdated(saved)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройки')
    }
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/^image\//i.test(file.type)) {
      setError('Пожалуйста, выберите файл изображения')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Изображение должно быть меньше 5 МБ')
      return
    }

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
        reader.readAsDataURL(file)
      })

      const updated = {
        ...profile,
        chat_background_type: 'image',
        chat_background_value: dataUrl,
      }
      setProfile(updated)
      await handleSaveProfile(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки фото')
    }
  }

  const handleResetBackground = async () => {
    const updated = {
      ...profile,
      chat_background_type: 'default',
      chat_background_value: '',
    }
    setProfile(updated)
    if (fileInputRef.current) fileInputRef.current.value = ''
    await handleSaveProfile(updated)
  }

  const handleBackgroundTypeChange = async (type: string) => {
    if (type === 'image') {
      fileInputRef.current?.click()
      return
    }

    const updated = {
      ...profile,
      chat_background_type: type,
      chat_background_value: type === 'color' ? '#f3f4f6' : '',
    }
    setProfile(updated)
    await handleSaveProfile(updated)
  }

  const handleAddReminder = async () => {
    if (!reminderText.trim()) {
      setError('Введите текст напоминания')
      return
    }
    if (!reminderDueAt) {
      setError('Выберите дату и время')
      return
    }

    const due = new Date(reminderDueAt)
    if (Number.isNaN(due.getTime())) {
      setError('Неверный формат даты')
      return
    }

    try {
      await createReminder(token, reminderText.trim(), due.toISOString())
      setReminderText('')
      setReminderDueAt('')
      const loaded = await listReminders(token)
      setReminders(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить напоминание')
    }
  }

  const handleMarkReminderDone = async (id: string) => {
    try {
      await markReminderDone(token, id)
      const loaded = await listReminders(token)
      setReminders(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось завершить напоминание')
    }
  }

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteReminder(token, id)
      const loaded = await listReminders(token)
      setReminders(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить напоминание')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fadeIn">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
      />
      <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl border border-gray-200/80 rounded-3xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] z-10 animate-zoomIn hide-scrollbars">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider font-head">Настройки ассистента</h3>
          <button 
            type="button" 
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center border border-gray-100 bg-white hover:bg-gray-50 active:scale-95 transition-all text-gray-500 shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-semibold leading-relaxed animate-shake">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <span className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-gray-400">Загрузка настроек...</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Section: Main Config */}
            <div className="border border-gray-100 bg-white/40 p-4 rounded-2xl space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Имя ассистента</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    maxLength={120}
                    placeholder="Напр. Джарвис"
                    value={profile.assistant_name}
                    onChange={(e) => setProfile({ ...profile, assistant_name: e.target.value })}
                    className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    className="shrink-0 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 rounded-xl text-xs font-semibold text-gray-700 shadow-sm transition-all"
                  >
                    Сохранить
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Стиль ответа</label>
                  <AppSelect
                    value={profile.response_style}
                    options={responseStyleOptions}
                    onChange={(value) => {
                      const updated = { ...profile, response_style: value }
                      setProfile(updated)
                      void handleSaveProfile(updated)
                    }}
                    ariaLabel="Стиль ответа"
                    showButtonAvatar={false}
                    showOptionAvatar={false}
                    buttonClassName="!h-11 !rounded-2xl !border-gray-200/80 !bg-white !px-4 !text-sm !font-medium !text-gray-700 hover:!border-blue-400"
                    menuClassName="!rounded-2xl"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Персона</label>
                  <AppSelect
                    value={profile.persona_preset}
                    options={personaOptions}
                    onChange={(value) => {
                      const updated = { ...profile, persona_preset: value }
                      setProfile(updated)
                      void handleSaveProfile(updated)
                    }}
                    ariaLabel="Персона"
                    showButtonAvatar={false}
                    showOptionAvatar={false}
                    buttonClassName="!h-11 !rounded-2xl !border-gray-200/80 !bg-white !px-4 !text-sm !font-medium !text-gray-700 hover:!border-blue-400"
                    menuClassName="!rounded-2xl"
                  />
                </div>
              </div>


              {/* Chat Color Picker */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Цвет чата</label>
                <div className="flex items-center gap-3">
                  <div className="relative w-12 h-8 rounded-xl border border-gray-200 overflow-hidden shrink-0 cursor-pointer shadow-sm">
                    <input
                      type="color"
                      value={profile.chat_accent_color}
                      onChange={(e) => setProfile({ ...profile, chat_accent_color: e.target.value })}
                      className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-150"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 rounded-xl text-xs font-semibold text-gray-700 shadow-sm transition-all"
                  >
                    Сохранить стиль
                  </button>
                </div>
              </div>

              {/* Background Picker */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 pl-1">Фон чата</label>
                <div className="mb-3">
                  <AppSelect
                    value={profile.chat_background_type}
                    options={backgroundTypeOptions}
                    onChange={(value) => void handleBackgroundTypeChange(value)}
                    ariaLabel="Фон чата"
                    showButtonAvatar={false}
                    showOptionAvatar={false}
                    buttonClassName="!h-11 !rounded-2xl !border-gray-200/80 !bg-white !px-4 !text-sm !font-medium !text-gray-700 hover:!border-blue-400"
                    menuClassName="!rounded-2xl"
                  />
                </div>

                {profile.chat_background_type === 'color' && (
                  <div className="flex items-center gap-3 mb-3 animate-slideDown">
                    <div className="relative w-12 h-8 rounded-xl border border-gray-200 overflow-hidden shrink-0 cursor-pointer shadow-sm">
                      <input
                        type="color"
                        value={profile.chat_background_value.startsWith('#') ? profile.chat_background_value : '#f3f4f6'}
                        onChange={(e) => {
                          const updated = { ...profile, chat_background_value: e.target.value }
                          setProfile(updated)
                          void handleSaveProfile(updated)
                        }}
                        className="absolute inset-0 w-full h-full p-0 border-none cursor-pointer scale-150"
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-semibold">Выберите цвет фона чата</span>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 rounded-xl text-xs font-semibold text-gray-700 shadow-sm transition-all"
                  >
                    Выбрать фото
                  </button>
                  <button
                    type="button"
                    onClick={handleResetBackground}
                    className="px-4 py-2 border border-gray-200 bg-white hover:bg-red-50 hover:text-red-600 active:scale-95 rounded-xl text-xs font-semibold text-gray-500 shadow-sm transition-all"
                  >
                    Сбросить фон
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-2 pl-1">
                  {profile.chat_background_type === 'image' 
                    ? 'При выборе режима "Фото" можно открыть изображение с вашего устройства.' 
                    : profile.chat_background_type === 'color'
                    ? 'Сплошной цвет заливки полотна чата.'
                    : 'Используется стандартный красивый фон чата с декоративными овещенными сферами.'}
                </p>
              </div>
            </div>

            {/* Section: Reminders */}
            <div className="border border-gray-100 bg-white/40 p-4 rounded-2xl space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Напоминания</h4>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 pl-1">Текст</label>
                  <input
                    type="text"
                    maxLength={4000}
                    placeholder="Что напомнить?"
                    value={reminderText}
                    onChange={(e) => setReminderText(e.target.value)}
                    className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1 pl-1">Когда</label>
                  <input
                    type="datetime-local"
                    value={reminderDueAt}
                    onChange={(e) => setReminderDueAt(e.target.value)}
                    className="w-full bg-white border border-gray-200/80 rounded-xl px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddReminder}
                className="w-full py-2 bg-[#1E88E5] text-white hover:bg-[#1565C0] active:scale-98 rounded-xl text-xs font-semibold shadow-md shadow-[#1E88E5]/25 transition-all"
              >
                Добавить напоминание
              </button>

              {/* Reminders List */}
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 hide-scrollbars">
                {reminders.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 border border-gray-100/50 rounded-xl text-[11px] text-gray-400 font-semibold">
                    Нет активных напоминаний
                  </div>
                ) : (
                  reminders.map((reminder) => (
                    <div 
                      key={reminder.id} 
                      className="flex items-center justify-between gap-3 p-2.5 bg-white border border-gray-100 rounded-xl hover:shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800 truncate pr-1">
                          {reminder.text}
                        </p>
                        <p className="text-[9px] text-gray-400 mt-0.5 font-medium">
                          {new Date(reminder.due_at).toLocaleString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => void handleMarkReminderDone(reminder.id)}
                          className="px-2.5 py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-lg transition-all"
                        >
                          Готово
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteReminder(reminder.id)}
                          className="w-6 h-6 flex items-center justify-center text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg active:scale-90 transition-all"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
