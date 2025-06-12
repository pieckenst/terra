'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const handleSignIn = async (formData: FormData) => {
    try {
      await signIn('discord', { 
        callbackUrl: '/',
        redirect: true
      });
    } catch (error) {
      console.error('Sign in error:', error);
      // You might want to show an error message to the user here
    }
  };

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
          <form action={handleSignIn}>
            <Button
              type="submit"
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white"
              disabled={false}
            >
              Sign in with Discord
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

