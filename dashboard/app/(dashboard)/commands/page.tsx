'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { getCommands, getFeatureFlags, updateFeatureFlags, Command, FeatureFlags } from '@/lib/bot-api';
import { toast } from 'sonner';

export default function CommandsPage() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({});
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cmds, flags] = await Promise.all([
          getCommands(),
          getFeatureFlags(),
        ]);
        setCommands(cmds);
        setFeatureFlags(flags);
        setDisabledCommands(flags.disabledCommands || []);
      } catch (error) {
        toast.error('Failed to fetch commands or feature flags.');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleToggle = (commandName: string, isEnabled: boolean) => {
    if (!isEnabled) {
      setDisabledCommands((prev) => [...prev, commandName]);
    } else {
      setDisabledCommands((prev) => prev.filter((cmd) => cmd !== commandName));
    }
  };

  const handleSaveChanges = async () => {
    try {
      const updatedFlags = { ...featureFlags, disabledCommands };
      await updateFeatureFlags(updatedFlags);
      toast.success('Command settings saved! Please restart the bot to apply changes.');
    } catch (error) {
      toast.error('Failed to save command settings.');
      console.error(error);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Command Settings</CardTitle>
        <CardDescription>
          Enable or disable commands for the entire bot. A restart is required for changes to take effect.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Command</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Enabled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.map((command) => (
              <TableRow key={command.name}>
                <TableCell className="font-medium">{command.name}</TableCell>
                <TableCell>{command.description}</TableCell>
                <TableCell>{command.category}</TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={!disabledCommands.includes(command.name)}
                    onCheckedChange={(checked) => handleToggle(command.name, checked)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}
