/**
 * User Lookup Utilities
 * 
 * Provides robust user and account lookup with multiple fallback strategies.
 * Handles the complexity of Discord snowflake IDs vs internal database UUIDs.
 */

import { prisma } from './db';

// Types
export interface UserWithAccounts {
  id: string;
  discordId: string | null;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
  role: number;
  createdAt: Date;
  updatedAt: Date;
  accounts: DiscordAccount[];
}

export interface DiscordAccount {
  id: string;
  providerAccountId: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
}

export interface UserLookupResult {
  user: UserWithAccounts;
  primaryDiscordAccount: DiscordAccount | null;
  discordId: string | null;
  lookupMethod: 'discord_snowflake' | 'internal_uuid' | 'user_discord_id' | 'email';
}

// Logger for user lookup operations
const lookupLogger = {
  info: (message: string, data?: Record<string, unknown>) => {
    console.log(`[USER-LOOKUP][INFO] ${message}`, data ? JSON.stringify(data) : '');
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    console.warn(`[USER-LOOKUP][WARN] ${message}`, data ? JSON.stringify(data) : '');
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    console.error(`[USER-LOOKUP][ERROR] ${message}`, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      ...data
    });
  },
  debug: (message: string, data?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(`[USER-LOOKUP][DEBUG] ${message}`, data ? JSON.stringify(data) : '');
    }
  },
};

/**
 * Validates if a string is a valid Discord snowflake ID
 * Discord snowflakes are numeric strings between 17-19 characters
 */
export function isValidDiscordSnowflake(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  if (!/^\d{17,19}$/.test(id)) return false;
  
  try {
    const snowflake = BigInt(id);
    const timestamp = Number((snowflake >> BigInt(22))) + 1420070400000;
    const now = Date.now();
    const maxFuture = now + (50 * 365 * 24 * 60 * 60 * 1000);
    return timestamp >= 1420070400000 && timestamp < maxFuture;
  } catch {
    return false;
  }
}

/**
 * Validates if a string is a valid CUID (internal database ID)
 * CUIDs start with 'c' and contain alphanumeric characters
 */
export function isValidCUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // CUID pattern: starts with 'c', followed by alphanumeric characters
  return /^c[a-z0-9]{20,30}$/i.test(id);
}

/**
 * Validates if a string is a valid UUID
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Determines the type of ID provided
 */
export function identifyIdType(id: string): 'discord_snowflake' | 'cuid' | 'uuid' | 'unknown' {
  if (isValidDiscordSnowflake(id)) return 'discord_snowflake';
  if (isValidCUID(id)) return 'cuid';
  if (isValidUUID(id)) return 'uuid';
  return 'unknown';
}

/**
 * Comprehensive user lookup with multiple strategies and fallbacks
 * 
 * Lookup strategies (in order):
 * 1. By Discord snowflake (providerAccountId in Account table)
 * 2. By Discord snowflake (discordId in User table)
 * 3. By internal UUID/CUID (User.id)
 * 
 * Includes automatic data repair for corrupted providerAccountId values
 */
