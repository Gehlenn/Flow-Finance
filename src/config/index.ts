/**
 * CONFIG LAYER EXPORTS - Flow Finance
 *
 * Exports configuration and dependency injection setup
 */

export type { AppConfig } from './appConfig';
export {
  AppContainer,
  defaultConfig,
  initializeApp,
  getAppContainer,
} from './appConfig';