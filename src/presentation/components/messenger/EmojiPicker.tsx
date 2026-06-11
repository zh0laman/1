import { useEffect, useMemo, useRef, useState } from 'react'
import MS from '../../../shared/ui/MaterialSymbol'
import { C } from '../../pages/dashboard/model/constants'
import EmojiGlyph from './EmojiGlyph'

type EmojiItem = {
  value: string
  keywords: string[]
}

type EmojiCategory = {
  id: string
  label: string
  icon: string
  emojis: EmojiItem[]
}

const RECENT_EMOJIS_STORAGE_KEY = 'alem-messenger-recent-emojis'
const MAX_RECENT_EMOJIS = 18

const createEmoji = (value: string, ...keywords: string[]): EmojiItem => ({
  value,
  keywords,
})

const BASE_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Лица и люди',
    icon: '🙂',
    emojis: [
      createEmoji('😀', 'улыбка', 'радость', 'smile', 'happy'),
      createEmoji('😄', 'смех', 'улыбка', 'grin', 'smile'),
      createEmoji('😁', 'доволен', 'happy', 'grin'),
      createEmoji('😊', 'милый', 'blush', 'smile'),
      createEmoji('😉', 'подмигивание', 'wink'),
      createEmoji('😍', 'любовь', 'влюблен', 'love'),
      createEmoji('😘', 'поцелуй', 'kiss'),
      createEmoji('🥰', 'сердца', 'любовь', 'love'),
      createEmoji('🤗', 'обнимаю', 'hug'),
      createEmoji('🤔', 'думаю', 'thinking', 'question'),
      createEmoji('😎', 'круто', 'cool', 'glasses'),
      createEmoji('🥳', 'праздник', 'party'),
      createEmoji('😴', 'сон', 'sleep', 'tired'),
      createEmoji('😭', 'плачу', 'cry', 'sad'),
      createEmoji('😡', 'злой', 'angry'),
      createEmoji('🤯', 'в шоке', 'mind blown', 'shock'),
      createEmoji('🤩', 'восторг', 'star eyes'),
      createEmoji('😇', 'ангел', 'angel'),
    ],
  },
  {
    id: 'gestures',
    label: 'Жесты',
    icon: '👍',
    emojis: [
      createEmoji('👍', 'палец', 'ок', 'like', 'good'),
      createEmoji('👎', 'нет', 'dislike', 'bad'),
      createEmoji('👌', 'идеально', 'perfect', 'ok'),
      createEmoji('✌️', 'победа', 'victory', 'peace'),
      createEmoji('🤞', 'удача', 'luck'),
      createEmoji('🤝', 'согласие', 'deal', 'рукопожатие'),
      createEmoji('👏', 'аплодисменты', 'clap'),
      createEmoji('🙌', 'ура', 'celebrate'),
      createEmoji('🙏', 'спасибо', 'pray'),
      createEmoji('👋', 'привет', 'wave', 'hello'),
      createEmoji('💪', 'сила', 'strong'),
      createEmoji('🫶', 'любовь', 'heart hands'),
      createEmoji('🤟', 'люблю', 'love you'),
      createEmoji('🫡', 'уважение', 'salute'),
      createEmoji('☝️', 'один', 'up'),
      createEmoji('👀', 'смотрю', 'look', 'eyes'),
    ],
  },
  {
    id: 'hearts',
    label: 'Сердца и реакции',
    icon: '❤️',
    emojis: [
      createEmoji('❤️', 'сердце', 'love', 'heart'),
      createEmoji('🧡', 'orange heart', 'сердце'),
      createEmoji('💛', 'yellow heart', 'сердце'),
      createEmoji('💚', 'green heart', 'сердце'),
      createEmoji('💙', 'blue heart', 'сердце'),
      createEmoji('💜', 'purple heart', 'сердце'),
      createEmoji('🤍', 'white heart', 'сердце'),
      createEmoji('🖤', 'black heart', 'сердце'),
      createEmoji('💔', 'broken heart', 'разбитое сердце'),
      createEmoji('🔥', 'огонь', 'fire', 'hot'),
      createEmoji('✨', 'блеск', 'sparkles'),
      createEmoji('🎉', 'праздник', 'party'),
      createEmoji('💯', 'сто', '100', 'perfect'),
      createEmoji('✅', 'готово', 'done', 'check'),
      createEmoji('❗', 'внимание', 'alert'),
      createEmoji('❓', 'вопрос', 'question'),
    ],
  },
  {
    id: 'animals',
    label: 'Животные',
    icon: '🐶',
    emojis: [
      createEmoji('🐶', 'собака', 'dog'),
      createEmoji('🐱', 'кот', 'cat'),
      createEmoji('🐭', 'мышь', 'mouse'),
      createEmoji('🐹', 'хомяк', 'hamster'),
      createEmoji('🐰', 'кролик', 'rabbit'),
      createEmoji('🦊', 'лиса', 'fox'),
      createEmoji('🐻', 'медведь', 'bear'),
      createEmoji('🐼', 'панда', 'panda'),
      createEmoji('🐨', 'коала', 'koala'),
      createEmoji('🐯', 'тигр', 'tiger'),
      createEmoji('🦁', 'лев', 'lion'),
      createEmoji('🐵', 'обезьяна', 'monkey'),
      createEmoji('🐸', 'лягушка', 'frog'),
      createEmoji('🐼', 'panda', 'панда'),
      createEmoji('🐷', 'свинья', 'pig'),
      createEmoji('🦄', 'единорог', 'unicorn'),
    ],
  },
  {
    id: 'food',
    label: 'Еда и напитки',
    icon: '🍔',
    emojis: [
      createEmoji('🍎', 'яблоко', 'apple'),
      createEmoji('🍌', 'банан', 'banana'),
      createEmoji('🍓', 'клубника', 'strawberry'),
      createEmoji('🍒', 'вишня', 'cherry'),
      createEmoji('🍕', 'пицца', 'pizza'),
      createEmoji('🍔', 'бургер', 'burger'),
      createEmoji('🍟', 'картошка', 'fries'),
      createEmoji('🌮', 'тако', 'taco'),
      createEmoji('🍣', 'суши', 'sushi'),
      createEmoji('🍩', 'пончик', 'donut'),
      createEmoji('🍪', 'печенье', 'cookie'),
      createEmoji('🍰', 'торт', 'cake'),
      createEmoji('☕', 'кофе', 'coffee'),
      createEmoji('🥤', 'напиток', 'drink'),
      createEmoji('🍿', 'попкорн', 'popcorn'),
      createEmoji('🍉', 'арбуз', 'watermelon'),
    ],
  },
  {
    id: 'activities',
    label: 'Активности',
    icon: '⚽',
    emojis: [
      createEmoji('⚽', 'футбол', 'soccer'),
      createEmoji('🏀', 'баскетбол', 'basketball'),
      createEmoji('🏆', 'кубок', 'trophy'),
      createEmoji('🎮', 'игра', 'gamepad', 'gaming'),
      createEmoji('🎵', 'музыка', 'music'),
      createEmoji('🎬', 'кино', 'movie'),
      createEmoji('📚', 'книги', 'books'),
      createEmoji('💻', 'компьютер', 'laptop', 'work'),
      createEmoji('📱', 'телефон', 'phone'),
      createEmoji('🧠', 'мозг', 'idea'),
      createEmoji('🎯', 'цель', 'target'),
      createEmoji('🎨', 'рисование', 'art'),
      createEmoji('🎧', 'наушники', 'headphones'),
      createEmoji('🎤', 'микрофон', 'mic'),
      createEmoji('📸', 'фото', 'camera'),
      createEmoji('🕹️', 'джойстик', 'joystick'),
    ],
  },
  {
    id: 'travel',
    label: 'Путешествия',
    icon: '✈️',
    emojis: [
      createEmoji('✈️', 'самолет', 'plane', 'flight'),
      createEmoji('🚗', 'машина', 'car'),
      createEmoji('🚕', 'такси', 'taxi'),
      createEmoji('🚆', 'поезд', 'train'),
      createEmoji('🗺️', 'карта', 'map'),
      createEmoji('🏝️', 'остров', 'island', 'vacation'),
      createEmoji('🏠', 'дом', 'home'),
      createEmoji('🏢', 'офис', 'office'),
      createEmoji('🌤️', 'погода', 'weather'),
      createEmoji('🌙', 'ночь', 'moon'),
      createEmoji('🌍', 'земля', 'earth'),
      createEmoji('⛱️', 'пляж', 'beach'),
      createEmoji('🏖️', 'отпуск', 'vacation'),
      createEmoji('🧳', 'чемодан', 'travel'),
      createEmoji('🛫', 'вылет', 'departure'),
      createEmoji('🚀', 'ракета', 'rocket'),
    ],
  },
]

