import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import type {
  CreateEducationInput,
  CreateLicenseCertificationInput,
  UpdateEducationInput,
  UpdateLicenseCertificationInput,
} from '../../../domain/entities/profile-settings/ProfileSectionsModels'
import AppConfirmDialog from '../../../shared/ui/AppConfirmDialog'
import MaterialSymbol from '../../../shared/ui/MaterialSymbol'
import type {
  ProfileEducationViewModel,
  ProfileLicenseCertificationViewModel,
} from '../../view-models/ProfileViewModel'

interface ProfileExperienceSectionProps {
  educations: ProfileEducationViewModel[]
  licenses: ProfileLicenseCertificationViewModel[]
  isEducationSaving: boolean
  isLicenseSaving: boolean
  deletingEducationId: number | null
  deletingLicenseId: number | null
  onCreateEducation: (payload: CreateEducationInput) => void
  onUpdateEducation: (id: number, payload: UpdateEducationInput) => void
  onDeleteEducation: (id: number) => void
  onCreateLicense: (payload: CreateLicenseCertificationInput) => void
  onUpdateLicense: (id: number, payload: UpdateLicenseCertificationInput) => void
  onDeleteLicense: (id: number) => void
}

interface LabeledInputProps {
  label: string
  children: React.ReactNode
}

type EducationDialogMode = 'create' | 'edit'
type LicenseDialogMode = 'create' | 'edit'

const monthYearFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: 'numeric',
})

const fieldClassName =
  'h-11 w-full rounded-xl border border-[#D8E3F0] bg-white px-4 text-sm text-[#0F172A] outline-none transition-all focus:border-[#3B82F6] focus:ring-4 focus:ring-[#3B82F6]/10'

const getInitials = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'A'

const formatDateRange = (startDate: string, endDate: string): string => {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) {
    return ''
  }

  const startLabel = monthYearFormatter.format(start)
  if (!endDate) {
    return `${startLabel} - настоящее время`
  }

  const end = new Date(endDate)
  if (Number.isNaN(end.getTime())) {
    return startLabel
  }

  return `${startLabel} - ${monthYearFormatter.format(end)}`
}

const formatIssueDate = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return `Выдан ${monthYearFormatter.format(date)}`
}

const isImageAttachment = (contentType: string): boolean => contentType.startsWith('image/')

function LabeledInput({ label, children }: LabeledInputProps) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#64748B]">{label}</span>
      {children}
    </label>
  )
}

function EntityAvatar({
  label,
  imageUrl,
  tone,
}: {
  label: string
  imageUrl: string
  tone: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const normalizedUrl = imageUrl.trim()

  useEffect(() => {
    setImageFailed(false)
  }, [normalizedUrl])

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.onerror = null
    setImageFailed(true)
  }

  if (normalizedUrl && !imageFailed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-sm">
        <img
          src={normalizedUrl}
          alt={label}
          className="h-full w-full object-contain"
          onError={handleImageError}
        />
      </div>
    )
  }

  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] ${tone} text-[12px] font-semibold text-[#2563EB]`}
    >
      {getInitials(label)}
    </div>
  )
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string
  actionLabel: string
  onAction: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-[14px] font-semibold text-[#111827]">{title}</h4>
      <button
        type="button"
        onClick={onAction}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#2563EB] transition hover:text-[#1D4ED8] disabled:opacity-50"
      >
        <MaterialSymbol name="add" size={16} color="currentColor" />
        {actionLabel}
      </button>
    </div>
  )
}

function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: string
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-[#D6E2F2] bg-[#FAFCFF] px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#94A3B8] shadow-sm">
        <MaterialSymbol name={icon} size={26} color="currentColor" />
      </div>
      <h4 className="mt-4 text-lg font-semibold text-[#1E293B]">{title}</h4>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#64748B]">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-5 text-[12px] font-medium text-[#0F172A] transition-all hover:bg-[#F8FAFC]"
      >
        <MaterialSymbol name="add" size={18} color="currentColor" />
        {actionLabel}
      </button>
    </div>
  )
}

