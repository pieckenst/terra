import { prisma } from './db';

export async function logEvent(
  eventName: string,
  details: {
    userId: string;
    guildId?: string;
    commandName?: string;
    [key: string]: any;
  }
) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventName,
        userId: details.userId,
        guildId: details.guildId,
        commandName: details.commandName,
      },
    });
  } catch (error) {
    console.error('Failed to log analytics event:', error);
  }
}

export async function logCommandUsed(
  userId: string,
  guildId: string | undefined,
  commandName: string
) {
  return logEvent('command_used', { userId, guildId, commandName });
}

export async function logCommandSuccess(
  userId: string,
  guildId: string | undefined,
  commandName: string
) {
  return logEvent('command_success', { userId, guildId, commandName });
}

export async function logCommandError(
  userId: string,
  guildId: string | undefined,
  commandName: string,
  error: string
) {
  return logEvent('command_error', { userId, guildId, commandName, error });
}
