'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Server, Bot, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getStats } from '@/lib/bot-api';
import type { BotStats } from '@/lib/bot-api';

export default function DashboardHomePage() {
  const [stats, setStats] = useState<BotStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm font-medium">Total Servers</CardTitle></CardHeader><CardContent>...</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Total Members</CardTitle></CardHeader><CardContent>...</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Active Users</CardTitle></CardHeader><CardContent>...</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm font-medium">Total Commands</CardTitle></CardHeader><CardContent>...</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalServers.toLocaleString() ?? '...'}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalMembers.toLocaleString() ?? '...'}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.activeUsers.toLocaleString() ?? '...'}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Commands</CardTitle>
          <Bot className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalCommands.toLocaleString() ?? '...'}</div>
        </CardContent>
      </Card>
    </div>
  );
}
