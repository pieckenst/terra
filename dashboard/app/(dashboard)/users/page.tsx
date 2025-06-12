import { auth } from '@/lib/auth';
import { getUsers, getPermissions } from '@/lib/bot-api';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import UsersClient from './users-client';

// Helper function to check if user has required permissions
function hasUserPermission(
  user: { discordId?: string | null; role?: number } | null | undefined, 
  permissions: { botOwnerId: string } | null
): boolean {
  if (!user) return false;
  
  // Check if user is the bot owner
  if (user.discordId && permissions?.botOwnerId === user.discordId) {
    return true;
  }
  
  // Check if user has admin or moderator role (role >= 1)
  return (user.role ?? 0) >= 1;
}

export default async function UsersPage() {
  const session = await auth();
  const permissions = await getPermissions();
  
  const hasPermission = hasUserPermission(session?.user, permissions);

  if (!hasPermission) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <CardTitle>Access Denied</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="space-y-4">
              <p>
                You don't have permission to access the Users page. This area is restricted to administrators and moderators.
              </p>
              <p>
                If you believe this is an error, please contact a server administrator.
              </p>
            </CardDescription>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/">
                Return to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Fetch users and transform them to match the ExtendedUser interface
  const users = await getUsers();
  const now = new Date().toISOString();
  
  const extendedUsers = users.map(user => ({
    ...user,
    // Ensure all required ExtendedUser fields are included with defaults
    discriminator: user.discriminator || '0',
    avatar: (user as any).avatar || null,
    username: user.username || `User-${user.id.slice(0, 4)}`,
    email: (user as any).email || null,
    isAdmin: user.isAdmin || false,
    isBlocked: user.isBlocked || false,
    avatarUrl: (user as any).avatarUrl || null,
    createdAt: (user as any).createdAt || now,
    updatedAt: (user as any).updatedAt || now,
    guilds: [] // Empty array as fallback since we don't need guilds in the list
  }));

  return <UsersClient initialUsers={extendedUsers} />;
}
