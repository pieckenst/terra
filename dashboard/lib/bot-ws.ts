'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clearBotAuthTokenCache, getBotAuthToken } from './bot-auth-token';

/**
 * WebSocket client hook for real-time bot events.
 * Uses a short-lived JWT from /api/bot/auth-token (HttpOnly session cookies are not readable here).
 */

type BotEvent =
  | { event: 'flags:changed'; data: any }
  | { event: 'guildSettings:changed'; data: any }
  | { event: 'commands:reload'; data: any }
  | { event: 'command:load'; data: any }
  | { event: 'command:unload'; data: any }
  | { event: 'log:new'; data: any }
  | { event: 'audit:new'; data: any }
  | { event: 'moderation:action'; data: any };

type EventCallback = (data: any) => void;

const BOT_ROOT = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:3001';

export type BotConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useBotEvents(_topics: string[], onMessage?: (event: BotEvent) => void) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const [sessionKey, setSessionKey] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<BotConnectionStatus>('disconnected');
  const callbacksRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const allowReconnectRef = useRef(true);

  useEffect(() => {
    allowReconnectRef.current = true;
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const clearTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = async () => {
      if (cancelled) return;
      setConnectionStatus('connecting');

      const token = await getBotAuthToken();
      if (cancelled) return;

      if (!token) {
        setConnectionStatus('disconnected');
        if (allowReconnectRef.current) {
          reconnectTimer = setTimeout(connect, 5000);
        }
        return;
      }

      const wsUrl = `${BOT_ROOT.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const data: BotEvent = JSON.parse(event.data);
          onMessageRef.current?.(data);
          const topicCallbacks = callbacksRef.current.get(data.event);
          if (topicCallbacks) {
            topicCallbacks.forEach((cb) => cb(data.data));
          }
        } catch (error) {
          console.error('[BotWS] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[BotWS] Error:', error);
      };

      ws.onclose = (ev) => {
        wsRef.current = null;
        if (cancelled) return;
        setConnectionStatus('disconnected');
        if (ev.code === 1008 || ev.code === 1003) {
          clearBotAuthTokenCache();
        }
        if (!allowReconnectRef.current) return;
        const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(attempt++, 5)));
        clearTimer();
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    void connect();

    return () => {
      cancelled = true;
      clearTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionKey]);

  const disconnect = useCallback(() => {
    allowReconnectRef.current = false;
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    allowReconnectRef.current = true;
    clearBotAuthTokenCache();
    setSessionKey((k) => k + 1);
  }, []);

  const on = useCallback((topic: string, callback: EventCallback) => {
    if (!callbacksRef.current.has(topic)) {
      callbacksRef.current.set(topic, new Set());
    }
    callbacksRef.current.get(topic)!.add(callback);

    return () => {
      callbacksRef.current.get(topic)?.delete(callback);
    };
  }, []);

  return {
    connected: connectionStatus === 'connected',
    connectionStatus,
    on,
    disconnect,
    reconnect,
  };
}
