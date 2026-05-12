'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Server, Bot, Activity, Clock, User, Zap, ArrowRight, Settings, BarChart3, Command, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStats } from '@/lib/bot-api';
import type { BotStats } from '@/lib/bot-api';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardHomePage() {
  const [stats, setStats] = useState<BotStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      const statsData = await getStats();
      if (statsData) {
        setStats(statsData);
      }
      setIsLoading(false);
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-sm font-medium">Total Servers</CardTitle></CardHeader><CardContent>...</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-medium">Total Members</CardTitle></CardHeader><CardContent>...</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-medium">Active Users</CardTitle></CardHeader><CardContent>...</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm font-medium">Total Commands</CardTitle></CardHeader><CardContent>...</CardContent></Card>
        </div>
      </div>
    );
  }

  const quickLinks = [
    { title: 'Servers', description: 'Manage your servers', href: '/servers', icon: Server },
    { title: 'Commands', description: 'View all commands', href: '/commands', icon: Command },
    { title: 'Users', description: 'Manage users', href: '/users', icon: Users },
    { title: 'Analytics', description: 'View analytics', href: '/analytics', icon: BarChart3 },
    { title: 'Settings', description: 'Configure bot', href: '/settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Welcome back, {session?.user?.name || 'User'}!</CardTitle>
              <p className="text-sm text-muted-foreground">Here's what's happening with your bot today.</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalServers.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Servers using the bot</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalMembers.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Total members across servers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.activeUsers.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Users who used commands</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commands</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCommands.toLocaleString() ?? '...'}</div>
            <p className="text-xs text-muted-foreground">Available commands</p>
          </CardContent>
        </Card>
      </div>

      {/* Bot Uptime Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Bot Status</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">Online</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-3xl font-bold">{stats?.uptime?.formatted || '...'}</div>
              <p className="text-sm text-muted-foreground">Bot uptime</p>
            </div>
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
        </CardContent>
      </Card>

      {/* Quick Navigation */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Navigation</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{link.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
