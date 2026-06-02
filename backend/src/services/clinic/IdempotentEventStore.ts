import crypto from 'crypto';
import logger from '../../config/logger';

/**
 * Interface mínima de Redis aceita pelo IdempotentEventStore.
 * Compatível com node-redis (RedisClientType) e ioredis (Redis) — duck typing.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<string | null | 'OK'>;
  setEx(key: string, ttl: number, value: string): Promise<string | null | 'OK'>;
  exists(key: string): Promise<number>;
  del(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  ttl(key: string): Promise<number>;
  ping(): Promise<string>;
}

export interface ProcessedEventRecord {
  eventId: string;
  externalEventId: string;
  sourceSystem: string;
  processedAt: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

function isProcessedEventRecord(value: unknown): value is ProcessedEventRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.eventId === 'string' &&
    typeof record.externalEventId === 'string' &&
    typeof record.sourceSystem === 'string' &&
    typeof record.processedAt === 'string' &&
    (record.result === 'success' || record.result === 'failure')
  );
}

/**
 * IdempotentEventStore: Rastreia eventos processados para evitar duplicação.
 * Usa Redis para performance e escalabilidade.
 * 
 * Chave: sourceSystem + externalEventId (garante unicidade por origem)
 * Dados: { eventId, externalEventId, processedAt, result }
 * TTL: 30 dias (suficiente para audit trail)
 */
export class IdempotentEventStore {
  private readonly redis: RedisLike;
  private readonly ttlSeconds: number = 30 * 24 * 60 * 60; // 30 dias

  constructor(redis: RedisLike) {
    this.redis = redis;
  }

  /**
   * Gerar chave de idempotência a partir de evento.
   */
  private generateIdempotencyKey(sourceSystem: string, externalEventId: string): string {
    return `idempotent:${sourceSystem}:${externalEventId}`;
  }

  /**
   * Gerar fingerprint SHA256 da payload para deduplicação.
   */
  generatePayloadHash(payload: unknown): string {
    const json = JSON.stringify(payload);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Registrar evento como processado.
   * Retorna: verdadeiro se foi novo, falso se já existia.
   */
  async recordProcessed(
    sourceSystem: string,
    externalEventId: string,
    internalEventId: string,
    result: 'success' | 'failure',
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);

    const record = {
      eventId: internalEventId,
      externalEventId,
      sourceSystem,
      processedAt: new Date().toISOString(),
      result,
      metadata: metadata || {}
    };

    const json = JSON.stringify(record);

    // Caminho preferencial: gravação atômica no Redis usando NX + TTL
    // Evita janela de corrida entre leitura e escrita em cenários concorrentes.
    const savedAtomically = await this.tryAtomicSetIfAbsent(key, json);
    if (savedAtomically !== null) {
      if (!savedAtomically) {
        logger.info(
          { sourceSystem, externalEventId, key },
          'Duplicate event detected: already processed (atomic)'
        );
      }
      return savedAtomically;
    }

    // Verificar se já existe
    const existing = await this.redis.get(key);
    if (existing) {
      logger.info(
        { sourceSystem, externalEventId, key },
        'Duplicate event detected: already processed'
      );
      return false; // Já processado
    }

    // Salvar com TTL
    await this.redis.setEx(key, this.ttlSeconds, json);

    logger.info(
      { sourceSystem, externalEventId, eventId: internalEventId },
      'Event recorded as processed'
    );

    return true; // Novo evento
  }

  private async tryAtomicSetIfAbsent(key: string, value: string): Promise<boolean | null> {
    const redisAny = this.redis as RedisLike & {
      set?: (...args: unknown[]) => Promise<string | null | 'OK'>;
    };
    const setFn = redisAny?.set;

    if (typeof setFn !== 'function') {
      return null;
    }

    try {
      // node-redis style
      const objectResult = await setFn.call(redisAny, key, value, { EX: this.ttlSeconds, NX: true });
      if (objectResult === 'OK') {
        return true;
      }
      if (objectResult === null) {
        return false;
      }
    } catch (error) {
      logger.warn({
        key,
        error,
        ttlSeconds: this.ttlSeconds,
        fallback: 'idempotent-event-atomic-set-failed',
      }, 'Atomic Redis SET NX/EX failed, trying positional fallback');
      // ioredis style fallback abaixo
    }

    try {
      // ioredis style
      const positionalResult = await setFn.call(redisAny, key, value, 'EX', this.ttlSeconds, 'NX');
      if (positionalResult === 'OK') {
        return true;
      }
      if (positionalResult === null) {
        return false;
      }
    } catch (error) {
      logger.warn({
        key,
        error,
        ttlSeconds: this.ttlSeconds,
        fallback: 'idempotent-event-positional-set-failed',
      }, 'Positional Redis SET NX/EX fallback failed');
      return null;
    }

    return null;
  }

  /**
   * Verificar se evento já foi processado (sem registrar novo).
   */
  async isProcessed(sourceSystem: string, externalEventId: string): Promise<boolean> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Obter registro de evento processado.
   */
  async getProcessedRecord(
    sourceSystem: string,
    externalEventId: string
  ): Promise<{
    eventId: string;
    externalEventId: string;
    sourceSystem: string;
    processedAt: string;
    result: 'success' | 'failure';
    metadata?: Record<string, unknown>;
  } | null> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);
    const json = await this.redis.get(key);

    if (!json) {
      return null;
    }

    try {
      const parsed = JSON.parse(json) as unknown;
      return isProcessedEventRecord(parsed) ? parsed : null;
    } catch (error) {
      logger.error({
        key,
        error,
        fallback: 'idempotent-event-parse-failed',
      }, 'Failed to parse stored record');
      return null;
    }
  }

  /**
   * Limpar registro (útil para testes ou buscas por recriação).
   */
  async clearRecord(sourceSystem: string, externalEventId: string): Promise<void> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);
    await this.redis.del(key);
    logger.info({ sourceSystem, externalEventId }, 'Record cleared');
  }

  /**
   * Listar todos os eventos processados de uma origem (para auditoria).
   * Nota: Isso pode ser lento em produção com muitos dados.
   */
  async listProcessedBySource(
    sourceSystem: string,
    limit: number = 100
  ): Promise<ProcessedEventRecord[]> {
    const pattern = `idempotent:${sourceSystem}:*`;
    const keys = await this.redis.keys(pattern);

    const records: ProcessedEventRecord[] = [];
    for (const key of keys.slice(0, limit)) {
      const json = await this.redis.get(key);
      if (json) {
        try {
          const parsed = JSON.parse(json) as unknown;
          if (isProcessedEventRecord(parsed)) {
            records.push(parsed);
          }
        } catch (error) {
          logger.warn({
            key,
            error,
            sourceSystem,
            fallback: 'idempotent-event-list-parse-failed',
          }, 'Ignoring invalid idempotent record payload');
        }
      }
    }

    return records;
  }

  /**
   * TTL para saber quanto tempo falta para expiração.
   */
  async getRemainingTTL(sourceSystem: string, externalEventId: string): Promise<number> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);
    const ttl = await this.redis.ttl(key);
    return ttl; // -1 se não existe, -2 se expirou, número positivo se existe
  }
}

/**
 * Factory para criar instância com Redis padrão.
 */
export function createIdempotentEventStore(redis: RedisLike): IdempotentEventStore {
  return new IdempotentEventStore(redis);
}

export default IdempotentEventStore;
