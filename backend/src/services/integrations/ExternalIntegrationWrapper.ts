import logger from '../../config/logger';

export interface WrapperConfig {
  /** Nome da integração para fins de logging */
  integrationName: string;
  /** Timeout em ms para cada tentativa individual */
  timeoutMs?: number;
  /** Número máximo de tentativas (1 = nenhum retry) */
  maxRetries?: number;
  /** Delay base em ms para backoff exponencial */
  retryDelayMs?: number;
  /** Circuit breaker: número máximo de falhas antes de abrir */
  circuitBreakerMaxFailures?: number;
  /** Circuit breaker: janela de tempo em ms para contar falhas */
  circuitBreakerWindowMs?: number;
}

export interface WrapperResult<T> {
  data?: T;
  success: boolean;
  attempts: number;
  durationMs: number;
  error?: string;
  circuitOpen?: boolean;
}

interface CircuitState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitStates = new Map<string, CircuitState>();

/**
 * ExternalIntegrationWrapper: Wrapper genérico para chamadas externas com:
 * - Timeout por tentativa (via Promise.race)
 * - Retry com backoff exponencial
 * - Circuit breaker simples (abre após N falhas em janela de W ms)
 *
 * Uso:
 * ```ts
 * const wrapper = new ExternalIntegrationWrapper({ integrationName: 'stripe', maxRetries: 3 });
 * const result = await wrapper.call(() => stripeClient.charges.create(params));
 * ```
 */
export class ExternalIntegrationWrapper {
  private readonly config: Required<WrapperConfig>;
  private readonly circuitKey: string;

  constructor(config: WrapperConfig) {
    this.config = {
      integrationName: config.integrationName,
      timeoutMs: config.timeoutMs ?? 10000,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 300,
      circuitBreakerMaxFailures: config.circuitBreakerMaxFailures ?? 5,
      circuitBreakerWindowMs: config.circuitBreakerWindowMs ?? 60000,
    };
    this.circuitKey = `circuit:${this.config.integrationName}`;
    if (!circuitStates.has(this.circuitKey)) {
      circuitStates.set(this.circuitKey, { failures: 0, lastFailureTime: 0, isOpen: false });
    }
  }

  /**
   * Executa uma chamada externa com proteções configuradas.
   */
  async call<T>(fn: () => Promise<T>): Promise<WrapperResult<T>> {
    const startTime = Date.now();

    if (this.isCircuitOpen()) {
      logger.warn(
        { integration: this.config.integrationName },
        'Circuit breaker open — request rejected',
      );
      return {
        success: false,
        attempts: 0,
        durationMs: 0,
        error: 'Circuit breaker open',
        circuitOpen: true,
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const data = await this.executeWithTimeout(fn);
        this.onSuccess();

        return {
          data,
          success: true,
          attempts: attempt,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          {
            integration: this.config.integrationName,
            attempt,
            maxRetries: this.config.maxRetries,
            error: lastError.message,
          },
          `External call failed (attempt ${attempt}/${this.config.maxRetries})`,
        );

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * Math.pow(2, attempt - 1));
        }
      }
    }

    this.onFailure();

    return {
      success: false,
      attempts: this.config.maxRetries,
      durationMs: Date.now() - startTime,
      error: lastError?.message ?? 'Unknown error',
    };
  }

  private executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Timeout after ${this.config.timeoutMs}ms`)),
        this.config.timeoutMs,
      ),
    );
    return Promise.race([fn(), timeoutPromise]);
  }

  private isCircuitOpen(): boolean {
    const state = circuitStates.get(this.circuitKey)!;
    if (!state.isOpen) return false;

    // Verificar se a janela de tempo expirou (auto-recovery)
    const now = Date.now();
    if (now - state.lastFailureTime > this.config.circuitBreakerWindowMs) {
      state.isOpen = false;
      state.failures = 0;
      logger.info(
        { integration: this.config.integrationName },
        'Circuit breaker recovered — resuming requests',
      );
    }

    return state.isOpen;
  }

  private onSuccess(): void {
    const state = circuitStates.get(this.circuitKey)!;
    state.failures = 0;
  }

  private onFailure(): void {
    const state = circuitStates.get(this.circuitKey)!;
    state.failures += 1;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.config.circuitBreakerMaxFailures) {
      if (!state.isOpen) {
        state.isOpen = true;
        logger.error(
          {
            integration: this.config.integrationName,
            failures: state.failures,
          },
          'Circuit breaker opened — integration suspended',
        );
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Resetar o circuit breaker manualmente (útil em testes e deploys).
   */
  resetCircuit(): void {
    circuitStates.set(this.circuitKey, { failures: 0, lastFailureTime: 0, isOpen: false });
  }

  /**
   * Ler estado atual do circuit breaker.
   */
  getCircuitState(): CircuitState {
    return { ...circuitStates.get(this.circuitKey)! };
  }
}
