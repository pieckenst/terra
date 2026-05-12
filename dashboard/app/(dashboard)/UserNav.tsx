'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { type Session } from 'next-auth';
import { getUserProfile } from '@/lib/bot-api';
import { useErrorHandler } from '@/components/global-error-handler';

interface UserNavProps {
  user: Session['user'];
}

export function UserNav({ user }: UserNavProps) {
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState(user?.image ?? '/placeholder-user.jpg');
  const [loading, setLoading] = useState(true);
  const { handleApiError } = useErrorHandler();

  useEffect(() => {
    const fetchFreshAvatar = async () => {
      if (session?.user?.id && session?.accessToken) {
        try {
          const result = await getUserProfile(session.user.id, {
            user: session.user,
            accessToken: session.accessToken
          });
          
          if (result.error) {
            // Use custom error handler to show toast
            handleApiError(
              { 
                status: result.requiresReauth ? 401 : 408, 
                statusText: result.error 
              } as Response,
              'getUserProfile'
            );
          } else if (result.data?.avatar) {
            setAvatarUrl(result.data.avatar);
          }
        } catch (error) {
          handleApiError(error, 'getUserProfile');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchFreshAvatar();
  }, [session, handleApiError]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
          <Image
            src={avatarUrl}
            width={36}
            height={36}
            alt="Avatar"
            className="overflow-hidden rounded-full"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user?.name ?? 'My Account'}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="w-full">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings" className="w-full">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/support" className="w-full">Support</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

