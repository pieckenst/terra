'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getUsers, updateUser, addUser, User } from '@/lib/bot-api';
import { toast } from 'sonner';

interface UsersClientProps {
  initialUsers: User[];
}

export default function UsersClient({ initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isLoading, setIsLoading] = useState(false);
  const [newUserId, setNewUserId] = useState('');

  const handleToggleAdmin = async (user: User) => {
    const promise = updateUser(user.id, { isAdmin: !user.isAdmin });
    toast.promise(promise, {
      loading: 'Updating user...', 
      success: (data) => {
        if (data.success) {
          setUsers(users.map((u) => (u.id === user.id ? { ...u, isAdmin: !u.isAdmin } : u)));
          return 'User updated successfully!';
        }
        throw new Error(data.error || 'Failed to update user.');
      },
      error: (err) => err.message,
    });
  };

  const handleToggleBlocked = async (user: User) => {
    const promise = updateUser(user.id, { isBlocked: !user.isBlocked });
    toast.promise(promise, {
      loading: 'Updating user...', 
      success: (data) => {
        if (data.success) {
          setUsers(users.map((u) => (u.id === user.id ? { ...u, isBlocked: !u.isBlocked } : u)));
          return 'User updated successfully!';
        }
        throw new Error(data.error || 'Failed to update user.');
      },
      error: (err) => err.message,
    });
  };

  const handleAddUser = async () => {
    if (!newUserId.trim()) {
      toast.error('Please enter a valid User ID.');
      return;
    }
    const promise = addUser(newUserId.trim());
    toast.promise(promise, {
      loading: 'Adding user...', 
      success: async (data) => {
        if (data.success) {
          setNewUserId('');
          // Refetch users to get the new user's full details
          setIsLoading(true);
          const updatedUsers = await getUsers();
          setUsers(updatedUsers);
          setIsLoading(false);
          return 'User added successfully!';
        }
        throw new Error(data.error || 'Failed to add user.');
      },
      error: (err) => err.message,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>
          Manage user permissions and access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Input
            placeholder="Enter User ID to add"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleAddUser}>Add User</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Is Admin</TableHead>
              <TableHead>Is Blocked</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar>
                        <AvatarImage src={user.avatarUrl || ''} />
                        <AvatarFallback>{user.username[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-muted-foreground">{user.id}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.isAdmin}
                      onCheckedChange={() => handleToggleAdmin(user)}
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={user.isBlocked}
                      onCheckedChange={() => handleToggleBlocked(user)}
                    />
                  </TableCell>
                  <TableCell>
                    {/* Placeholder for future actions like 'Edit' or 'Delete' */}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
