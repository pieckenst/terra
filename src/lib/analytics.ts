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
