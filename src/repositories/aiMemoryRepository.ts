import { AIMemory, getAIMemory, storeMemory, updateMemory, deleteMemory } from '../ai/aiMemory';

export class AIMemoryRepository {
  async getByUser(userId: string): Promise<AIMemory[]> {
    return getAIMemory(userId);
  }

  async create(memory: AIMemory): Promise<void> {
    await storeMemory(memory);
  }

  async update(memory: AIMemory): Promise<void> {
    await updateMemory(memory);
  }

  async delete(memoryId: string): Promise<void> {
    await deleteMemory(memoryId);
  }
}
