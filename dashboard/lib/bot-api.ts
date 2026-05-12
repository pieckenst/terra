import { clearBotAuthTokenCache, getBotAuthToken } from './bot-auth-token';

const API_ROOT = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:3001';
const API_BASE_URL = `${API_ROOT}/api`;

// Enhanced fetch wrapper that returns errors instead of throwing them
async function fetchWithErrorHandling(url: string, options: RequestInit = {}): Promise<{ response: Response | null; error?: string; status?: number }> {
  try {
    const response = await fetch(url, { ...options, cache: 'no-store' });
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      // Try to parse error response for more details
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // Ignore JSON parse errors
      }
      
      return { response: null, error: errorMessage, status: response.status };
    }
    
    return { response, error: undefined };
  } catch (error) {
    // Return error instead of throwing
    return { 
      response: null, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

async function botFetchAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const send = async () => {
    const headers = new Headers(init.headers);
    const token = await getBotAuthToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(url, {
      ...init,
      headers,
      credentials: 'include',
      cache: init.cache ?? 'no-store'
    });
  };

  let res = await send();
  if (res.status === 401) {
    clearBotAuthTokenCache();
    res = await send();
  }
  return res;
}

export interface Server {
  id: string;
  name: string;
  memberCount: number;
}

export interface GetServersResponse {
  servers: Server[];
  newOffset: number;
  totalServers: number;
}

export interface Command {
  name: string;
  description: string;
  category: string;
}

export async function getCommands(): Promise<Command[]> {
  const url = `${API_BASE_URL}/commands`;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch commands:', response.statusText);
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching commands:', error);
    return [];
  }
}

export async function getServers(
  searchTerm: string = '',
  offset: number = 0
): Promise<GetServersResponse> {
  const url = new URL(`${API_BASE_URL}/servers`);
  if (searchTerm) {
    url.searchParams.append('q', searchTerm);
  }
  if (offset) {
    url.searchParams.append('offset', offset.toString());
  }

  try {
    const response = await fetch(url.toString(), {
      cache: 'no-store', // Ensure fresh data on every request
    });

    if (!response.ok) {
      console.error('Failed to fetch servers:', response.statusText);
      return { servers: [], newOffset: 0, totalServers: 0 };
    }

    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching servers:', error);
    return { servers: [], newOffset: 0, totalServers: 0 };
  }
}

export interface ServerDetails extends Server {
  iconUrl: string | null;
  channelCount: number;
  roleCount: number;
  createdAt: number; // Unix timestamp
}

export interface ServerCommand extends Command {
  enabled: boolean;
}

export async function getServerDetails(serverId: string): Promise<ServerDetails | null> {
  const url = `${API_BASE_URL}/servers/${serverId}`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch server details:', response.statusText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching server details:', error);
    return null;
  }
}

export async function getServerCommands(serverId: string): Promise<ServerCommand[]> {
  const url = `${API_BASE_URL}/servers/${serverId}/commands`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch server commands:', response.statusText);
      return [];
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching server commands:', error);
    return [];
  }
}

export interface FeatureFlags {
  useDatabase?: 'sqlite' | 'postgres' | 'prisma' | 'none';
  devMode?: boolean;
  disabledCommands?: string[];
  betaCommands?: string[];
}

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const url = `${API_BASE_URL}/featureflags`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch feature flags:', response.statusText);
      return {};
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching feature flags:', error);
    return {};
  }
}

export async function restartBot(): Promise<{ success: boolean; message?: string }> {
  const url = `${API_BASE_URL}/bot/restart`;
  try {
    const response = await fetch(url, {
      method: 'POST',
    });
    if (!response.ok) {
      console.error('Failed to restart bot:', response.statusText);
      return { success: false, message: 'Failed to send restart command.' };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while restarting the bot:', error);
    return { success: false, message: 'An error occurred.' };
  }
}

export async function updateFeatureFlags(
  flags: FeatureFlags
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await botFetchAuth('/featureflags', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(flags),
    });
    if (!response.ok) {
      console.error('Failed to update feature flags:', response.statusText);
      return { success: false };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while updating feature flags:', error);
    return { success: false };
  }
}

export interface User {
  id: string;
  isAdmin: boolean;
  isBlocked: boolean;
  username: string;
  discriminator: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getUsers(): Promise<User[]> {
  const url = `${API_BASE_URL}/users`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch users:', response.statusText);
      return [];
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching users:', error);
    return [];
  }
}