export async function findUserByIdentifier(identifier: string): Promise<UserLookupResult | null> {
  const operationId = `lookup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  lookupLogger.debug(`[${operationId}] Starting user lookup`, { identifier });
  
  const idType = identifyIdType(identifier);
  lookupLogger.debug(`[${operationId}] Identified ID type`, { identifier, idType });
  
  // Strategy 1: If it looks like a Discord snowflake, search by providerAccountId
  if (idType === 'discord_snowflake') {
    lookupLogger.debug(`[${operationId}] Strategy 1: Searching by Discord snowflake in Account table`);
    
    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'discord',
          providerAccountId: identifier,
        },
      },
      include: {
        user: {
          include: {
            accounts: {
              where: { provider: 'discord' },
            },
          },
        },
      },
    });
    
    if (account?.user) {
      lookupLogger.info(`[${operationId}] Found user by Discord snowflake (Account.providerAccountId)`, {
        userId: account.user.id,
        discordId: identifier,
        duration: Date.now() - startTime,
      });
      
      return {
        user: {
          ...account.user,
          accounts: account.user.accounts.map(acc => ({
            id: acc.id,
            providerAccountId: acc.providerAccountId,
            access_token: acc.access_token,
            refresh_token: acc.refresh_token,
            expires_at: acc.expires_at,
            token_type: acc.token_type,
            scope: acc.scope,
          })),
        },
        primaryDiscordAccount: {
          id: account.id,
          providerAccountId: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
          token_type: account.token_type,
          scope: account.scope,
        },
        discordId: identifier,
        lookupMethod: 'discord_snowflake',
      };
    }
    
    // Also check User.discordId as fallback
    lookupLogger.debug(`[${operationId}] Strategy 1b: Searching by Discord snowflake in User.discordId`);
    
    const userByDiscordId = await prisma.user.findUnique({
      where: { discordId: identifier },
      include: {
        accounts: {
          where: { provider: 'discord' },
        },
      },
    });
    
    if (userByDiscordId) {
      lookupLogger.info(`[${operationId}] Found user by Discord snowflake (User.discordId)`, {
        userId: userByDiscordId.id,
        discordId: identifier,
        hasAccount: userByDiscordId.accounts.length > 0,
        duration: Date.now() - startTime,
      });
      
      // Check if we need to repair the Account table
      if (userByDiscordId.accounts.length === 0) {
        lookupLogger.warn(`[${operationId}] User has discordId but no Account record - data inconsistency detected`);
      } else {
        // Validate providerAccountId is correct
        const primaryAccount = userByDiscordId.accounts[0];
        if (primaryAccount.providerAccountId !== identifier) {
          lookupLogger.warn(`[${operationId}] providerAccountId mismatch - attempting repair`, {
            expected: identifier,
            actual: primaryAccount.providerAccountId,
          });
          
          // Attempt to repair the providerAccountId
          try {
            await prisma.account.update({
              where: { id: primaryAccount.id },
              data: { providerAccountId: identifier },
            });
            lookupLogger.info(`[${operationId}] Successfully repaired providerAccountId`);
            
            // Update the local object
            primaryAccount.providerAccountId = identifier;
          } catch (repairError) {
            lookupLogger.error(`[${operationId}] Failed to repair providerAccountId`, repairError);
          }
        }
      }
      
      return {
        user: {
          ...userByDiscordId,
          accounts: userByDiscordId.accounts.map(acc => ({
            id: acc.id,
            providerAccountId: acc.providerAccountId,
            access_token: acc.access_token,
            refresh_token: acc.refresh_token,
            expires_at: acc.expires_at,
            token_type: acc.token_type,
            scope: acc.scope,
          })),
        },
        primaryDiscordAccount: userByDiscordId.accounts[0] ? {
          id: userByDiscordId.accounts[0].id,
          providerAccountId: userByDiscordId.accounts[0].providerAccountId,
          access_token: userByDiscordId.accounts[0].access_token,
          refresh_token: userByDiscordId.accounts[0].refresh_token,
          expires_at: userByDiscordId.accounts[0].expires_at,
          token_type: userByDiscordId.accounts[0].token_type,
          scope: userByDiscordId.accounts[0].scope,
        } : null,
        discordId: identifier,
        lookupMethod: 'user_discord_id',
      };
    }
  }
  
  // Strategy 2: If it looks like an internal ID (CUID or UUID), search by User.id
  if (idType === 'cuid' || idType === 'uuid') {
    lookupLogger.debug(`[${operationId}] Strategy 2: Searching by internal ID in User table`);
    
    const userById = await prisma.user.findUnique({
      where: { id: identifier },
      include: {
        accounts: {
          where: { provider: 'discord' },
        },
      },
    });
    
    if (userById) {
      const discordAccount = userById.accounts[0];
      
      // Determine the actual Discord ID
      let actualDiscordId: string | null = null;
      
      if (discordAccount) {
        // Validate providerAccountId is a proper Discord snowflake
        if (isValidDiscordSnowflake(discordAccount.providerAccountId)) {
          actualDiscordId = discordAccount.providerAccountId;
        } else {
          lookupLogger.warn(`[${operationId}] Invalid providerAccountId in database`, {
            providerAccountId: discordAccount.providerAccountId,
            userId: userById.id,
          });
          
          // Try to use User.discordId as fallback
          if (userById.discordId && isValidDiscordSnowflake(userById.discordId)) {
            actualDiscordId = userById.discordId;
            
            // Attempt to repair the providerAccountId
            try {
              await prisma.account.update({
                where: { id: discordAccount.id },
                data: { providerAccountId: actualDiscordId },
              });
              lookupLogger.info(`[${operationId}] Repaired providerAccountId from User.discordId`);
              
              // Update local object
              discordAccount.providerAccountId = actualDiscordId;
            } catch (repairError) {
              lookupLogger.error(`[${operationId}] Failed to repair providerAccountId`, repairError);
            }
          }
        }
      } else if (userById.discordId && isValidDiscordSnowflake(userById.discordId)) {
        actualDiscordId = userById.discordId;
        lookupLogger.warn(`[${operationId}] User has discordId but no Account record`);
      }
      
      lookupLogger.info(`[${operationId}] Found user by internal ID`, {
        userId: userById.id,
        discordId: actualDiscordId,
        hasAccount: userById.accounts.length > 0,
        duration: Date.now() - startTime,
      });
      
      return {
        user: {
          ...userById,
          accounts: userById.accounts.map(acc => ({
            id: acc.id,
            providerAccountId: acc.providerAccountId,
            access_token: acc.access_token,
            refresh_token: acc.refresh_token,
            expires_at: acc.expires_at,
            token_type: acc.token_type,
            scope: acc.scope,
          })),
        },
        primaryDiscordAccount: discordAccount ? {
          id: discordAccount.id,
          providerAccountId: discordAccount.providerAccountId,
          access_token: discordAccount.access_token,
          refresh_token: discordAccount.refresh_token,
          expires_at: discordAccount.expires_at,
          token_type: discordAccount.token_type,
          scope: discordAccount.scope,
        } : null,
        discordId: actualDiscordId,
        lookupMethod: 'internal_uuid',
      };
    }
  }
  
  // Strategy 3: Brute force search (for unknown ID types or edge cases)
  lookupLogger.debug(`[${operationId}] Strategy 3: Brute force search`);
  
  // Try to find by providerAccountId regardless of ID type validation
  const accountByAnyId = await prisma.account.findFirst({
    where: {
      provider: 'discord',
      OR: [
        { providerAccountId: identifier },
        { user: { discordId: identifier } },
        { user: { id: identifier } },
      ],
    },
    include: {
      user: {
        include: {
          accounts: {
            where: { provider: 'discord' },
          },
        },
      },
    },
  });
  
  if (accountByAnyId?.user) {
    const actualDiscordId = isValidDiscordSnowflake(accountByAnyId.providerAccountId)
      ? accountByAnyId.providerAccountId
      : (accountByAnyId.user.discordId && isValidDiscordSnowflake(accountByAnyId.user.discordId)
          ? accountByAnyId.user.discordId
          : null);
    
    lookupLogger.info(`[${operationId}] Found user via brute force search`, {
      userId: accountByAnyId.user.id,
      discordId: actualDiscordId,
      duration: Date.now() - startTime,
    });
    
    return {
      user: {
        ...accountByAnyId.user,
        accounts: accountByAnyId.user.accounts.map(acc => ({
          id: acc.id,
          providerAccountId: acc.providerAccountId,
          access_token: acc.access_token,
          refresh_token: acc.refresh_token,
          expires_at: acc.expires_at,
          token_type: acc.token_type,
          scope: acc.scope,
        })),
      },
      primaryDiscordAccount: {
        id: accountByAnyId.id,
        providerAccountId: accountByAnyId.providerAccountId,
        access_token: accountByAnyId.access_token,
        refresh_token: accountByAnyId.refresh_token,
        expires_at: accountByAnyId.expires_at,
        token_type: accountByAnyId.token_type,
        scope: accountByAnyId.scope,
      },
      discordId: actualDiscordId,
      lookupMethod: 'internal_uuid', // Could be any, but we found it
    };
  }
  
  lookupLogger.warn(`[${operationId}] User not found with any strategy`, {
    identifier,
    idType,
    duration: Date.now() - startTime,
  });
  
  return null;
}

/**
 * Ensures a user has valid Discord account data
 * Creates or repairs account records as needed
 */
export async function ensureUserDiscordData(
  userId: string,
  discordId: string,
  tokens?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }
): Promise<{ success: boolean; account?: DiscordAccount; error?: string }> {
  const operationId = `ensure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  lookupLogger.info(`[${operationId}] Ensuring user Discord data`, { userId, discordId });
  
  if (!isValidDiscordSnowflake(discordId)) {
    lookupLogger.error(`[${operationId}] Invalid Discord snowflake`, { discordId });
    return { success: false, error: 'Invalid Discord ID format' };
  }
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Update user's discordId if needed
      await tx.user.update({
        where: { id: userId },
        data: { discordId },
      });
      
      // Find or create Discord account
      let account = await tx.account.findFirst({
        where: {
          userId,
          provider: 'discord',
        },
      });
      
      if (account) {
        // Update existing account
        account = await tx.account.update({
          where: { id: account.id },
          data: {
            providerAccountId: discordId,
            ...(tokens && {
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
              token_type: tokens.token_type,
              scope: tokens.scope,
            }),
          },
        });
      } else if (tokens) {
        // Create new account
        account = await tx.account.create({
          data: {
            userId,
            type: 'oauth',
            provider: 'discord',
            providerAccountId: discordId,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
            token_type: tokens.token_type,
            scope: tokens.scope,
          },
        });
      }
      
      return account;
    });
    
    lookupLogger.info(`[${operationId}] Successfully ensured Discord data`);
    
    return {
      success: true,
      account: result ? {
        id: result.id,
        providerAccountId: result.providerAccountId,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        expires_at: result.expires_at,
        token_type: result.token_type,
        scope: result.scope,
      } : undefined,
    };
  } catch (error) {
    lookupLogger.error(`[${operationId}] Failed to ensure Discord data`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Scans and repairs corrupted account data
 * Returns statistics about repairs made
 */
export async function repairCorruptedAccounts(): Promise<{
  scanned: number;
  repaired: number;
  errors: Array<{ userId: string; error: string }>;
}> {
  const stats = {
    scanned: 0,
    repaired: 0,
    errors: [] as Array<{ userId: string; error: string }>,
  };
  
  lookupLogger.info('Starting account repair scan');
  
  // Find all users with discord accounts
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { discordId: { not: null } },
        { accounts: { some: { provider: 'discord' } } },
      ],
    },
    include: {
      accounts: {
        where: { provider: 'discord' },
      },
    },
  });
  
  stats.scanned = users.length;
  
  for (const user of users) {
    try {
      const account = user.accounts[0];
      
      // Case 1: User has discordId but no account
      if (user.discordId && !account) {
        lookupLogger.warn(`User ${user.id} has discordId but no account - creating account`);
        
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: 'discord',
            providerAccountId: user.discordId,
          },
        });
        
        stats.repaired++;
        continue;
      }
      
      // Case 2: Account has invalid providerAccountId but user has valid discordId
      if (account && user.discordId && !isValidDiscordSnowflake(account.providerAccountId)) {
        if (isValidDiscordSnowflake(user.discordId)) {
          lookupLogger.warn(`Repairing invalid providerAccountId for user ${user.id}`, {
            invalid: account.providerAccountId,
            valid: user.discordId,
          });
          
          await prisma.account.update({
            where: { id: account.id },
            data: { providerAccountId: user.discordId },
          });
          
          stats.repaired++;
        }
      }
      
      // Case 3: Account has valid providerAccountId but user.discordId is wrong or null
      if (account && isValidDiscordSnowflake(account.providerAccountId)) {
        if (user.discordId !== account.providerAccountId) {
          lookupLogger.warn(`Updating user.discordId for user ${user.id}`, {
            old: user.discordId,
            new: account.providerAccountId,
          });
          
          await prisma.user.update({
            where: { id: user.id },
            data: { discordId: account.providerAccountId },
          });
          
          stats.repaired++;
        }
      }
    } catch (error) {
      stats.errors.push({
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
  
  lookupLogger.info('Account repair scan completed', stats);
  
  return stats;
}
