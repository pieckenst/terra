'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getUserProfile, UserProfile, getMutualServers, MutualServersResponse } from '@/lib/bot-api';
import {
  defaultUserAvatarUrl,
  discordSnowflakeToDate,
  formatDiscordHandle,
  guildIconUrl,
  nitroLabel,
  userAvatarUrl,
} from '@/lib/discord-display';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [mutualServersData, setMutualServersData] = useState<MutualServersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (status === 'authenticated' && session?.user?.id) {
        try {
          setIsLoading(true);
          // Pass the session with access token to getUserProfile
          const { data, error } = await getUserProfile(session.user.id, { 
            user: session.user,
            accessToken: session.accessToken 
          });
          
          if (data) {
            setUserData(data);
            
            // Fetch mutual servers if we have a discord user ID
            const discordId = data.discordUserId || session?.user?.discordId;
            console.log('[PROFILE] Fetching mutual servers for discordId:', discordId);
            console.log('[PROFILE] Data discordUserId:', data.discordUserId);
            console.log('[PROFILE] Session discordId:', session?.user?.discordId);
            
            if (discordId) {
              try {
                const mutualData = await getMutualServers(discordId);
                console.log('[PROFILE] Mutual servers response:', mutualData);
                if (mutualData) {
                  setMutualServersData(mutualData);
                }
              } catch (mutualError) {
                console.error('Failed to fetch mutual servers:', mutualError);
              }
            } else {
              console.warn('[PROFILE] No discordId available for mutual servers lookup');
            }
          }
          
          // Handle API errors gracefully
          if (error) {
            console.warn('Profile info:', error);
            // If it's a 401, the session might be expired
            if (error === 'Authentication required. Please sign in again.') {
              // Force sign out and redirect to login
              await signOut({ redirect: true, callbackUrl: '/login' });
              return;
            }
          }
        } catch (error) {
          console.error('Failed to fetch user data:', error);
          // Set a minimal user data object to prevent UI errors
          const fallbackName = session.user.name || 'User';
          const userId = session.user.id || '';
          
          // Construct default avatar from user ID
          let fallbackAvatar = session.user.image;
          if (!fallbackAvatar && userId) {
            const avatarIndex = Number(BigInt(userId) >> BigInt(22)) % 6;
            fallbackAvatar = `https://cdn.discordapp.com/embed/avatars/${avatarIndex}.png`;
          }
          
          setUserData({
            id: session.user.id,
            discordUserId: session.user.discordId ?? null,
            username: fallbackName,
            discriminator: '0',
            globalName: session.user.name || null,
            avatar: fallbackAvatar || null,
            email: session.user.email || null,
            isAdmin: false,
            isBlocked: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            guilds: [],
          } as UserProfile);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchUserData();
  }, [status, session]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center space-y-4">
                  <Skeleton className="h-32 w-32 rounded-full" />
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-4/6" />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6 md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Server Membership</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  
  // Handle case when not authenticated
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Not Signed In</CardTitle>
            <CardDescription>You need to be signed in to view this page.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => signIn('discord')}>
              Sign in with Discord
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // Handle case when backend API is unavailable
  if (userData === null) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile Unavailable</h1>
          <p className="text-muted-foreground">
            We're having trouble loading your profile information.
          </p>
        </div>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Unavailable</CardTitle>
              <CardDescription>
                The profile service is currently unavailable. This might be due to:
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Temporary server issues</li>
                <li>Network connectivity problems</li>
                <li>Scheduled maintenance</li>
              </ul>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-medium mb-2">What you can do:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <span className="mr-2">🔄</span>
                    <span>Refresh the page to try again</span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">⏱️</span>
                    <span>Wait a few minutes and try again later</span>
                  </li>
                  <li className="flex items-center">
                    <span className="mr-2">📧</span>
                    <span>Contact support if the issue persists</span>
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={() => window.location.reload()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                  <path d="M16 16h5v5"></path>
                </svg>
                Refresh Page
              </Button>
              <Button asChild>
                <a href="/support">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                  Contact Support
                </a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please sign in to view your profile.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => signIn('discord')} className="w-full">
              Sign In with Discord
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Card>
          <CardHeader>
            <CardTitle>Profile Not Found</CardTitle>
            <CardDescription>
              We couldn't load your profile. Please try again later.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const discordId = userData.discordUserId || session?.user?.discordId || '';
  const { displayName, handle, showLegacyTag } = formatDiscordHandle(
    userData.username,
    userData.discriminator,
    userData.globalName
  );
  const profileAvatarSrc = discordId
    ? userAvatarUrl(
        discordId,
        userData.avatarHash ?? userData.avatar,
        userData.discriminator,
        256
      )
    : userData.avatar || '';
  const discordApproxJoin = discordId ? discordSnowflakeToDate(discordId) : null;
  const nitro = nitroLabel(userData.premiumType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground">
            Manage your account and view your permissions
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-1">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage
                    src={profileAvatarSrc}
                    alt={displayName}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (discordId) {
                        target.src = defaultUserAvatarUrl(discordId, userData.discriminator);
                      }
                    }}
                  />
                  <AvatarFallback>
                    {displayName.slice(0, 2).toUpperCase() || 'US'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-medium leading-tight">{displayName}</h3>
                  <p className="text-sm text-muted-foreground">{handle}</p>
                  {showLegacyTag && (
                    <p className="text-xs text-muted-foreground">
                      Classic Discord tag (four-digit discriminator).
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">{userData.email}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {userData.isAdmin && (
                    <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      Admin
                    </Badge>
                  )}
                  {userData.isBlocked && (
                    <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      Blocked
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">User ID</p>
                <p className="text-sm font-mono">{userData.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Discord user ID</p>
                <p className="text-sm font-mono break-all">{discordId || 'N/A'}</p>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-medium text-muted-foreground">Discord handle</p>
                <p className="text-sm">{handle}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{userData.email || 'Not provided'}</p>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                <p className="text-sm font-medium text-muted-foreground">Account Created</p>
                <p className="text-sm">{formatDate(userData.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-sm">{formatDate(userData.updatedAt)}</p>
              </div>
              {discordApproxJoin && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-muted-foreground">Discord account ~since</p>
                  <p className="text-sm">
                    {formatDate(discordApproxJoin.toISOString())}
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      Estimated from your Discord ID (snowflake), not an exact “joined Discord” date.
                    </span>
                  </p>
                </div>
              )}
              {(userData.verified != null ||
                userData.mfaEnabled != null ||
                nitro ||
                userData.locale) && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Discord account</p>
                  <div className="flex flex-wrap gap-2">
                    {userData.verified === true && (
                      <Badge variant="secondary" className="text-xs">
                        Verified email
                      </Badge>
                    )}
                    {userData.mfaEnabled === true && (
                      <Badge variant="secondary" className="text-xs">
                        2FA on
                      </Badge>
                    )}
                    {nitro && (
                      <Badge variant="secondary" className="text-xs">
                        {nitro}
                      </Badge>
                    )}
                    {userData.locale && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {userData.locale}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {mutualServersData && mutualServersData.mutualServers.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-muted-foreground">Mutual Servers with Bot</p>
                  <div className="mt-1 space-y-1">
                    {mutualServersData.mutualServers.slice(0, 3).map((server) => (
                      <div key={server.id} className="flex items-center space-x-2">
                        {server.iconUrl && (
                          <img
                            src={server.iconUrl}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover shrink-0 bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility = 'hidden';
                            }}
                          />
                        )}
                        <span className="text-sm truncate flex-1">{server.name}</span>
                      </div>
                    ))}
                    {mutualServersData.mutualServers.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{mutualServersData.mutualServers.length - 3} more
                      </p>
                    )}
                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                        ✓ {mutualServersData.totalMutualServers} of your {mutualServersData.totalUserGuilds} servers have the bot
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {userData.guilds && userData.guilds.length > 0 && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                  <p className="text-sm font-medium text-muted-foreground">Your Guilds from Session</p>
                  <div className="mt-1 space-y-1">
                    {userData.guilds.slice(0, 3).map((guild) => (
                      <div key={guild.id} className="flex items-center space-x-2">
                        {(guild.iconUrl || guildIconUrl(guild.id, guild.icon, 32)) && (
                          <img
                            src={guild.iconUrl || guildIconUrl(guild.id, guild.icon, 32) || ''}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover shrink-0 bg-muted"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility = 'hidden';
                            }}
                          />
                        )}
                        <span className="text-sm">{guild.name}</span>
                        {guild.owner && (
                          <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 px-1.5 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                      </div>
                    ))}
                    {userData.guilds.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{userData.guilds.length - 3} more servers
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Servers</CardTitle>
              <CardDescription>
                Guilds from your Discord session. Servers where the bot is also present are highlighted.
                {mutualServersData && (
                  <span className="block mt-1 text-sm">
                    <span className="font-medium text-primary">{mutualServersData.totalMutualServers} mutual servers</span> with the bot
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userData.guilds && userData.guilds.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {userData.guilds.map((guild) => {
                    // Check if this is a mutual server
                    const isMutual = mutualServersData?.mutualServers.some(
                      (ms) => ms.id === guild.id
                    );
                    
                    return (
                      <div 
                        key={guild.id} 
                        className={`flex items-start space-x-4 p-3 border rounded-lg transition-colors ${
                          isMutual 
                            ? 'bg-primary/5 border-primary/30 hover:bg-primary/10' 
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <Avatar className="h-12 w-12 mt-1 rounded-xl">
                          {guild.iconUrl || guild.icon ? (
                            <AvatarImage
                              src={guild.iconUrl || guildIconUrl(guild.id, guild.icon, 128) || ''}
                              alt=""
                              className="object-cover"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                el.src = '';
                                el.style.display = 'none';
                              }}
                            />
                          ) : null}
                          <AvatarFallback className="rounded-xl bg-muted text-xs font-medium">
                            {guild.name
                              .split(/\s+/)
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium truncate">{guild.name}</h4>
                            <div className="flex items-center gap-2 ml-2">
                              {guild.owner && (
                                <Badge variant="outline" className="shrink-0">
                                  Owner
                                </Badge>
                              )}
                              {isMutual && (
                                <Badge variant="default" className="shrink-0 bg-green-600 hover:bg-green-700">
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Bot
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center text-sm text-muted-foreground">
                              <span className="truncate">
                                {guild.permissions_new || 'Standard Permissions'}
                              </span>
                            </div>
                            
                            {guild.features && guild.features.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {guild.features.slice(0, 3).map((feature) => (
                                  <Badge 
                                    key={feature} 
                                    variant="secondary" 
                                    className="text-xs capitalize"
                                  >
                                    {feature.replace(/_/g, ' ').toLowerCase()}
                                  </Badge>
                                ))}
                                {guild.features.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{guild.features.length - 3} more
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    You don't have access to any servers with administrator permissions.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    Refresh
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Permissions</CardTitle>
              <CardDescription>
                Permissions you have across the dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Admin Access</p>
                    <p className="text-sm text-muted-foreground">
                      Full access to all features and settings
                    </p>
                  </div>
                  <Badge variant={userData.isAdmin ? 'default' : 'outline'}>
                    {userData.isAdmin ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Bot Management</p>
                    <p className="text-sm text-muted-foreground">
                      Restart and configure bot settings
                    </p>
                  </div>
                  <Badge variant={userData.isAdmin ? 'default' : 'outline'}>
                    {userData.isAdmin ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">User Management</p>
                    <p className="text-sm text-muted-foreground">
                      View and manage other users
                    </p>
                  </div>
                  <Badge variant={userData.isAdmin ? 'default' : 'outline'}>
                    {userData.isAdmin ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
