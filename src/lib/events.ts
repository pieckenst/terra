/**
 * Central event bus for bot-dashboard communication.
 * All state changes flow through here, enabling WebSocket broadcast and hot-reload triggers.
 */

export type BusEventMap = {
  'flags:changed': (data: { flags: Record<string, any>; changedBy: string }) => void;
  'guildSettings:changed': (data: { guildId: string; settings: Record<string, any>; changedBy: string }) => void;
  'commands:reload': (data: { action: 'load' | 'unload' | 'reload'; commandName?: string }) => void;
  'command:load': (data: { commandName: string; category?: string }) => void;
  'command:unload': (data: { commandName: string }) => void;
  'log:new': (data: { level: string; message: string; context?: string; timestamp: string }) => void;
  'audit:new': (data: { actorId: string; action: string; target?: string; guildId?: string; metadata?: string }) => void;
  'moderation:action': (data: { guildId: string; action: string; targetId: string; actorId: string; reason?: string }) => void;
};

export type BusEventName = keyof BusEventMap;

class EventBus {
  private static instance: EventBus;
  private listeners: Map<BusEventName, Set<Function>>;

  private constructor() {
    this.listeners = new Map();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitTyped<K extends BusEventName>(event: K, data: Parameters<BusEventMap[K]>[0]): boolean {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return false;
    
    eventListeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  onTyped<K extends BusEventName>(event: K, listener: BusEventMap[K]): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  onceTyped<K extends BusEventName>(event: K, listener: BusEventMap[K]): this {
    const onceWrapper = ((data: any) => {
      this.offTyped(event, onceWrapper as any);
      listener(data);
    }) as BusEventMap[K];
    return this.onTyped(event, onceWrapper);
  }

  offTyped<K extends BusEventName>(event: K, listener: BusEventMap[K]): this {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
    }
    return this;
  }
}

export const bus = EventBus.getInstance();
