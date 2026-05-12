'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  getServerDetails,
  getServerCommands,
  updateServerCommandStatus,
  ServerDetails,
  ServerCommand,
} from '@/lib/bot-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Shield, List } from 'lucide-react';

interface ServerPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function ServerPage({ params }: ServerPageProps) {
  const { id: serverId } = use(params);
  const router = useRouter();
  const [server, setServer] = useState<ServerDetails | null>(null);
  const [commands, setCommands] = useState<ServerCommand[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [serverData, commandData] = await Promise.all([
        getServerDetails(serverId),
        getServerCommands(serverId),
      ]);
      setServer(serverData);
      setCommands(commandData);
      setIsLoading(false);
    };

    fetchData();
  }, [serverId]);

  const handleCommandToggle = async (commandName: string, newStatus: boolean) => {
    // Optimistic UI update
    setCommands((prevCommands) =>
      prevCommands.map((cmd) =>
        cmd.name === commandName ? { ...cmd, enabled: newStatus } : cmd
      )
    );

    // Send update to the backend
    const result = await updateServerCommandStatus(serverId, commandName, newStatus);
    if (!result.success) {
      // Revert on failure
      console.error(`Failed to update command: ${commandName}`);
      setCommands((prevCommands) =>
        prevCommands.map((cmd) =>
          cmd.name === commandName ? { ...cmd, enabled: !newStatus } : cmd
        )
      );
    }
  };

  if (isLoading) {
    return <div>Loading server dashboard...</div>;
  }

  if (!server) {
    return <div>Server not found or failed to load.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Server Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Avatar className="h-16 w-16">
            {server.iconUrl && <AvatarImage src={server.iconUrl} alt={server.name} />}
            <AvatarFallback>{server.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{server.name}</h1>
            <p className="text-muted-foreground">Server ID: {server.id}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs defaultValue="commands" className="space-y-6">
        <TabsList>
          <TabsTrigger value="commands" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            <span>Commands</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" onClick={() => router.push(`/servers/${serverId}/settings`)}>
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
          <TabsTrigger value="moderation" className="flex items-center gap-2" onClick={() => router.push(`/servers/${serverId}/moderation`)}>
            <Shield className="h-4 w-4" />
            <span>Moderation</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commands" className="space-y-6">
          {/* Server Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle>Server Overview</CardTitle>
              <CardDescription>Basic information about this server</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex flex-col space-y-1">
                  <span className="text-muted-foreground">Members</span>
                  <span className="font-semibold">{server.memberCount}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-muted-foreground">Channels</span>
                  <span className="font-semibold">{server.channelCount}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-muted-foreground">Roles</span>
                  <span className="font-semibold">{server.roleCount}</span>
                </div>
                <div className="flex flex-col space-y-1">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-semibold">
                    {new Date(server.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Commands Card */}
          <Card>
        <CardHeader>
          <CardTitle>Command Configuration</CardTitle>
          <CardDescription>
            Enable or disable commands for this server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Command</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.length > 0 ? (
                commands.map((command) => (
                  <TableRow key={command.name}>
                    <TableCell className="font-medium">{command.name}</TableCell>
                    <TableCell>{command.description}</TableCell>
                    <TableCell>{command.category}</TableCell>
                    <TableCell>
                      <Badge variant={command.enabled ? 'default' : 'destructive'}>
                        {command.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        checked={command.enabled}
                        onCheckedChange={(newStatus) =>
                          handleCommandToggle(command.name, newStatus)
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No commands found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
