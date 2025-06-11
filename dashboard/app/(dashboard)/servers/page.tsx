'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Server as ServerIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServerList } from '@/components/ui/serverlist';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getServers, Server } from '@/lib/bot-api';

export default function ServerSelectionPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [newOffset, setNewOffset] = useState(0);
  const [totalServers, setTotalServers] = useState(0);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0); // This is the trigger for fetching
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [featureFlags, setFeatureFlags] = useState<{
    disabledCommands?: string[];
    betaCommands?: string[];
    useDatabase?: 'sqlite' | 'postgres' | 'none';
  }>({});

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await getServers(search, offset);
      if (data) {
        // If offset is 0, it's a new search/refresh, so replace servers.
        // Otherwise, it's a "load more" action, so append.
        setServers((prev) => (offset === 0 ? data.servers : [...prev, ...data.servers]));
        setNewOffset(data.newOffset);
        setTotalServers(data.totalServers);
      }
      setIsLoading(false);
    };

    loadData();
  }, [search, offset]); // Fetch when search or offset changes

  useEffect(() => {
    const fetchFlags = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/featureflags');
        const flags = await response.json();
        setFeatureFlags(flags);
      } catch (error) {
        console.error('Failed to fetch feature flags', error);
      }
    };
    fetchFlags();
  }, []); // Fetch flags only once

  const handleServerSelect = (serverId: string) => {
    router.push(`/servers/${serverId}`);
  };

  const handleRefresh = () => {
    if (offset !== 0) {
      setOffset(0); // This will trigger the useEffect to refetch from the start
    } else {
      // If offset is already 0, we need to manually trigger a re-fetch.
      // This can be done by creating a new function or adding another state.
      // For simplicity, we'll just call getServers directly here.
      const loadData = async () => {
        setIsLoading(true);
        const data = await getServers(search, 0);
        if (data) {
          setServers(data.servers);
          setNewOffset(data.newOffset);
          setTotalServers(data.totalServers);
        }
        setIsLoading(false);
      };
      loadData();
    }
  };

  const handleLoadMore = () => {
    if (!isLoading && servers.length < totalServers) {
      setOffset(newOffset); // This will trigger the useEffect to fetch the next page
    }
  };

  return (
    <div className="bg-background text-foreground dark:bg-background dark:text-foreground">
      <Tabs defaultValue="all">
        <div className="flex items-center">
          <TabsList>
            <TabsTrigger value="all">All Servers</TabsTrigger>
            <TabsTrigger value="managed">Managed Servers</TabsTrigger>
            <TabsTrigger value="unmanaged">Unmanaged Servers</TabsTrigger>
          </TabsList>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <ServerIcon className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                {isLoading ? 'Refreshing...' : 'Refresh Servers'}
              </span>
            </Button>
          </div>
        </div>
        <TabsContent value="all">
          <ServerList
            servers={servers}
            offset={newOffset} // Pass the new offset for the next load
            totalServers={totalServers}
            onServerSelect={handleServerSelect}
            onLoadMore={handleLoadMore} // Pass the new load function
            featureFlags={{
              disabledCommands: featureFlags.disabledCommands || [],
              betaCommands: featureFlags.betaCommands || [],
              useDatabase: featureFlags.useDatabase || 'none',
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}