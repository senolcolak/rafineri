'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2, Shield, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Role = 'admin' | 'editor' | 'reviewer' | 'viewer';

interface UserRow {
  id: string;
  username: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'editor' as Role,
  });

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await adminApi.getUsers();
      setUsers(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    if (!formData.username || !formData.email || !formData.password) return;
    setSaving(true);
    try {
      await adminApi.createUser(formData);
      setMessage('User created');
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'editor',
      });
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: UserRow) {
    setSaving(true);
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      setMessage(`User ${user.username} ${user.isActive ? 'disabled' : 'enabled'}`);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(id: string) {
    setSaving(true);
    try {
      await adminApi.deleteUser(id);
      setMessage(`User ${id} deleted`);
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  }

  function roleBadge(role: Role) {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-500">admin</Badge>;
      case 'editor':
        return <Badge className="bg-blue-500">editor</Badge>;
      case 'reviewer':
        return <Badge className="bg-yellow-500 text-black">reviewer</Badge>;
      default:
        return <Badge variant="secondary">viewer</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage admin accounts and roles</p>
        </div>
        <Button variant="outline" onClick={() => loadUsers()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Create User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={formData.username} onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={formData.email} onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={formData.role}
                onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as Role }))}
              >
                <option value="viewer">viewer</option>
                <option value="reviewer">reviewer</option>
                <option value="editor">editor</option>
                <option value="admin">admin</option>
              </select>
            </div>
          </div>
          <Button onClick={createUser} disabled={saving || !formData.username || !formData.email || !formData.password}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Create User
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found.</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Shield className="h-4 w-4" />
                      {user.username}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Last login: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'never'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {roleBadge(user.role)}
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'active' : 'inactive'}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(user)} disabled={saving}>
                      {user.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteUser(user.id)} disabled={saving}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
