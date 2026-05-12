'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getGuildSettings, updateGuildSettings, type GuildSettings } from '@/lib/bot-api';
import { useBotEvents } from '@/lib/bot-ws';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ServerSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params);
  const router = useRouter();
  const [settings, setSettings] = useState<Partial<GuildSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { connectionStatus, on, reconnect } = useBotEvents(['guildSettings:changed']);

  useEffect(() => {
    return on('guildSettings:changed', (data: { guildId: string; settings: GuildSettings }) => {
      if (data.guildId !== serverId) return;
      setSettings(data.settings);
    });
  }, [serverId, on]);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      const data = await getGuildSettings(serverId);
      if (data) {
        setSettings(data);
      }
      setLoading(false);
    };
    loadSettings();
  }, [serverId]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updateGuildSettings(serverId, settings);
    if (result.success) {
      toast.success('Server settings saved successfully');
    } else {
      toast.error(result.error || 'Failed to save settings');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Server Settings</h1>
          <p className="text-muted-foreground">Configure bot behavior for this server</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/servers/${serverId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Commands
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Command Prefix</CardTitle>
            <CardDescription>Override the default command prefix for this server</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix</Label>
              <Input
                id="prefix"
                value={settings.prefix || ''}
                onChange={(e) => setSettings({ ...settings, prefix: e.target.value })}
                placeholder="c."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Welcome Message</CardTitle>
            <CardDescription>Configure welcome message for new members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="welcomeChannel">Welcome Channel ID</Label>
              <Input
                id="welcomeChannel"
                value={settings.welcomeChannelId || ''}
                onChange={(e) => setSettings({ ...settings, welcomeChannelId: e.target.value })}
                placeholder="123456789012345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={settings.welcomeMessage || ''}
                onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                placeholder="Welcome to the server, {user}!"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Moderation Log</CardTitle>
            <CardDescription>Channel for moderation action logs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="modLogChannel">Mod Log Channel ID</Label>
              <Input
                id="modLogChannel"
                value={settings.modLogChannelId || ''}
                onChange={(e) => setSettings({ ...settings, modLogChannelId: e.target.value })}
                placeholder="123456789012345678"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto Role</CardTitle>
            <CardDescription>Automatically assign role to new members</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="autoRole">Auto Role ID</Label>
              <Input
                id="autoRole"
                value={settings.autoRoleId || ''}
                onChange={(e) => setSettings({ ...settings, autoRoleId: e.target.value })}
                placeholder="123456789012345678"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'h-2 w-2 shrink-0 rounded-full',
              connectionStatus === 'connected' && 'bg-green-500',
              connectionStatus === 'connecting' && 'animate-pulse bg-amber-500',
              connectionStatus === 'disconnected' && 'bg-red-500'
            )}
          />
          <span>
            {connectionStatus === 'connected' && 'Live updates connected to bot'}
            {connectionStatus === 'connecting' && 'Connecting to bot for live updates…'}
            {connectionStatus === 'disconnected' && 'Live updates offline'}
          </span>
        </div>
        {connectionStatus !== 'connected' && (
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={reconnect}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Retry connection
          </Button>
        )}
        <span className="text-xs opacity-90">
          Saving settings uses the bot API directly and does not require the live connection.
        </span>
      </div>
    </div>
  );
}
