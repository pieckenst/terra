import { auth } from '@/lib/auth';
import { getUsers } from '@/lib/bot-api';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import UsersClient from './users-client';

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user.isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to view this page. Please contact an
              administrator if you believe this is an error.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const users = await getUsers();

  return <UsersClient initialUsers={users} />;
}
