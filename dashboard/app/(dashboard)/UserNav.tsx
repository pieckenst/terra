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

interface UserNavProps {
  user: Session['user'];
}

export function UserNav({ user }: UserNavProps) {
  const { data: session } = useSession();
  const [avatarUrl, setAvatarUrl] = useState(user?.image ?? '/placeholder-user.jpg');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFreshAvatar = async () => {
      if (session?.user?.id && session?.accessToken) {
        try {
          const { data } = await getUserProfile(session.user.id, {
            user: session.user,
            accessToken: session.accessToken
          });
          
          if (data?.avatar) {
            setAvatarUrl(data.avatar);
          }
        } catch (error) {
          console.warn('Failed to refresh avatar, using cached:', error);
          // Keep the cached avatar from session
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    fetchFreshAvatar();
  }, [session]);
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

