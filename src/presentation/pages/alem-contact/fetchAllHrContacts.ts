import type { AlemContact } from '../../../domain/entities/AlemContact'
import type { ProfileRepository } from '../../../domain/repositories/ProfileRepository'

const PAGE_SIZE = 100

export async function fetchAllHrContacts(repository: ProfileRepository): Promise<AlemContact[]> {
  const all: AlemContact[] = []
  let offset = 0
  let total: number | undefined

  for (;;) {
    const page = await repository.listHrUsers({ limit: PAGE_SIZE, offset })
    const batch = page.contacts
    if (batch.length === 0) break

    all.push(...batch)
    total = page.meta.total ?? all.length
    offset += batch.length

    if (batch.length < PAGE_SIZE || offset >= total) break
    if (offset > 20_000) break
  }

  return all
}
