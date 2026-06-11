import { HttpAlemAiRepository } from '../../infrastructure/repositories/HttpAlemAiRepository';
import { LocalStorageAuthSessionStore } from '../../infrastructure/storage/LocalStorageAuthSessionStore';

export const createAlemAiController = () => {
  const sessionStore = new LocalStorageAuthSessionStore();
  const alemAiRepository = new HttpAlemAiRepository(sessionStore);

  return {
    alemAiRepository,
  };
};
