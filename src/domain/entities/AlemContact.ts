/** Единая карточка сотрудника: учётная запись + кадровый профиль (справочник HR). */
export interface AlemContact {
  id: number
  keycloak_id: string
  iin: string | null
  email: string
  username: string
  full_name: string
  first_name: string | null
  last_name: string | null
  middle_name: string | null
  position: string | null
  avatar_url: string | null
  is_active: boolean
  role: string
  ministry_id: number | null
  state_body_id: number | null
  department_id: number | null
  division_id: number | null
  /** Организация верхнего уровня (name_go) */
  organization: string | null
  /** Подразделение / управление (sub_name) */
  department_unit: string | null
  job_uid: string | null
  sub_uid: string | null
  job_name: string | null
  person_code: string | null
  person_status: string | null
  absence_status: string | null
  card_type: string | null
  bin: string | null
  badge_code: string | null
  last_order_number: string | null
  last_order_date: string | null
  last_begin_date: string | null
  first_begin_date: string | null
  doc_type: string | null
  hr_profile_id: number | null
  user_created_at: string
  hr_updated_at: string | null
}

/** Поля для `GET /api/v1/users/hr/filters/{field}` */
export const HR_FILTER_FIELDS = ['job_name', 'sub_name', 'name_go', 'person_status'] as const
export type HrFilterField = (typeof HR_FILTER_FIELDS)[number]

/** Параметры `GET /api/v1/users/hr` (пагинация, q, точечные фильтры) */
export interface HrUsersListParams {
  limit?: number
  offset?: number
  /** Глобальный поиск: email, логин, ФИО, ИИН, табельный, код, должность, подразделение, организация */
  q?: string
  job_name?: string
  sub_name?: string
  name_go?: string
  person_status?: string
  iin?: string
}

export interface AlemContactDirectoryMeta {
  source: string
  generated_at: string
  /** Записей в текущей странице ответа */
  count: number
  total?: number
  /** Страница запроса (0-based) */
  page?: number
  page_size?: number
  pages?: number
  limit?: number
  offset?: number
}

export interface AlemContactDirectory {
  meta: AlemContactDirectoryMeta
  contacts: AlemContact[]
}
