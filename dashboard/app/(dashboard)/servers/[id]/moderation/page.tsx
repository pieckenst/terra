'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { kickMember, banMember, timeoutMember } from '@/lib/bot-api';
import { toast } from 'sonner';
import { Loader2, Shield, Ban, Clock, ArrowLeft } from 'lucide-react';

export default function ModerationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: serverId } = use(params);
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [timeoutSeconds, setTimeoutSeconds] = useState(3600);
  const [deleteMessageDays, setDeleteMessageDays] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleKick = async () => {
    if (!userId) {
      toast.error('User ID is required');
      return;
    }
    setActionLoading('kick');
    const result = await kickMember(serverId, userId, reason);
    if (result.success) {
      toast.success('Member kicked successfully');
      setUserId('');
      setReason('');
    } else {
      toast.error('Failed to kick member');
    }
    setActionLoading(null);
  };

  const handleBan = async () => {
    if (!userId) {
      toast.error('User ID is required');
      return;
    }
    setActionLoading('ban');
    const result = await banMember(serverId, userId, deleteMessageDays, reason);
    if (result.success) {
      toast.success('Member banned successfully');
      setUserId('');
      setReason('');
    } else {
      toast.error('Failed to ban member');
    }
    setActionLoading(null);
  };

  const handleTimeout = async () => {
    if (!userId) {
      toast.error('User ID is required');
      return;
    }
    setActionLoading('timeout');
    const result = await timeoutMember(serverId, userId, timeoutSeconds, reason);
    if (result.success) {
      toast.success('Member timed out successfully');
      setUserId('');
      setReason('');
    } else {
      toast.error('Failed to timeout member');
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Moderation</h1>
          <p className="text-muted-foreground">Moderate members in this server</p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/servers/${serverId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Commands
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Moderation Actions</CardTitle>
          <CardDescription>Enter user ID and select an action</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="userId">User ID</Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="123456789012345678"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for moderation action"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeoutDuration">Timeout Duration (seconds)</Label>
            <Input
              id="timeoutDuration"
              type="number"
              value={timeoutSeconds}
              onChange={(e) => setTimeoutSeconds(parseInt(e.target.value))}
              min={60}
              max={2419200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deleteDays">Delete Message History (days, for ban)</Label>
            <Input
              id="deleteDays"
              type="number"
              value={deleteMessageDays}
              onChange={(e) => setDeleteMessageDays(parseInt(e.target.value))}
              min={0}
              max={7}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="destructive"
              onClick={handleKick}
              disabled={actionLoading !== null || !userId}
            >
              {actionLoading === 'kick' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
              Kick
            </Button>
            <Button
              variant="destructive"
              onClick={handleBan}
              disabled={actionLoading !== null || !userId}
            >
              {actionLoading === 'ban' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
              Ban
            </Button>
            <Button
              variant="outline"
              onClick={handleTimeout}
              disabled={actionLoading !== null || !userId}
            >
              {actionLoading === 'timeout' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clock className="mr-2 h-4 w-4" />}
              Timeout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
