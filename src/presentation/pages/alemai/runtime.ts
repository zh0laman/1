import { createAlemAiController } from '../../alemai/createAlemAiController'

export const getAlemAiApi = () => {
  const { alemAiController } = createAlemAiController()
  return alemAiController.api
}
