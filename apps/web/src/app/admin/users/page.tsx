'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  UserPlus, 
  Users, 
  Key,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import { adminApi } from '@/lib/admin-api';

interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'editor' as 'admin' | 'editor' | 'viewer',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load current admin info from session
  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      // For now, we show the current admin user based on session
      // In the future, this will fetch from the users API
      const token = document.cookie.match(/admin_token=([^;]+)/)?.[1];
      
      if (token) {
        try {
          const verifyResult = await adminApi.verify(token);
          if (verifyResult.data?.valid) {
            // Current admin user
            const currentUser: User = {
              id: '1',
              username: 'admin',
              email: 'admin@rafineri.io',
              role: 'admin',
              isActive: true,
              createdAt: new Date().toISOString(),
            };
            setUsers([currentUser]);
          }
        } catch {
          // Token invalid, no users to show
          setUsers([]);
        }
      } else {
        setUsers([]);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleAddUser() {
    setFormData({
      username: '',
      email: '',
      role: 'editor',
      password: '',
    });
    setShowAddForm(true);
    setError(null);
    setSuccess(null);
  }

  function handleCancelAdd() {
    setShowAddForm(false);
    setFormData({
      username: '',
      email: '',
      role: 'editor',
      password: '',
    });
  }

  async function submitAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError('User management API not yet implemented. This feature requires database schema updates (users table, password hashing, etc.).');
  }

  function getRoleBadgeColor(role: string) {
    switch (role) {
      case 'admin': return 'bg-red-500';
      case 'editor': return 'bg-blue-500';
      case 'viewer': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  }

  const activeUsers = users.filter(u => u.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            Manage admin users and permissions
          </p>
        </div>
        {!showAddForm && (
          <Button onClick={handleAddUser}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-green-600 p-4 border border-green-200 rounded-lg bg-green-50">
          <CheckCircle2 className="h-5 w-5" />
          <p>{success}</p>
        </div>
      )}

      {/* Add User Form */}
      {showAddForm && (
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Add New User</CardTitle>
              <CardDescription>
                Create a new admin user account
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleCancelAdd}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitAddUser} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="johndoe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'editor' | 'viewer' })}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="viewer">Viewer - Can view content only</option>
                    <option value="editor">Editor - Can edit stories</option>
                    <option value="admin">Admin - Full access</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={handleCancelAdd}>
                  Cancel
                </Button>
                <Button type="submit">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">Admin users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsers}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
            <p className="text-xs text-muted-foreground">With full access</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>
            Manage user accounts and their permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users configured</p>
              <p className="text-sm mt-1">Authentication uses environment-based admin token.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Username</th>
                    <th className="px-4 py-3 text-left font-medium">Email</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Created</th>
                    <th className="px-4 py-3 text-left font-medium w-[100px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 font-medium">{user.username}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge className={getRoleBadgeColor(user.role)}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            disabled
                            title="Edit (coming soon)"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            disabled
                            title="Delete (coming soon)"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" />
            Authentication Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Current authentication method: <strong>Environment-based Admin Token</strong>
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            The system is currently using a single admin token configured via the ADMIN_TOKEN environment variable. 
            Full multi-user management requires:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
            <li>Users table schema with password hashing</li>
            <li>Session management with secure cookies</li>
            <li>Role-based access control (RBAC)</li>
            <li>User CRUD API endpoints</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
