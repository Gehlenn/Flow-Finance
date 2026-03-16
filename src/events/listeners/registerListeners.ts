/**
 * REGISTER LISTENERS
 *
 * Ponto central de bootstrap para todos os listeners de eventos financeiros.
 * Chame `registerEventListeners()` uma única vez na inicialização da aplicação.
 */

import { registerAutopilotListener } from './autopilotListener';
import { registerAIQueueListener }   from './aiQueueListener';
import { registerForecastListener }  from './forecastListener';
import { registerAuditListener }     from './auditListener';
import { registerCacheInvalidationListener } from './cacheInvalidationListener';

export type ListenerCleanup = () => void;

/**
 * Registra todos os listeners de eventos e retorna uma função de cleanup
 * que pode ser chamada para cancelar todos os registros (útil em testes).
 */
export function registerEventListeners(): ListenerCleanup {
  const cleanupFns: ListenerCleanup[] = [
    registerAuditListener(),
    registerCacheInvalidationListener(),
    registerAutopilotListener(),
    registerAIQueueListener(),
    registerForecastListener(),
  ];

  console.info('[EventListeners] Todos os listeners registrados.');

  return () => {
    cleanupFns.forEach((fn) => fn());
    console.info('[EventListeners] Todos os listeners removidos.');
  };
}