export async function addUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const url = `${API_BASE_URL}/users/${userId}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}), // Upsert is handled by the server
    });
    return response.json();
  } catch (error) {
    console.error('An error occurred while adding a user:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export async function updateUser(
  userId: string,
  data: { isAdmin?: boolean; isBlocked?: boolean }
): Promise<{ success: boolean; user?: User; error?: string }> {
  const url = `${API_BASE_URL}/users/${userId}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
        const responseData = await response.json();

    if (!response.ok) {
      console.error('Failed to update user:', responseData.error || response.statusText);
      return { success: false, error: responseData.error || 'An unknown error occurred.' };
    }
    
    return responseData;
  } catch (error) {
    console.error('An error occurred while updating user:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

export interface AnalyticsData {
  totalCommands: number;
  totalCommandsLast7Days: number;
  totalCommandsLast30Days: number;
  topCommands: { name: string; count: number }[];
  topCommandsLast7Days: { name: string; count: number }[];
  topUsers: { id: string; count: number }[];
  topUsersLast7Days: { id: string; count: number }[];
  topGuilds: { id: string; count: number }[];
  topGuildsLast7Days: { id: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
  dailyUsage30Days: { date: string; count: number }[];
  hourlyUsageToday: { hour: number; count: number }[];
  successfulCommands: number;
  failedCommands: number;
  successRate: number;
  uniqueUsersLast7Days: number;
  uniqueGuildsLast7Days: number;
}

export async function getAnalytics(): Promise<AnalyticsData | null> {
  const url = `${API_BASE_URL}/analytics`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch analytics:', response.statusText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching analytics:', error);
    return null;
  }
}

export interface UserProfile {
  id: string;
  /** Discord snowflake when linked */
  discordUserId?: string | null;
  username: string;
  discriminator: string;
  globalName?: string | null;
  avatar: string | null;
  avatarHash?: string | null;
  email: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  premiumType?: number | null;
  verified?: boolean | null;
  locale?: string | null;
  mfaEnabled?: boolean | null;
  guilds: Array<{
    id: string;
    name: string;
    /** Raw hash from Discord, or null if no icon */
    icon: string | null;
    /** Resolved CDN URL (preferred for img src) */
    iconUrl?: string | null;
    owner: boolean;
    permissions: number;
    features: string[];
    permissions_new: string;
    hasBot?: boolean;
    canManage?: boolean;
  }>;
}

export interface MutualServer {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  isOwner: boolean;
  hasBot: boolean;
}

export interface MutualServersResponse {
  userId: string;
  mutualServers: MutualServer[];
  totalMutualServers: number;
  totalUserGuilds: number;
  totalBotGuilds: number;
}

export interface BotStats {
  totalServers: number;
  totalMembers: number;
  activeUsers: number;
  totalCommands: number;
  uptime?: {
    milliseconds: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  };
}

interface FetchError extends Error {
  status?: number;
  statusText?: string;
  details?: any;
}

interface DiscordAccount {
  provider: string;
  access_token?: string;
  [key: string]: any;
}

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  accessToken?: string;
  accounts?: DiscordAccount[];
  [key: string]: any;
}

interface GetUserProfileSession {
  user?: SessionUser;
  accessToken?: string;
}

