import { GetCallsHistoryUseCase } from '../../application/use-cases/notifications/GetCallsHistoryUseCase'
import { GetNotificationsUseCase } from '../../application/use-cases/notifications/GetNotificationsUseCase'
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/notifications/MarkAllNotificationsReadUseCase'
import { MarkNotificationReadUseCase } from '../../application/use-cases/notifications/MarkNotificationReadUseCase'
import { HttpNotificationRepository } from '../../infrastructure/repositories/HttpNotificationRepository'
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore'
import { NotificationController } from '../controllers/NotificationController'

export const createNotificationController = () => {
  const sessionStore = new LocalStorageAuthSessionStore()
  const repository = new HttpNotificationRepository(sessionStore)

  const notificationController = new NotificationController(
    new GetNotificationsUseCase(repository),
    new MarkNotificationReadUseCase(repository),
    new MarkAllNotificationsReadUseCase(repository),
    new GetCallsHistoryUseCase(repository),
  )

  return {
    notificationController,
  }
}
