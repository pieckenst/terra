const API_BASE_URL = 'http://localhost:3001/api';

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
  const url = `${API_BASE_URL}/featureflags`;
  try {
    const response = await fetch(url, {
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
  topCommands: { name: string; count: number }[];
  topUsers: { id: string; count: number }[];
  topGuilds: { id: string; count: number }[];
  dailyUsage: { date: string; count: number }[];
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
  username: string;
  discriminator: string;
  avatar: string | null;
  email: string;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  guilds: Array<{
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: number;
    features: string[];
    permissions_new: string;
  }>;
}

export interface BotStats {
  totalServers: number;
  totalMembers: number;
  activeUsers: number;
  totalCommands: number;
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
): Promise<{ data: UserProfile | null; error?: string }> {
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
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        return { 
          data: null, 
          error: 'Request timed out. Please try again.' 
        };
      }
      throw error; // Re-throw other errors
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // Handle 401 Unauthorized
      if (response.status === 401) {
        return { 
          data: null, 
          error: 'Authentication required. Please sign in again.' 
        };
      }
      
      // Try to parse error response
      try {
        const errorData = await response.json();
        return { 
          data: null, 
          error: errorData.message || `Failed to fetch user profile: ${response.statusText}`,
        };
      } catch (parseError) {
        return { 
          data: null, 
          error: `Failed to fetch user profile: ${response.statusText}`,
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
      
      // If avatar is missing, try to get it from session or construct from available data
      if (!data.avatar || data.avatar === '') {
        // Try session image first
        if (session?.user?.image) {
          data.avatar = session.user.image;
        } 
        // Fallback to default Discord avatar based on discriminator
        else if (data.discriminator) {
          const defaultAvatarIndex = parseInt(data.discriminator) % 5;
          data.avatar = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
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
