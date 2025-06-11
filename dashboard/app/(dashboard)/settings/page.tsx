'use client';

import { useEffect, useState } from 'react';
import {
  getFeatureFlags,
  updateFeatureFlags,
  restartBot,
  FeatureFlags,
} from '@/lib/bot-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFlags = async () => {
      setIsLoading(true);
      const data = await getFeatureFlags();
      setFlags(data);
      setIsLoading(false);
    };
    fetchFlags();
  }, []);

  const handleFlagChange = (key: string, value: string | boolean) => {
    setFlags((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveChanges = async () => {
    const result = await updateFeatureFlags(flags);
    if (result.success) {
      toast.success('Settings Saved', {
        description: result.message || 'Changes saved successfully.',
      });
    } else {
      toast.error('Error', {
        description: 'Failed to save settings.',
      });
    }
  };

  const handleRestartBot = async () => {
    const result = await restartBot();
    if (result.success) {
      toast.success('Restarting Bot', {
        description: result.message,
      });
    } else {
      toast.error('Error', {
        description: result.message || 'Failed to restart bot.',
      });
    }
  };

  if (isLoading) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flags</CardTitle>
          <CardDescription>
            Toggle features for the bot. A restart is required for changes to apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(flags).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key} className="capitalize">
                {key.replace(/([A-Z])/g, ' $1')}
              </Label>
              {typeof value === 'boolean' ? (
                <Switch
                  id={key}
                  checked={value}
                  onCheckedChange={(checked) => handleFlagChange(key, checked)}
                />
              ) : key === 'useDatabase' ? (
                <Select
                  value={value as string}
                  onValueChange={(newValue) => handleFlagChange(key, newValue)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Database" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sqlite">SQLite</SelectItem>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="prisma">Prisma</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
      <Button onClick={handleSaveChanges}>Save Changes</Button>

      <Card>
        <CardHeader>
          <CardTitle>Bot Owner Controls</CardTitle>
          <CardDescription>
            Perform administrative actions on the bot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label>Restart Bot</Label>
            <Button variant="destructive" onClick={handleRestartBot}>
              Restart
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
