import { useEffect, useState } from 'react'
import type { ChatThemeConfigInput } from '../../../domain/entities/ChatTheme'
import {
  isMessageNotificationSoundEnabled,
  playMessageNotificationSound,
  setMessageNotificationSoundEnabled,
} from '../../../shared/audio/messageNotificationSound'
import MS from '../../../shared/ui/MaterialSymbol'

const MESSAGE_COLOR_PRESETS = ['#2E78F6', '#10B981', '#8B5CF6', '#F97316', '#EF4444', '#0EA5E9', '#14B8A6', '#111827']
const BACKGROUND_COLOR_PRESETS = ['#F3F7FD', '#EEF7F2', '#F7F1FF', '#FFF4EA', '#FFF0F0', '#EEF7FF', '#F7F9FC', '#FFFBEA']

const normalizeHex = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toUpperCase()
  }

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }

  return null
}

const hexToRgb = (value: string): [number, number, number] | null => {
  const normalized = normalizeHex(value)
  if (!normalized) {
    return null
  }

  const parsed = Number.parseInt(normalized.slice(1), 16)
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255]
}

const rgba = (value: string, alpha: number): string => {
  const rgb = hexToRgb(value)
  if (!rgb) {
    return `rgba(46,120,246,${alpha})`
  }

  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

const isDark = (value: string): boolean => {
  const rgb = hexToRgb(value)
  if (!rgb) {
    return true
  }

  const [r, g, b] = rgb
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance < 0.58
}

const mixWithWhite = (value: string, ratio: number): string => {
  const rgb = hexToRgb(value)
  if (!rgb) {
    return value
  }

  const mix = rgb.map((channel) => Math.round(channel + (255 - channel) * ratio))
  return `#${mix.map((item) => item.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

interface MessengerThemePanelProps {
  open: boolean
  isMobile: boolean
  draft: ChatThemeConfigInput
  hasSavedTheme: boolean
  isSaving: boolean
  isResetting: boolean
  isUploadingImage: boolean
  error: string | undefined
  onClose: () => void
  onChange: (patch: Partial<ChatThemeConfigInput>) => void
  onUploadImage: (file: File) => void
  onSave: () => void
  onReset: () => void
}

export default function MessengerThemePanel({
  open,
  isMobile,
  draft,
  hasSavedTheme,
  isSaving,
  isResetting,
  isUploadingImage,
  error,
  onClose,
  onChange,
  onUploadImage,
  onSave,
  onReset,
}: MessengerThemePanelProps) {
  const [messageSoundOn, setMessageSoundOn] = useState(() => isMessageNotificationSoundEnabled())

  useEffect(() => {
    const enabled = isMessageNotificationSoundEnabled()
    const t = setTimeout(() => {
      setMessageSoundOn(prev => prev === enabled ? prev : enabled)
    }, 0)
    return () => clearTimeout(t)
  }, [open])

  if (!open) {
    return null
  }

  const outgoingColor = normalizeHex(draft.messageColorHex) ?? '#2E78F6'
  const previewBubbleText = isDark(outgoingColor) ? '#FFFFFF' : '#102033'
  const previewBackgroundColor = normalizeHex(draft.backgroundColorHex) ?? '#F3F7FD'
  const previewBackground =
    draft.backgroundType === 'image' && draft.backgroundImageUrl?.trim()
      ? {
          backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0.68) 100%), url(${draft.backgroundImageUrl.trim()})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : draft.backgroundType === 'color'
        ? {
            backgroundColor: previewBackgroundColor,
            backgroundImage: `linear-gradient(180deg, ${mixWithWhite(previewBackgroundColor, 0.14)} 0%, ${previewBackgroundColor} 100%)`,
          }
        : {
            backgroundColor: '#F4F8FD',
            backgroundImage: 'linear-gradient(180deg, #F8FBFF 0%, #EEF3FA 100%)',
          }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(10,22,40,0.26)',
        display: 'flex',
        justifyContent: isMobile ? 'center' : 'flex-end',
        alignItems: isMobile ? 'flex-end' : 'stretch',
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 392,
          maxWidth: '100%',
          height: isMobile ? 'min(88vh, 760px)' : '100%',
          background: '#FFFFFF',
          borderLeft: isMobile ? 'none' : '1px solid #E3EAF5',
          borderTopLeftRadius: isMobile ? 24 : 0,
          borderTopRightRadius: isMobile ? 24 : 0,
          boxShadow: isMobile ? '0 -18px 40px rgba(10,22,40,0.18)' : '-18px 0 40px rgba(10,22,40,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '18px 18px 16px',
            borderBottom: '1px solid #E6EDF7',
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FBFF 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#1F3450', letterSpacing: '-0.018em' }}>Оформление чатов</div>
            <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4, color: '#6F84A3' }}>
              Тема применяется ко всем чатам текущего аккаунта.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: '1px solid #E3EAF5',
              background: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            title="Закрыть"
          >
            <MS name="close" size={18} color="#6F84A3" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section style={{ border: '1px solid #E6EDF7', borderRadius: 18, background: '#FAFCFF', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#28415F', marginBottom: 10 }}>Уведомления</div>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                fontSize: 13,
                color: '#3D5677',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={messageSoundOn}
                onChange={(event) => {
                  const next = event.target.checked
                  setMessageNotificationSoundEnabled(next)
                  setMessageSoundOn(next)
                  if (next) {
                    playMessageNotificationSound()
                  }
                }}
                style={{ width: 18, height: 18, accentColor: '#2E78F6', cursor: 'pointer' }}
              />
              <span>Звук при новом сообщении</span>
            </label>
            <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.45, color: '#8B9DB8' }}>
              Короткий сигнал при входящем сообщении вне ваших чатов и в фоне. Настройка сохраняется в этом браузере.
            </div>
          </section>

          <section style={{ border: '1px solid #E6EDF7', borderRadius: 18, background: '#FAFCFF', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#28415F', marginBottom: 12 }}>Цвет ваших сообщений</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              {MESSAGE_COLOR_PRESETS.map((color) => {
                const selected = normalizeHex(draft.messageColorHex) === color
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => onChange({ messageColorHex: color })}
                    style={{
                      height: 42,
                      borderRadius: 14,
                      border: selected ? `2px solid ${color}` : '1px solid #DDE6F2',
                      background: `linear-gradient(135deg, ${mixWithWhite(color, 0.08)} 0%, ${color} 100%)`,
                      cursor: 'pointer',
                      boxShadow: selected ? `0 8px 18px ${rgba(color, 0.24)}` : 'none',
                    }}
                    title={color}
                  />
                )
              })}
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="color"
                value={outgoingColor}
                onChange={(event) => onChange({ messageColorHex: event.target.value })}
                style={{ width: 42, height: 42, border: 'none', background: 'transparent', cursor: 'pointer' }}
              />
              <input
                value={normalizeHex(draft.messageColorHex) ?? outgoingColor}
                onChange={(event) => onChange({ messageColorHex: event.target.value })}
                placeholder="#2E78F6"
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  border: '1px solid #D7E2F3',
                  background: '#FFFFFF',
                  padding: '0 12px',
                  fontSize: 13,
                  color: '#1F3450',
                  outline: 'none',
                }}
              />
            </div>
          </section>

          <section style={{ border: '1px solid #E6EDF7', borderRadius: 18, background: '#FAFCFF', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#28415F', marginBottom: 12 }}>Фон переписки</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { key: 'default', label: 'По умолчанию' },
                { key: 'color', label: 'Цвет' },
                { key: 'image', label: 'Изображение' },
              ].map((option) => {
                const selected = draft.backgroundType === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onChange({ backgroundType: option.key as ChatThemeConfigInput['backgroundType'] })}
                    style={{
                      height: 34,
                      borderRadius: 999,
                      border: `1px solid ${selected ? '#7FB5FF' : '#D7E2F3'}`,
                      background: selected ? '#EAF4FF' : '#FFFFFF',
                      color: selected ? '#1A73E8' : '#5F7698',
                      padding: '0 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            {draft.backgroundType === 'color' ? (
              <>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                  {BACKGROUND_COLOR_PRESETS.map((color) => {
                    const selected = normalizeHex(draft.backgroundColorHex) === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => onChange({ backgroundType: 'color', backgroundColorHex: color })}
                        style={{
                          height: 42,
                          borderRadius: 14,
                          border: selected ? `2px solid ${rgba(outgoingColor, 0.55)}` : '1px solid #DDE6F2',
                          background: `linear-gradient(180deg, ${mixWithWhite(color, 0.12)} 0%, ${color} 100%)`,
                          cursor: 'pointer',
                        }}
                        title={color}
                      />
                    )
                  })}
                </div>
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="color"
                    value={previewBackgroundColor}
                    onChange={(event) => onChange({ backgroundType: 'color', backgroundColorHex: event.target.value })}
                    style={{ width: 42, height: 42, border: 'none', background: 'transparent', cursor: 'pointer' }}
                  />
                  <input
                    value={normalizeHex(draft.backgroundColorHex) ?? previewBackgroundColor}
                    onChange={(event) => onChange({ backgroundType: 'color', backgroundColorHex: event.target.value })}
                    placeholder="#F3F7FD"
                    style={{
                      flex: 1,
                      height: 42,
                      borderRadius: 12,
                      border: '1px solid #D7E2F3',
                      background: '#FFFFFF',
                      padding: '0 12px',
                      fontSize: 13,
                      color: '#1F3450',
                      outline: 'none',
                    }}
                  />
                </div>
              </>
            ) : null}

            {draft.backgroundType === 'image' ? (
              <>
                <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <label
                    style={{
                      minWidth: 0,
                      flex: '1 1 180px',
                      height: 42,
                      borderRadius: 12,
                      border: '1px solid #D7E2F3',
                      background: '#FFFFFF',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '0 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#1A73E8',
                      cursor: isUploadingImage ? 'default' : 'pointer',
                      opacity: isUploadingImage ? 0.7 : 1,
                    }}
                  >
                    <MS name="upload" size={16} color="#1A73E8" />
                    <span>{isUploadingImage ? 'Загружаем...' : 'Загрузить с устройства'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingImage}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          onUploadImage(file)
                        }
                        event.currentTarget.value = ''
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onChange({ backgroundImageUrl: null })}
                    disabled={isUploadingImage || !draft.backgroundImageUrl}
                    style={{
                      height: 42,
                      borderRadius: 12,
                      border: '1px solid #D7E2F3',
                      background: '#FFFFFF',
                      padding: '0 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#5F7698',
                      cursor: isUploadingImage || !draft.backgroundImageUrl ? 'default' : 'pointer',
                      opacity: isUploadingImage || !draft.backgroundImageUrl ? 0.5 : 1,
                    }}
                  >
                    Очистить
                  </button>
                </div>
                <input
                  value={draft.backgroundImageUrl ?? ''}
                  onChange={(event) => onChange({ backgroundImageUrl: event.target.value })}
                  placeholder="https://..."
                  style={{
                    marginTop: 12,
                    width: '100%',
                    height: 42,
                    borderRadius: 12,
                    border: '1px solid #D7E2F3',
                    background: '#FFFFFF',
                    padding: '0 12px',
                    fontSize: 13,
                    color: '#1F3450',
                    outline: 'none',
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: '#6F84A3' }}>
                  Можно вставить прямую ссылку вручную или загрузить изображение с устройства.
                </div>
              </>
            ) : null}
          </section>

          <section style={{ border: '1px solid #E6EDF7', borderRadius: 18, background: '#FFFFFF', padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#28415F', marginBottom: 12 }}>Предпросмотр</div>
            <div
              style={{
                borderRadius: 18,
                border: '1px solid #E2EAF5',
                padding: 16,
                minHeight: 188,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.72)',
                ...previewBackground,
              }}
            >
              <div
                style={{
                  maxWidth: 230,
                  marginLeft: 'auto',
                  borderRadius: '18px 18px 8px 18px',
                  padding: '10px 12px 8px',
                  background: `linear-gradient(135deg, ${mixWithWhite(outgoingColor, 0.06)} 0%, ${outgoingColor} 100%)`,
                  color: previewBubbleText,
                  boxShadow: `0 12px 24px ${rgba(outgoingColor, 0.22)}`,
                }}
              >
                <div style={{ fontSize: 14, lineHeight: 1.35, fontWeight: 500 }}>Вот так будут выглядеть ваши сообщения.</div>
                <div style={{ marginTop: 6, fontSize: 11, color: previewBubbleText === '#FFFFFF' ? 'rgba(255,255,255,0.82)' : 'rgba(16,32,51,0.72)', textAlign: 'right' }}>
                  14:32
                </div>
              </div>
            </div>
          </section>

          {error ? (
            <div
              style={{
                borderRadius: 14,
                border: '1px solid #F3C7C7',
                background: '#FFF5F5',
                color: '#C53B3B',
                fontSize: 13,
                lineHeight: 1.45,
                padding: '12px 14px',
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          style={{
            padding: '14px 18px 18px',
            borderTop: '1px solid #E6EDF7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: '#FFFFFF',
          }}
        >
          <button
            type="button"
            onClick={onReset}
            disabled={isSaving || isResetting || !hasSavedTheme}
            style={{
              height: 42,
              borderRadius: 12,
              border: '1px solid #D7E2F3',
              background: '#FFFFFF',
              color: '#5F7698',
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: isSaving || isResetting || !hasSavedTheme ? 'default' : 'pointer',
              opacity: isSaving || isResetting || !hasSavedTheme ? 0.5 : 1,
            }}
          >
            {isResetting ? 'Сброс...' : 'Сбросить'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isResetting}
            style={{
              height: 44,
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #1A73E8 0%, #4EA1FF 100%)',
              color: '#FFFFFF',
              padding: '0 18px',
              fontSize: 14,
              fontWeight: 800,
              cursor: isSaving || isResetting ? 'default' : 'pointer',
              boxShadow: '0 12px 24px rgba(30,136,229,0.24)',
              opacity: isSaving || isResetting ? 0.72 : 1,
            }}
          >
            {isSaving ? 'Сохраняем...' : 'Сохранить тему'}
          </button>
        </div>
      </div>
    </div>
  )
}
