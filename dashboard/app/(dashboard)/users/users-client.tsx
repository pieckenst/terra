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

  // Format username with discriminator if available (matches profile page logic)
  const formatUsername = (user: ExtendedUser) => {
    // If discriminator exists and is not '0', append it
    if (user.discriminator && user.discriminator !== '0') {
      return `${user.username}#${user.discriminator}`;
    }
    // Otherwise just return the username
    return user.username || 'Unknown User';
  };

  // Get avatar URL with fallback (matches profile page logic)
  const getAvatarUrl = (user: ExtendedUser) => {
    // If we already have a direct avatar URL, use it
    if (user.avatarUrl) return user.avatarUrl;
    
    // If we have an avatar hash, construct the URL
    if (user.avatar && user.id) {
      // Check if it's a GIF (starts with 'a_')
      const format = user.avatar.startsWith('a_') ? 'gif' : 'png';
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${format}`;
    }
    
    // Fallback to default Discord avatar based on discriminator
    if (user.discriminator && user.discriminator !== '0') {
      const defaultAvatarIndex = parseInt(user.discriminator) % 5;
      return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
    }
    
    // Fallback to default avatar
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  };

  // Fetch profile data for a single user
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      const { data: profile, error } = await getUserProfile(userId);
      
      if (error) {
        console.warn('Error fetching user profile:', error);
        return null;
      }
      
      if (!profile) {
        console.warn('No profile data returned for user:', userId);
        return null;
      }
      
      const now = new Date().toISOString();
      
      // Handle avatar URL construction with proper format detection
      let avatarUrl = null;
      if (profile.avatar) {
        const format = profile.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
      } else if (profile.discriminator && profile.discriminator !== '0') {
        // Fallback to default avatar based on discriminator
        const defaultAvatarIndex = parseInt(profile.discriminator) % 5;
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
      } else {
        // Final fallback to default avatar
        avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0.png';
      }
      
      const userProfile: ExtendedUser = {
        id: profile.id,
        username: profile.username || `User-${profile.id.slice(0, 4)}`,
        discriminator: profile.discriminator || '0',
        avatar: profile.avatar || null,
        avatarUrl: avatarUrl,
        email: (profile as any).email || null,
        isAdmin: profile.isAdmin || false,
        isBlocked: profile.isBlocked || false,
        createdAt: profile.createdAt || now,
        updatedAt: profile.updatedAt || now,
        guilds: (profile as any).guilds || []
      };
      
      return userProfile;
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
        
        // Filter out any null profiles and update state
        const validUsers = usersWithProfiles.filter((user): user is ExtendedUser => user !== null);
        setUsers(validUsers);
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
