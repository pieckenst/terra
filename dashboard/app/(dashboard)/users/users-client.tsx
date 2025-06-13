'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUsers, updateUser, addUser, User, getUserProfile } from '@/lib/bot-api';
import { toast } from 'sonner';

// ExtendedUser type that includes all required fields from User and additional profile fields
type ExtendedUser = User & {
  discriminator: string;
  avatar: string | null;
  avatarUrl: string | null;
  username: string;
  email: string | null;
  isAdmin: boolean;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  guilds?: Array<{
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
    permissions: number;
    features: string[];
    permissions_new: string;
  }>;
}

interface UsersClientProps {
  initialUsers: ExtendedUser[];
}

export default function UsersClient({ initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState<ExtendedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUserId, setNewUserId] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  /**
   * Formats a username with discriminator if available
   * @param user The user object
   * @returns Formatted username string
   */
  const formatUsername = (user: Pick<ExtendedUser, 'username' | 'discriminator' | 'id'>) => {
    const username = user.username || `User-${user.id?.slice(0, 4) || 'unknown'}`;
    return user.discriminator && user.discriminator !== '0' 
      ? `${username}#${user.discriminator}`
      : username;
  };

  /**
   * Generates an avatar URL with proper fallbacks
   * @param user The user object
   * @returns Avatar URL string
   */
  const getAvatarUrl = (user: Pick<ExtendedUser, 'avatar' | 'id' | 'discriminator' | 'avatarUrl'>) => {
    // Return pre-computed avatar URL if available
    if (user.avatarUrl) return user.avatarUrl;
    
    // Generate URL from avatar hash if available
    if (user.avatar && user.id) {
      const format = user.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${format}`;
    }
    
    // Fallback to default avatar based on discriminator
    if (user.discriminator && user.discriminator !== '0') {
      const defaultAvatarIndex = parseInt(user.discriminator) % 5;
      return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
    }
    
    // Final fallback
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  };

  /**
   * Normalizes user data to match ExtendedUser type
   */
  const normalizeUserData = (user: Partial<ExtendedUser> & { id: string }): ExtendedUser => {
    const now = new Date().toISOString();
    const discriminator = user.discriminator || '0';
    const username = user.username || `User-${user.id.slice(0, 4)}`;
    
    // Create base user object with required fields
    const baseUser = {
      id: user.id,
      username,
      discriminator,
      avatar: user.avatar || null,
      email: user.email || null,
      isAdmin: user.isAdmin || false,
      isBlocked: user.isBlocked || false,
      createdAt: user.createdAt || now,
      updatedAt: user.updatedAt || now,
      guilds: user.guilds || []
    };
    
    // Generate avatar URL with all required properties
    return {
      ...baseUser,
      avatarUrl: getAvatarUrl({
        id: baseUser.id,
        discriminator: baseUser.discriminator,
        avatar: baseUser.avatar,
        avatarUrl: null // Will be overridden by getAvatarUrl
      })
    };
  };

  /**
   * Fetches and normalizes user profile data
   */
  const fetchUserProfile = useCallback(async (userId: string): Promise<ExtendedUser | null> => {
    try {
      const { data: profile, error } = await getUserProfile(userId);
      
      if (error || !profile) {
        console.warn('Error fetching user profile:', error || 'No data returned');
        return null;
      }
      
      return normalizeUserData({
        ...profile,
        id: profile.id || userId, // Ensure we always have an ID
        discriminator: profile.discriminator || '0',
        username: profile.username || undefined,
        email: (profile as any).email,
        isAdmin: profile.isAdmin,
        isBlocked: profile.isBlocked,
        guilds: (profile as any).guilds
      });
    } catch (error) {
      console.error(`Failed to fetch profile for user ${userId}:`, error);
      return null;
    }
  }, []);

  // Load initial users with profile data
  useEffect(() => {
    const loadUsers = async () => {
      if (!isInitialLoad) return;
      
      try {
        setIsLoading(true);
        const usersList = await getUsers();
        
        // Fetch profile data for each user
        const usersWithProfiles = await Promise.all(
          usersList.map(async (user) => {
            // Use Discord ID if available, otherwise fall back to internal ID
            const userIdToFetch = (user as any).discordId || user.id;
            const profile = await fetchUserProfile(userIdToFetch);
            
            // If we have a valid profile, use it
            if (profile) {
              return {
                ...user,
                ...profile,
                // Ensure we don't override the ID with the Discord ID
                id: user.id,
              };
            }
            
            // Fallback to basic user data if profile fetch fails
            return {
              ...user,
              discriminator: (user as any).discriminator || '0',
              avatar: (user as any).avatar || null,
              username: user.username || `User-${user.id.slice(0, 4)}`,
              avatarUrl: (user as any).image || null,
              email: (user as any).email || null,
              isAdmin: (user as any).isAdmin || false,
              isBlocked: (user as any).isBlocked || false,
              createdAt: (user as any).createdAt || new Date().toISOString(),
              updatedAt: (user as any).updatedAt || new Date().toISOString(),
              guilds: []
            };
          })
        );
        
        // Update state with processed users
        setUsers(usersWithProfiles);
      } catch (error) {
        console.error('Failed to load users:', error);
        toast.error('Failed to load users. Please try again.');
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };
    
    loadUsers();
  }, [isInitialLoad, fetchUserProfile]);

  const handleToggleAdmin = async (user: User) => {
    const promise = updateUser(user.id, { isAdmin: !user.isAdmin });
    toast.promise(promise, {
      loading: 'Updating user...', 
      success: (data) => {
        if (data.success) {
          setUsers(users.map((u) => (u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u)));
          return 'User updated successfully!';
        }
        throw new Error(data.error || 'Failed to update user.');
      },
      error: (err) => err.message,
    });
  };

  const handleToggleBlocked = async (user: User) => {
    const promise = updateUser(user.id, { isBlocked: !user.isBlocked });
    toast.promise(promise, {
      loading: 'Updating user...', 
      success: (data) => {
        if (data.success) {
          setUsers(users.map((u) => (u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u)));
          return 'User updated successfully!';
        }
        throw new Error(data.error || 'Failed to update user.');
      },
      error: (err) => err.message,
    });
  };

  const transformUser = (user: User): ExtendedUser => {
    const now = new Date().toISOString();
    return {
      ...user,
      discriminator: (user as any).discriminator || '0',
      avatar: (user as any).avatar || null,
      username: user.username || `User-${user.id.slice(0, 4)}`,
      avatarUrl: null,
      email: (user as any).email || null,
      isAdmin: user.isAdmin || false,
      isBlocked: user.isBlocked || false,
      createdAt: (user as any).createdAt || now,
      updatedAt: (user as any).updatedAt || now,
      guilds: (user as any).guilds || []
    };
  };

  const handleAddUser = async () => {
    if (!newUserId.trim()) {
      toast.error('Please enter a valid User ID.');
      return;
    }
    const userId = newUserId.trim();
    const promise = addUser(userId);
    toast.promise(promise, {
      loading: 'Adding user...', 
      success: async (data) => {
        if (data.success) {
          setNewUserId('');
          // Fetch the new user's profile
          setIsLoading(true);
          try {
            const newUser = await fetchUserProfile(userId);
            if (newUser) {
              setUsers(prev => [...prev, newUser]);
            } else {
              // Fallback to basic user data if profile fetch fails
              const updatedUsers = await getUsers();
              const addedUser = updatedUsers.find(u => u.id === userId);
              if (addedUser) {
                const transformedUser = transformUser(addedUser);
                setUsers(prev => [...prev, transformedUser]);
              }
            }
            return 'User added successfully!';
          } catch (error) {
            console.error('Error adding user:', error);
            throw new Error('Failed to load user data after adding.');
          } finally {
            setIsLoading(false);
          }
        }
        throw new Error(data.error || 'Failed to add user.');
      },
      error: (err) => err.message,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Manage user permissions and access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Enter User ID to add"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleAddUser}>Add User</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Is Admin</TableHead>
              <TableHead>Is Blocked</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-10 w-10">
                        <AvatarImage 
                          src={getAvatarUrl(user)} 
                          alt={user.username || 'User'}
                          className="object-cover"
                          onError={(e) => {
                            // Fallback to default avatar if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                          }}
                        />
                        <AvatarFallback className="bg-muted">
                          {user.username ? user.username[0].toUpperCase() : 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {formatUsername(user)}
                        </div>
                        {user.email && (
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          ID: {user.id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.isAdmin}
                      onCheckedChange={() => handleToggleAdmin(user)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.isBlocked}
                      onCheckedChange={() => handleToggleBlocked(user)}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Placeholder for future actions like 'Edit' or 'Delete' */}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
