
'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in with your Discord account to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => signIn('discord', { callbackUrl: '/' })}
            className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white"
          >
            Sign in with Discord
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

