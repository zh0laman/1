/** Раздел AlemContact доступен всем авторизованным пользователям workspace. */
export function canAccessAlemContact(_email: string | null | undefined): boolean {
  return true
}