function CardActions({
  onEdit,
  onDelete,
  isDeleting,
  disabled,
}: {
  onEdit: () => void
  onDelete: () => void
  isDeleting?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled || isDeleting}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8E3F0] bg-white px-3 text-[12px] font-medium text-[#334155] transition-all hover:bg-[#F8FAFC] disabled:opacity-50"
      >
        <MaterialSymbol name="edit" size={18} color="currentColor" />
        Редактировать
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled || isDeleting}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-3 text-[12px] font-medium text-[#B42318] transition-all hover:bg-[#FEECEC] disabled:opacity-50"
      >
        <MaterialSymbol name="delete" size={18} color="currentColor" />
        {isDeleting ? 'Удаление...' : 'Удалить'}
      </button>
    </div>
  )
}

function EducationCard({
  item,
  onEdit,
  onDelete,
  isDeleting,
  disabled,
}: {
  item: ProfileEducationViewModel
  onEdit: () => void
  onDelete: () => void
  isDeleting?: boolean
  disabled?: boolean
}) {
  const subtitle = [item.degree, item.fieldOfStudy].filter(Boolean).join(', ')
  const period = formatDateRange(item.startDate, item.endDate)

  return (
    <article className="rounded-xl border border-[#E5E7EB] bg-[#FAFBFC] p-4">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <EntityAvatar label={item.schoolName} imageUrl={item.schoolAvatarUrl} tone="bg-[#DBEAFE]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-[15px] font-semibold text-[#111827]">{item.schoolName}</h4>
              {subtitle ? <p className="mt-1 text-[13px] text-[#6B7280]">{subtitle}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {period ? (
                <span className="rounded-full bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#2563EB]">{period}</span>
              ) : null}
              <CardActions onEdit={onEdit} onDelete={onDelete} isDeleting={isDeleting} disabled={disabled} />
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function LicenseCard({
  item,
  onEdit,
  onDelete,
  isDeleting,
  disabled,
}: {
  item: ProfileLicenseCertificationViewModel
  onEdit: () => void
  onDelete: () => void
  isDeleting?: boolean
  disabled?: boolean
}) {
  const issueDate = formatIssueDate(item.issueDate)
  const hasPreview = item.attachmentDownloadUrl && isImageAttachment(item.attachmentContentType)

  return (
    <article className="rounded-[28px] border border-[#E5EDF7] bg-gradient-to-br from-white via-white to-[#FCFCFD] p-7 shadow-[0_14px_40px_-26px_rgba(15,23,42,0.18)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <EntityAvatar label={item.name} imageUrl={item.avatarUrl} tone="bg-[#E0F2FE]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-[15px] font-semibold text-[#111827]">{item.name}</h4>
              <p className="mt-1 text-[13px] text-[#6B7280]">{item.issuingOrganization}</p>
              {issueDate ? <p className="mt-1 text-sm text-[#64748B]">{issueDate}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {item.skillName ? (
                <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-[#475569]">{item.skillName}</span>
              ) : null}
              <CardActions onEdit={onEdit} onDelete={onDelete} isDeleting={isDeleting} disabled={disabled} />
            </div>
          </div>

          {hasPreview || item.attachmentFileName ? (
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-[#EEF2F7] bg-[#FBFDFF] p-4 sm:flex-row sm:items-center">
              {hasPreview ? (
                <a
                  href={item.attachmentDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-20 w-36 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white"
                >
                  <img
                    src={item.attachmentDownloadUrl}
                    alt={item.attachmentFileName || item.name}
                    className="h-full w-full object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
                  <MaterialSymbol name="description" size={26} color="currentColor" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0F172A]">
                  {item.attachmentFileName || 'Файл подтверждения'}
                </p>
                <p className="mt-1 text-xs text-[#64748B]">
                  {item.attachmentContentType || 'Файл доступен для просмотра или скачивания'}
                </p>
              </div>

              {item.attachmentDownloadUrl ? (
                <a
                  href={item.attachmentDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D8E3F0] bg-white px-4 py-2 text-sm font-semibold text-[#1D4ED8] transition-colors hover:bg-[#EFF6FF]"
                >
                  <MaterialSymbol name="open_in_new" size={18} color="currentColor" />
                  Открыть
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}


export default function ProfileExperienceSection({
  educations,
  licenses,
  isEducationSaving,
  isLicenseSaving,
  deletingEducationId,
  deletingLicenseId,
  onCreateEducation,
  onUpdateEducation,
  onDeleteEducation,
  onCreateLicense,
  onUpdateLicense,
  onDeleteLicense,
}: ProfileExperienceSectionProps) {
  const [educationOpen, setEducationOpen] = useState(false)
  const [licenseOpen, setLicenseOpen] = useState(false)
  const [educationMode, setEducationMode] = useState<EducationDialogMode>('create')
  const [licenseMode, setLicenseMode] = useState<LicenseDialogMode>('create')
  const [editingEducationId, setEditingEducationId] = useState<number | null>(null)
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null)
  const [educationError, setEducationError] = useState('')
  const [licenseError, setLicenseError] = useState('')

  const [confirmDeleteEducation, setConfirmDeleteEducation] = useState<ProfileEducationViewModel | null>(null)
  const [confirmDeleteLicense, setConfirmDeleteLicense] = useState<ProfileLicenseCertificationViewModel | null>(null)

  const [schoolName, setSchoolName] = useState('')
  const [degree, setDegree] = useState('')
  const [fieldOfStudy, setFieldOfStudy] = useState('')
  const [educationStartDate, setEducationStartDate] = useState('')
  const [educationEndDate, setEducationEndDate] = useState('')
  const [educationAvatarFile, setEducationAvatarFile] = useState<File | null>(null)
  const [educationAvatarPreview, setEducationAvatarPreview] = useState('')
  const [removeEducationAvatar, setRemoveEducationAvatar] = useState(false)

  const [licenseName, setLicenseName] = useState('')
  const [issuingOrganization, setIssuingOrganization] = useState('')
  const [skillName, setSkillName] = useState('')
  const [licenseIssueDate, setLicenseIssueDate] = useState('')
  const [licenseExpirationDate, setLicenseExpirationDate] = useState('')
  const [licenseAvatarFile, setLicenseAvatarFile] = useState<File | null>(null)
  const [licenseAvatarPreview, setLicenseAvatarPreview] = useState('')
  const [removeLicenseAvatar, setRemoveLicenseAvatar] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentName, setAttachmentName] = useState('')
  const [existingAttachmentUrl, setExistingAttachmentUrl] = useState('')
  const [existingAttachmentType, setExistingAttachmentType] = useState('')
  const [removeAttachment, setRemoveAttachment] = useState(false)

  const educationAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const licenseAvatarInputRef = useRef<HTMLInputElement | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!educationAvatarFile) {
      if (educationAvatarPreview !== '') {
        const t = setTimeout(() => setEducationAvatarPreview(''), 0)
        return () => clearTimeout(t)
      }
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setEducationAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(educationAvatarFile)
  }, [educationAvatarFile, educationAvatarPreview])

  useEffect(() => {
    if (!licenseAvatarFile) {
      if (licenseAvatarPreview !== '') {
        const t = setTimeout(() => setLicenseAvatarPreview(''), 0)
        return () => clearTimeout(t)
      }
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      setLicenseAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(licenseAvatarFile)
  }, [licenseAvatarFile, licenseAvatarPreview])

  const visibleEducationAvatar = useMemo(() => {
    if (educationAvatarFile && educationAvatarPreview) return educationAvatarPreview
    if (removeEducationAvatar) return ''
    return educationAvatarPreview
  }, [educationAvatarFile, educationAvatarPreview, removeEducationAvatar])

  const visibleLicenseAvatar = useMemo(() => {
    if (licenseAvatarFile && licenseAvatarPreview) return licenseAvatarPreview
    if (removeLicenseAvatar) return ''
    return licenseAvatarPreview
  }, [licenseAvatarFile, licenseAvatarPreview, removeLicenseAvatar])

  const visibleAttachmentName = attachmentFile?.name || (removeAttachment ? '' : attachmentName)
  const visibleAttachmentUrl = attachmentFile ? '' : removeAttachment ? '' : existingAttachmentUrl
  const visibleAttachmentType = attachmentFile?.type || (removeAttachment ? '' : existingAttachmentType)

  const resetEducationForm = () => {
    setSchoolName('')
    setDegree('')
    setFieldOfStudy('')
    setEducationStartDate('')
    setEducationEndDate('')
    setEducationAvatarFile(null)
    setEducationAvatarPreview('')
    setRemoveEducationAvatar(false)
    setEducationError('')
    setEditingEducationId(null)
    setEducationMode('create')
    if (educationAvatarInputRef.current) {
      educationAvatarInputRef.current.value = ''
    }
  }

  const resetLicenseForm = () => {
    setLicenseName('')
    setIssuingOrganization('')
    setSkillName('')
    setLicenseIssueDate('')
    setLicenseExpirationDate('')
    setLicenseAvatarFile(null)
    setLicenseAvatarPreview('')
    setRemoveLicenseAvatar(false)
    setAttachmentFile(null)
    setAttachmentName('')
    setExistingAttachmentUrl('')
    setExistingAttachmentType('')
    setRemoveAttachment(false)
    setLicenseError('')
    setEditingLicenseId(null)
    setLicenseMode('create')
    if (licenseAvatarInputRef.current) {
      licenseAvatarInputRef.current.value = ''
    }
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = ''
    }
  }

  const openEducationCreate = () => {
    resetEducationForm()
    setEducationMode('create')
    setEducationOpen(true)
  }

  const openEducationEdit = (item: ProfileEducationViewModel) => {
    resetEducationForm()
    setEducationMode('edit')
    setEditingEducationId(item.id)
    setSchoolName(item.schoolName)
    setDegree(item.degree)
    setFieldOfStudy(item.fieldOfStudy)
    setEducationStartDate(item.startDate)
    setEducationEndDate(item.endDate)
    setEducationAvatarPreview(item.schoolAvatarUrl)
    setEducationOpen(true)
  }

  const openLicenseCreate = () => {
    resetLicenseForm()
    setLicenseMode('create')
    setLicenseOpen(true)
  }

  const openLicenseEdit = (item: ProfileLicenseCertificationViewModel) => {
    resetLicenseForm()
    setLicenseMode('edit')
    setEditingLicenseId(item.id)
    setLicenseName(item.name)
    setIssuingOrganization(item.issuingOrganization)
    setSkillName(item.skillName)
    setLicenseIssueDate(item.issueDate)
    setLicenseExpirationDate(item.expirationDate)
    setLicenseAvatarPreview(item.avatarUrl)
    setAttachmentName(item.attachmentFileName)
    setExistingAttachmentUrl(item.attachmentDownloadUrl)
    setExistingAttachmentType(item.attachmentContentType)
    setLicenseOpen(true)
  }

  const submitEducation = () => {
    if (!schoolName.trim() || !fieldOfStudy.trim() || !educationStartDate) {
      setEducationError('Заполните учебное заведение, специальность и дату начала.')
      return
    }

    setEducationError('')

    const payload: UpdateEducationInput = {
      schoolName: schoolName.trim(),
      degree: degree.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      startDate: educationStartDate,
      endDate: educationEndDate || undefined,
      avatarFile: educationAvatarFile,
      removeAvatar: removeEducationAvatar,
    }

    if (educationMode === 'edit' && editingEducationId != null) {
      onUpdateEducation(editingEducationId, payload)
    } else {
      onCreateEducation(payload)
    }

    resetEducationForm()
    setEducationOpen(false)
  }

  const submitLicense = () => {
    if (!licenseName.trim() || !issuingOrganization.trim() || !skillName.trim() || !licenseIssueDate) {
      setLicenseError('Заполните название, организацию, навык и дату выдачи.')
      return
    }

    setLicenseError('')

    const payload: UpdateLicenseCertificationInput = {
      name: licenseName.trim(),
      issuingOrganization: issuingOrganization.trim(),
      skillName: skillName.trim(),
      issueDate: licenseIssueDate,
      expirationDate: licenseExpirationDate || undefined,
      avatarFile: licenseAvatarFile,
      attachmentFile,
      removeAvatar: removeLicenseAvatar,
      removeAttachment,
    }

    if (licenseMode === 'edit' && editingLicenseId != null) {
      onUpdateLicense(editingLicenseId, payload)
    } else {
      onCreateLicense(payload)
    }

    resetLicenseForm()
    setLicenseOpen(false)
  }

  return (
    <div className="space-y-5">
      <div className="border-t border-[#F3F4F6] pt-6 first:border-t-0 first:pt-0">
        <SectionHeader
          title="Образование"
          actionLabel="Добавить образование"
          onAction={openEducationCreate}
          disabled={isEducationSaving}
        />

        {educationOpen ? (
          <div className="mt-7 rounded-[28px] border border-[#DCE6F4] bg-[#FAFCFF] p-6">
            <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-[#D8E3F0] bg-white p-5 sm:flex-row sm:items-center">
              <EntityAvatar
                label={schoolName || 'Education'}
                imageUrl={visibleEducationAvatar}
                tone="bg-[#DBEAFE]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {educationAvatarFile?.name || (visibleEducationAvatar ? 'Аватар загружен' : 'Аватар не выбран')}
                </p>
                <p className="mt-1 text-xs text-[#64748B]">PNG, JPG, WEBP. Используется общий файловый upload.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={educationAvatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setEducationAvatarFile(file)
                    if (file) {
                      setRemoveEducationAvatar(false)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => educationAvatarInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8E3F0] bg-[#F8FAFC] px-4 text-sm font-semibold text-[#334155]"
                >
                  <MaterialSymbol name="image" size={18} color="currentColor" />
                  {visibleEducationAvatar ? 'Заменить аватар' : 'Добавить аватар'}
                </button>
                {visibleEducationAvatar ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEducationAvatarFile(null)
                      setEducationAvatarPreview('')
                      setRemoveEducationAvatar(true)
                      if (educationAvatarInputRef.current) {
                        educationAvatarInputRef.current.value = ''
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-4 text-sm font-semibold text-[#B42318]"
                  >
                    <MaterialSymbol name="delete" size={18} color="currentColor" />
                    Убрать
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabeledInput label="Учебное заведение">
                <input
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className={fieldClassName}
                  placeholder="Например, SDU University"
                />
              </LabeledInput>
              <LabeledInput label="Степень">
                <input
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className={fieldClassName}
                  placeholder="Бакалавр, магистр"
                />
              </LabeledInput>
              <LabeledInput label="Специальность">
                <input
                  value={fieldOfStudy}
                  onChange={(e) => setFieldOfStudy(e.target.value)}
                  className={fieldClassName}
                  placeholder="Менеджмент, право, ИТ"
                />
              </LabeledInput>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput label="Дата начала">
                  <input
                    type="date"
                    value={educationStartDate}
                    onChange={(e) => setEducationStartDate(e.target.value)}
                    className={fieldClassName}
                  />
                </LabeledInput>
                <LabeledInput label="Дата окончания">
                  <input
                    type="date"
                    value={educationEndDate}
                    onChange={(e) => setEducationEndDate(e.target.value)}
                    className={fieldClassName}
                  />
                </LabeledInput>
              </div>
            </div>

            {educationError ? (
              <div className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#DC2626]">
                {educationError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetEducationForm()
                  setEducationOpen(false)
                }}
                className="inline-flex h-11 items-center rounded-xl border border-[#D8E3F0] bg-white px-5 text-sm font-semibold text-[#475569]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submitEducation}
                disabled={isEducationSaving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1E293B] px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <MaterialSymbol
                  name={educationMode === 'edit' ? 'save' : 'add'}
                  size={18}
                  color="#fff"
                />
                {isEducationSaving ? 'Сохранение...' : educationMode === 'edit' ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-7 space-y-4">
          {educations.length ? (
            educations.map((item) => (
              <EducationCard
                key={item.id}
                item={item}
                onEdit={() => openEducationEdit(item)}
                onDelete={() => setConfirmDeleteEducation(item)}
                isDeleting={deletingEducationId === item.id}
                disabled={isEducationSaving}
              />
            ))
          ) : (
            <EmptyState
              icon="school"
              title="Раздел пока пуст"
              description="Здесь будут отображаться учебные заведения, специальности, степени и периоды обучения после добавления данных в профиль."
              actionLabel="Добавить образование"
              onAction={openEducationCreate}
            />
          )}
        </div>
      </div>

      <div className="border-t border-[#F3F4F6] pt-6 first:border-t-0 first:pt-0">
        <SectionHeader
          title="Лицензии и сертификаты"
          actionLabel="Добавить сертификат"
          onAction={openLicenseCreate}
          disabled={isLicenseSaving}
        />

        {licenseOpen ? (
          <div className="mt-7 rounded-[28px] border border-[#DCE6F4] bg-[#FAFCFF] p-6">
            <div className="mb-5 flex flex-col gap-4 rounded-3xl border border-[#D8E3F0] bg-white p-5 sm:flex-row sm:items-center">
              <EntityAvatar label={licenseName || 'License'} imageUrl={visibleLicenseAvatar} tone="bg-[#E0F2FE]" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {licenseAvatarFile?.name || (visibleLicenseAvatar ? 'Аватар загружен' : 'Аватар не выбран')}
                </p>
                <p className="mt-1 text-xs text-[#64748B]">Можно добавить логотип сертификата или организации.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={licenseAvatarInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    setLicenseAvatarFile(file)
                    if (file) {
                      setRemoveLicenseAvatar(false)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => licenseAvatarInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8E3F0] bg-[#F8FAFC] px-4 text-sm font-semibold text-[#334155]"
                >
                  <MaterialSymbol name="image" size={18} color="currentColor" />
                  {visibleLicenseAvatar ? 'Заменить аватар' : 'Добавить аватар'}
                </button>
                {visibleLicenseAvatar ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLicenseAvatarFile(null)
                      setLicenseAvatarPreview('')
                      setRemoveLicenseAvatar(true)
                      if (licenseAvatarInputRef.current) {
                        licenseAvatarInputRef.current.value = ''
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-4 text-sm font-semibold text-[#B42318]"
                  >
                    <MaterialSymbol name="delete" size={18} color="currentColor" />
                    Убрать
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <LabeledInput label="Название">
                <input
                  value={licenseName}
                  onChange={(e) => setLicenseName(e.target.value)}
                  className={fieldClassName}
                  placeholder="Например, HR-партнер"
                />
              </LabeledInput>
              <LabeledInput label="Организация">
                <input
                  value={issuingOrganization}
                  onChange={(e) => setIssuingOrganization(e.target.value)}
                  className={fieldClassName}
                  placeholder="Кто выдал сертификат"
                />
              </LabeledInput>
              <LabeledInput label="Навык">
                <input
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  className={fieldClassName}
                  placeholder="Например, HR BP"
                />
              </LabeledInput>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <LabeledInput label="Дата выдачи">
                  <input
                    type="date"
                    value={licenseIssueDate}
                    onChange={(e) => setLicenseIssueDate(e.target.value)}
                    className={fieldClassName}
                  />
                </LabeledInput>
                <LabeledInput label="Срок действия">
                  <input
                    type="date"
                    value={licenseExpirationDate}
                    onChange={(e) => setLicenseExpirationDate(e.target.value)}
                    className={fieldClassName}
                  />
                </LabeledInput>
              </div>
            </div>

            <div className="mt-4">
              <LabeledInput label="Файл сертификата">
                <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-4">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setAttachmentFile(file)
                      if (file) {
                        setRemoveAttachment(false)
                      }
                    }}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#0F172A]">
                        {visibleAttachmentName || 'Файл не выбран'}
                      </p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {visibleAttachmentType || 'PDF, JPG, PNG, WEBP, DOC, DOCX'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8E3F0] bg-[#F8FAFC] px-4 text-sm font-semibold text-[#334155]"
                      >
                        <MaterialSymbol name="description" size={18} color="currentColor" />
                        {visibleAttachmentName ? 'Заменить файл' : 'Выбрать файл'}
                      </button>
                      {visibleAttachmentName ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentFile(null)
                            setAttachmentName('')
                            setExistingAttachmentUrl('')
                            setExistingAttachmentType('')
                            setRemoveAttachment(true)
                            if (attachmentInputRef.current) {
                              attachmentInputRef.current.value = ''
                            }
                          }}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-4 text-sm font-semibold text-[#B42318]"
                        >
                          <MaterialSymbol name="delete" size={18} color="currentColor" />
                          Убрать
                        </button>
                      ) : null}
                      {visibleAttachmentUrl ? (
                        <a
                          href={visibleAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D8E3F0] bg-white px-4 text-sm font-semibold text-[#1D4ED8]"
                        >
                          <MaterialSymbol name="open_in_new" size={18} color="currentColor" />
                          Открыть
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </LabeledInput>
            </div>

            {licenseError ? (
              <div className="mt-4 rounded-xl bg-[#FEF2F2] px-4 py-3 text-sm font-medium text-[#DC2626]">
                {licenseError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetLicenseForm()
                  setLicenseOpen(false)
                }}
                className="inline-flex h-11 items-center rounded-xl border border-[#D8E3F0] bg-white px-5 text-sm font-semibold text-[#475569]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submitLicense}
                disabled={isLicenseSaving}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1E293B] px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <MaterialSymbol name={licenseMode === 'edit' ? 'save' : 'add'} size={18} color="#fff" />
                {isLicenseSaving ? 'Сохранение...' : licenseMode === 'edit' ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-7 space-y-4">
          {licenses.length ? (
            licenses.map((item) => (
              <LicenseCard
                key={item.id}
                item={item}
                onEdit={() => openLicenseEdit(item)}
                onDelete={() => setConfirmDeleteLicense(item)}
                isDeleting={deletingLicenseId === item.id}
                disabled={isLicenseSaving}
              />
            ))
          ) : (
            <EmptyState
              icon="verified"
              title="Сертификаты еще не добавлены"
              description="Здесь будут показаны профессиональные сертификаты, лицензии и прикрепленные подтверждающие файлы."
              actionLabel="Добавить сертификат"
              onAction={openLicenseCreate}
            />
          )}
        </div>
      </div>

      <AppConfirmDialog
        open={Boolean(confirmDeleteEducation)}
        title="Удалить образование?"
        message={`Запись "${confirmDeleteEducation?.schoolName ?? ''}" будет удалена из профиля.`}
        confirmText="Удалить"
        isLoading={deletingEducationId === confirmDeleteEducation?.id}
        onCancel={() => setConfirmDeleteEducation(null)}
        onConfirm={() => {
          if (confirmDeleteEducation) {
            onDeleteEducation(confirmDeleteEducation.id)
            setConfirmDeleteEducation(null)
          }
        }}
      />

      <AppConfirmDialog
        open={Boolean(confirmDeleteLicense)}
        title="Удалить сертификат?"
        message={`Запись "${confirmDeleteLicense?.name ?? ''}" будет удалена из профиля.`}
        confirmText="Удалить"
        isLoading={deletingLicenseId === confirmDeleteLicense?.id}
        onCancel={() => setConfirmDeleteLicense(null)}
        onConfirm={() => {
          if (confirmDeleteLicense) {
            onDeleteLicense(confirmDeleteLicense.id)
            setConfirmDeleteLicense(null)
          }
        }}
      />
    </div>
  )
}
