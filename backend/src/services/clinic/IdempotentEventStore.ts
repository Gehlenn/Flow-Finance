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
  generatePayloadHash(payload: any): string {
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
    metadata?: Record<string, any>
  ): Promise<boolean> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);

    // Verificar se já existe
    const existing = await this.redis.get(key);
    if (existing) {
      logger.info(
        { sourceSystem, externalEventId, key },
        'Duplicate event detected: already processed'
      );
      return false; // Já processado
    }

    // Registrar novo evento
    const record = {
      eventId: internalEventId,
      externalEventId,
      sourceSystem,
      processedAt: new Date().toISOString(),
      result,
      metadata: metadata || {}
    };

    // Salvar com TTL
    const json = JSON.stringify(record);
    await this.redis.setEx(key, this.ttlSeconds, json);

    logger.info(
      { sourceSystem, externalEventId, eventId: internalEventId },
      'Event recorded as processed'
    );

    return true; // Novo evento
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
    processedAt: string;
    result: 'success' | 'failure';
    metadata?: Record<string, any>;
  } | null> {
    const key = this.generateIdempotencyKey(sourceSystem, externalEventId);
    const json = await this.redis.get(key);

    if (!json) {
      return null;
    }

    try {
      return JSON.parse(json);
    } catch (error) {
      logger.error({ key, error }, 'Failed to parse stored record');
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
  ): Promise<Array<any>> {
    const pattern = `idempotent:${sourceSystem}:*`;
    const keys = await this.redis.keys(pattern);

    const records: Array<any> = [];
    for (const key of keys.slice(0, limit)) {
      const json = await this.redis.get(key);
      if (json) {
        try {
          records.push(JSON.parse(json));
        } catch {
          // Ignorar registros inválidos
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
