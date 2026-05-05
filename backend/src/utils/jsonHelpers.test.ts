import { describe, it, expect } from 'vitest';
import { parseSafeLimit } from './jsonHelpers';

describe('parseSafeLimit', () => {
  describe('retorna defaultVal para entradas inválidas', () => {
    it('retorna default para undefined', () => {
      expect(parseSafeLimit(undefined, 100)).toBe(100);
    });

    it('retorna default para null', () => {
      expect(parseSafeLimit(null, 100)).toBe(100);
    });

    it('retorna default para string vazia', () => {
      expect(parseSafeLimit('', 100)).toBe(100);
    });

    it('retorna default para string de espaços', () => {
      expect(parseSafeLimit('   ', 100)).toBe(100);
    });

    it('retorna default para NaN', () => {
      expect(parseSafeLimit('abc', 100)).toBe(100);
    });

    it('retorna default para Infinity', () => {
      expect(parseSafeLimit('Infinity', 50)).toBe(50);
    });

    it('retorna default para zero', () => {
      expect(parseSafeLimit('0', 100)).toBe(100);
    });

    it('retorna default para valor negativo', () => {
      expect(parseSafeLimit('-10', 100)).toBe(100);
    });

    it('retorna default para número de ponto flutuante sem parte inteira >= 1', () => {
      expect(parseSafeLimit('0.9', 100)).toBe(100);
    });
  });

  describe('aceita valores válidos', () => {
    it('aceita 1 (mínimo válido)', () => {
      expect(parseSafeLimit('1', 100)).toBe(1);
    });

    it('aceita valor normal dentro do max', () => {
      expect(parseSafeLimit('50', 100)).toBe(50);
    });

    it('aceita valor igual ao max', () => {
      expect(parseSafeLimit('500', 100)).toBe(500);
    });

    it('aceita número com espaços (parseInt é tolerante)', () => {
      expect(parseSafeLimit(' 42 ', 100)).toBe(42);
    });
  });

  describe('respeita o clamp máximo', () => {
    it('clamp ao max padrão (500)', () => {
      expect(parseSafeLimit('9999', 100)).toBe(500);
    });

    it('clamp ao max customizado', () => {
      expect(parseSafeLimit('9999', 100, 1000)).toBe(1000);
    });

    it('clamp ao max pequeno', () => {
      expect(parseSafeLimit('200', 10, 50)).toBe(50);
    });
  });

  describe('default customizado', () => {
    it('usa defaultVal diferente de 100', () => {
      expect(parseSafeLimit(undefined, 25)).toBe(25);
    });

    it('usa defaultVal 1', () => {
      expect(parseSafeLimit('', 1)).toBe(1);
    });
  });
});