const EMOJI_LOOKUP = new Map<string, EmojiItem>(
  BASE_CATEGORIES.flatMap((category) => category.emojis.map((emoji) => [emoji.value, emoji] as const)),
)

const readRecentEmojis = (): string[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_EMOJIS)
  } catch {
    return []
  }
}

const writeRecentEmojis = (nextValue: string[]): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(nextValue.slice(0, MAX_RECENT_EMOJIS)))
  } catch {
    return
  }
}


interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [search, setSearch] = useState('')
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => readRecentEmojis())
  const [requestedCategoryId, setRequestedCategoryId] = useState('smileys')

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const categories = useMemo<EmojiCategory[]>(() => {
    const recentCategory: EmojiCategory | null =
      recentEmojis.length > 0
        ? {
            id: 'recent',
            label: 'Недавние',
            icon: '🕘',
            emojis: recentEmojis.map((emoji) => EMOJI_LOOKUP.get(emoji) ?? createEmoji(emoji)),
          }
        : null

    return recentCategory ? [recentCategory, ...BASE_CATEGORIES] : BASE_CATEGORIES
  }, [recentEmojis])

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return categories
    }

    return categories
      .map((category) => ({
        ...category,
        emojis: category.emojis.filter((emoji) => {
          if (category.label.toLowerCase().includes(query)) {
            return true
          }

          return emoji.keywords.some((keyword) => keyword.toLowerCase().includes(query))
        }),
      }))
      .filter((category) => category.emojis.length > 0)
  }, [categories, search])

  const activeCategoryId = useMemo(() => {
    if (filteredCategories.length === 0) {
      return requestedCategoryId
    }

    return filteredCategories.some((category) => category.id === requestedCategoryId)
      ? requestedCategoryId
      : filteredCategories[0].id
  }, [filteredCategories, requestedCategoryId])

  useEffect(() => {
    if (search.trim()) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const updateActiveCategory = () => {
      const threshold = 40
      let nextActive = filteredCategories[0]?.id ?? 'smileys'

      for (const category of filteredCategories) {
        const node = sectionRefs.current[category.id]
        if (!node) {
          continue
        }

        if (node.offsetTop - container.scrollTop <= threshold) {
          nextActive = category.id
        }
      }

      setRequestedCategoryId(nextActive)
    }

    updateActiveCategory()
    container.addEventListener('scroll', updateActiveCategory)

    return () => {
      container.removeEventListener('scroll', updateActiveCategory)
    }
  }, [filteredCategories, search])

  const handleEmojiSelect = (emoji: string) => {
    onSelect(emoji)

    setRecentEmojis((prev) => {
      const nextValue = [emoji, ...prev.filter((item) => item !== emoji)].slice(0, MAX_RECENT_EMOJIS)
      writeRecentEmojis(nextValue)
      return nextValue
    })
  }

  const handleCategoryClick = (categoryId: string) => {
    setRequestedCategoryId(categoryId)

    if (search.trim()) {
      return
    }

    sectionRefs.current[categoryId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div
      ref={rootRef}
      style={{
        width: 368,
        maxWidth: 'min(368px, calc(100vw - 26px))',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FAFCFF 100%)',
        border: `1px solid ${C.borderLight}`,
        borderRadius: 24,
        boxShadow: '0 20px 46px rgba(10,22,40,0.17)',
        overflow: 'hidden',
        fontFamily: '"Roboto", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '18px 18px 12px',
          borderBottom: `1px solid ${C.borderLight}`,
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F6FAFF 100%)',
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1C2740', letterSpacing: '-0.02em' }}>Эмодзи</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            border: `1px solid ${C.borderLight}`,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(10,22,40,0.05)',
          }}
          title="Закрыть"
        >
          <MS name="close" size={16} color="#91A4C2" />
        </button>
      </div>

      <div style={{ padding: '14px 14px 10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 42,
            padding: '0 14px',
            borderRadius: 15,
            background: '#F4F8FE',
            border: `1px solid ${C.borderLight}`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
          }}
        >
          <MS name="search" size={16} color="#8AA0C1" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск эмодзи"
            autoFocus
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 14,
              color: '#20314F',
              fontFamily: '"Roboto", sans-serif',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 12px 12px',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        {filteredCategories.map((category) => {
          const isActive = activeCategoryId === category.id

          return (
            <button
              key={category.id}
              type="button"
              onClick={() => handleCategoryClick(category.id)}
              style={{
                minWidth: 48,
                height: 38,
                padding: '0 10px',
                borderRadius: 14,
                border: `1px solid ${isActive ? '#D0E5FF' : '#E3EBF7'}`,
                background: isActive ? 'linear-gradient(180deg, #ECF5FF 0%, #E4F0FF 100%)' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: isActive ? '0 8px 18px rgba(46,135,255,0.12)' : '0 2px 8px rgba(10,22,40,0.04)',
              }}
              title={category.label}
            >
              <EmojiGlyph emoji={category.icon} size={22} />
            </button>
          )
        })}
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 336,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: '2px 14px 16px',
        }}
      >
        {filteredCategories.length === 0 ? (
          <div
            style={{
              padding: '28px 14px 24px',
              textAlign: 'center',
              color: '#7D93B4',
              fontSize: 13,
            }}
          >
            По вашему запросу эмодзи не найдены.
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div
              key={category.id}
              ref={(node) => {
                sectionRefs.current[category.id] = node
              }}
              style={{ paddingTop: 10 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  paddingLeft: 4,
                  color: '#8DA1BF',
                }}
              >
                <EmojiGlyph emoji={category.icon} size={18} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>{category.label}</span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  gap: 6,
                }}
              >
                {category.emojis.map((emoji) => (
                  <button
                    key={`${category.id}-${emoji.value}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleEmojiSelect(emoji.value)}
                    style={{
                      width: '100%',
                      height: 44,
                      borderRadius: 16,
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(246,250,255,0.96) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                      transition: 'transform 0.14s ease, background 0.14s ease, box-shadow 0.14s ease',
                    }}
                    title={emoji.keywords[0] ?? 'Эмодзи'}
                  >
                    <EmojiGlyph emoji={emoji.value} size={30} />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