export async function getUserProfile(
  userId: string, 
  session?: GetUserProfileSession
): Promise<{ data: UserProfile | null; error?: string; requiresReauth?: boolean; details?: string }> {
  try {
    // Get access token from session
    const accessToken = session?.user?.accessToken || session?.accessToken;
    
    // Get the Discord account from the user's accounts
    const discordAccount = session?.user?.accounts?.find(acc => acc.provider === 'discord');
    
    // Use the providerAccountId from the Discord account, fall back to userId if not available
    const discordId = discordAccount?.providerAccountId || userId;
    
    const url = `${API_BASE_URL}/users/${discordId}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Create a controller with a longer timeout (10 seconds)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    let response;
    try {
      response = await fetch(url, { 
        headers,
        cache: 'no-store',
        signal: controller.signal,
        keepalive: true
      });
    } catch (error: any) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        console.warn('[getUserProfile] Request timed out');
        return { 
          data: null, 
          error: 'Request timed out. Please try again.' 
        };
      }
      console.warn('[getUserProfile] Network error:', error);
      return { 
        data: null, 
        error: 'Network error. Please check your connection.' 
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        // Try to parse error response to check for requiresReauth flag
        try {
          const errorData = await response.json();
          if (errorData.requiresReauth) {
            // Redirect to login to force re-authentication
            if (typeof window !== 'undefined') {
              window.location.href = '/login?error=session_expired';
            }
            return { 
              data: null, 
              error: errorData.details || 'Your Discord session has expired. Please re-authenticate.',
              requiresReauth: true
            };
          }
          return { 
            data: null, 
            error: errorData.details || 'Authentication required. Please sign in again.' 
          };
        } catch {
          return { 
            data: null, 
            error: 'Authentication required. Please sign in again.' 
          };
        }
      }
      
      // Handle rate limit errors
      if (response.status === 429) {
        return { 
          data: null, 
          error: 'Rate limit exceeded. Please wait a moment and try again.' 
        };
      }
      
      // Try to parse error response
      try {
        const errorData = await response.json();
        return { 
          data: null, 
          error: errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          details: errorData.details
        };
      } catch {
        return { 
          data: null, 
          error: `HTTP ${response.status}: ${response.statusText}` 
        };
      }
    }

    // Parse successful response
    try {
      const data = await response.json();
      
      // If username is missing but we have it in session, use that as fallback
      if ((!data.username || data.username === '') && session?.user?.name) {
        data.username = session.user.name;
      }
      
      // If discriminator is missing but we have it in session, use that as fallback
      if ((!data.discriminator || data.discriminator === '0') && session?.user?.discriminator) {
        data.discriminator = session.user.discriminator;
      }
      
      // If avatar is missing or empty, construct it from session or fallback
      if (!data.avatar || data.avatar === '') {
        // Try session image first
        if (session?.user?.image) {
          data.avatar = session.user.image;
        } 
        // Fallback to default Discord avatar based on user ID or discriminator
        else {
          const snowflake = data.discordUserId || session?.user?.discordId;
          const discriminator = data.discriminator || '0';
          if (snowflake && /^\d{5,}$/.test(String(snowflake))) {
            const sid = String(snowflake);
            if (discriminator === '0') {
              const avatarIndex = Number(BigInt(sid) >> BigInt(22)) % 6;
              data.avatar = `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png`;
            } else {
              const avatarIndex = parseInt(discriminator, 10) % 5;
              data.avatar = `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png`;
            }
          }
        }
      }
      
      return { data };
    } catch (parseError) {
      console.error('Failed to parse user profile response:', parseError);
      return { 
        data: null, 
        error: 'Failed to parse user profile data',
      };
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

export interface PermissionsData {
  botOwnerId: string;
  admins: Array<{
    id: string;
    discordId: string | null;
    name: string | null;
    email: string | null;
    role: number;
    isAdmin: boolean;
    isBlocked: boolean;
  }>;
  moderators: Array<{
    id: string;
    discordId: string | null;
    name: string | null;
    email: string | null;
    role: number;
    isAdmin: boolean;
    isBlocked: boolean;
  }>;
}

export async function getPermissions(): Promise<PermissionsData | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/permissions`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch permissions:', response.statusText);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching permissions:', error);
    return null;
  }
}

export async function getStats(): Promise<BotStats | null> {
  const url = `${API_BASE_URL}/stats`;
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('Failed to fetch stats:', response.statusText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching stats:', error);
    return null;
  }
}

export async function getMutualServers(
  userId: string
): Promise<{ data: MutualServersResponse | null; error?: string; requiresReauth?: boolean }> {
  const url = `${API_BASE_URL}/users/${userId}/mutual-servers`;
  console.log('[BOT-API] Fetching mutual servers from:', url);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    console.log('[BOT-API] Mutual servers response status:', response.status);
    
    if (!response.ok) {
      // Handle 401 Unauthorized with requiresReauth flag
      if (response.status === 401) {
        try {
          const errorData = await response.json();
          if (errorData.requiresReauth) {
            console.warn('[BOT-API] Discord session expired, redirecting to login');
            // Redirect to login to force re-authentication
            if (typeof window !== 'undefined') {
              window.location.href = '/login?error=session_expired';
            }
            return { 
              data: null, 
              error: errorData.details || 'Your Discord session has expired. Please re-authenticate.',
              requiresReauth: true
            };
          }
        } catch {
          // Ignore parse errors
        }
      }
      
      // Handle rate limit errors
      if (response.status === 429) {
        return { 
          data: null, 
          error: 'Rate limit exceeded. Please wait a moment and try again.' 
        };
      }
      
      // Return error instead of throwing
      return { 
        data: null, 
        error: `Failed to fetch mutual servers: ${response.statusText}` 
      };
    }
    
    const data = await response.json();
    console.log('[BOT-API] Mutual servers data:', data);
    return { data };
  } catch (error) {
    console.error('An error occurred while fetching mutual servers:', error);
    // Return error instead of throwing
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
}

