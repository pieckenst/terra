import { prisma } from './db';
import { bus } from './events';

/**
 * Log sink that persists logs to the database and broadcasts via event bus.
 * Wraps consola/console calls to also store in BotLog table.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

export async function writeLog(level: LogLevel, message: string, context?: string) {
  try {
    // Store in database
    await prisma.botLog.create({
      data: {
        level,
        message,
        context: context || null,
      },
    });

    // Emit to event bus for WebSocket broadcast
    bus.emitTyped('log:new', {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // If DB fails, just console.error - don't break the app
    console.error('Failed to write log to database:', error);
  }
}

/**
 * Prune old logs to prevent database bloat.
 * Keep only the last 10,000 logs.
 */
export async function pruneOldLogs() {
  try {
    const count = await prisma.botLog.count();
    if (count > 10000) {
      const oldestToKeep = await prisma.botLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: 10000,
        take: 1,
        select: { id: true },
      });

      if (oldestToKeep.length > 0) {
        await prisma.botLog.deleteMany({
          where: {
            id: {
              lt: oldestToKeep[0].id,
            },
          },
        });
      }
    }
  } catch (error) {
    console.error('Failed to prune old logs:', error);
  }
}

// Run pruning every hour
setInterval(pruneOldLogs, 60 * 60 * 1000);