export async function updateServerCommandStatus(
  serverId: string,
  commandName: string,
  enabled: boolean
): Promise<{ success: boolean }> {
  const url = `${API_BASE_URL}/servers/${serverId}/commands`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ commandName, enabled }),
    });
    if (!response.ok) {
      console.error('Failed to update command status:', response.statusText);
      return { success: false };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while updating command status:', error);
    return { success: false };
  }
}

// Guild Settings
export interface GuildSettings {
  guildId: string;
  prefix?: string;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  modLogChannelId?: string;
  autoRoleId?: string;
  disabledChannels?: string;
  updatedAt?: string;
}

export async function getGuildSettings(serverId: string): Promise<GuildSettings | null> {
  const url = `${API_BASE_URL}/servers/${serverId}/settings`;
  try {
    const response = await fetch(url, { cache: 'no-store', credentials: 'include' });
    if (!response.ok) {
      console.error('Failed to fetch guild settings:', response.statusText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching guild settings:', error);
    return null;
  }
}

export async function updateGuildSettings(
  serverId: string,
  settings: Partial<GuildSettings>
): Promise<{ success: boolean; data?: GuildSettings; error?: string }> {
  try {
    const response = await botFetchAuth(`/servers/${serverId}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      let message = response.statusText;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody?.error) message = errBody.error;
      } catch {
        /* ignore */
      }
      console.error('Failed to update guild settings:', message);
      return { success: false, error: message };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('An error occurred while updating guild settings:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Moderation Actions
export async function kickMember(
  serverId: string,
  userId: string,
  reason?: string
): Promise<{ success: boolean }> {
  try {
    const response = await botFetchAuth(`/servers/${serverId}/moderation/kick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason }),
    });
    if (!response.ok) {
      console.error('Failed to kick member:', response.statusText);
      return { success: false };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while kicking member:', error);
    return { success: false };
  }
}

export async function banMember(
  serverId: string,
  userId: string,
  deleteMessageDays?: number,
  reason?: string
): Promise<{ success: boolean }> {
  try {
    const response = await botFetchAuth(`/servers/${serverId}/moderation/ban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deleteMessageDays, reason }),
    });
    if (!response.ok) {
      console.error('Failed to ban member:', response.statusText);
      return { success: false };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while banning member:', error);
    return { success: false };
  }
}

export async function timeoutMember(
  serverId: string,
  userId: string,
  seconds: number,
  reason?: string
): Promise<{ success: boolean }> {
  try {
    const response = await botFetchAuth(`/servers/${serverId}/moderation/timeout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, seconds, reason }),
    });
    if (!response.ok) {
      console.error('Failed to timeout member:', response.statusText);
      return { success: false };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while timing out member:', error);
    return { success: false };
  }
}

// Owner-only endpoints
export interface BotLog {
  id: number;
  level: string;
  message: string;
  context?: string;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorId: string;
  action: string;
  target?: string;
  guildId?: string;
  metadata?: string;
  createdAt: string;
}

export async function getBotLogs(
  since?: string,
  limit: number = 200
): Promise<BotLog[]> {
  const q = new URLSearchParams();
  if (since) q.set('since', since);
  q.set('limit', limit.toString());

  try {
    const response = await botFetchAuth(`/owner/logs?${q.toString()}`);
    if (!response.ok) {
      console.error('Failed to fetch bot logs:', response.statusText);
      return [];
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching bot logs:', error);
    return [];
  }
}

export async function getAuditLog(limit: number = 200): Promise<AuditLog[]> {
  const q = new URLSearchParams();
  q.set('limit', limit.toString());

  try {
    const response = await botFetchAuth(`/owner/audit?${q.toString()}`);
    if (!response.ok) {
      console.error('Failed to fetch audit log:', response.statusText);
      return [];
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while fetching audit log:', error);
    return [];
  }
}

export async function reloadCommands(commandName?: string): Promise<{ success: boolean }> {
  try {
    const response = await botFetchAuth('/owner/commands/reload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: commandName }),
    });
    if (!response.ok) {
      console.error('Failed to reload commands:', response.statusText);
      return { success: false };
    }
    return response.json();
  } catch (error) {
    console.error('An error occurred while reloading commands:', error);
    return { success: false };
  }
}

// WebSocket URL helper
export function getWebSocketUrl(token: string): string {
  const wsUrl = API_ROOT.replace(/^http/, 'ws');
  return `${wsUrl}/ws?token=${encodeURIComponent(token)}`;
}
