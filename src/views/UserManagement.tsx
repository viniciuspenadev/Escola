import { type FC, useEffect, useState } from 'react';
import { Users, Search, Mail, Eye, MoreVertical, Loader2, RefreshCw, Plus, X, Save } from 'lucide-react';
import { supabase } from '../services/supabase';

interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'SECRETARY' | 'COORDINATOR' | 'TEACHER' | 'PARENT';
    created_at: string;
}

interface UserDetails extends User {
    students?: { name: string }[];
    classes?: { name: string }[];
}

export const UserManagement: FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'ALL' | 'PARENT' | 'TEACHER'>('ALL');
    const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [actionMenuUser, setActionMenuUser] = useState<string | null>(null);

    // Create User State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creatingUser, setCreatingUser] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: 'TEACHER' as User['role']
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        filterUsers();
    }, [searchTerm, roleFilter, users]);

    const fetchUsers = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, name, role, created_at')
                // .in('role', ['PARENT', 'TEACHER']) // Fetches all roles now
                .order('created_at', { ascending: false });

            if (error) throw error;

            setUsers(data as User[] || []);
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterUsers = () => {
        let filtered = users;

        // Filter by role
        if (roleFilter !== 'ALL') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(u =>
                u.name?.toLowerCase().includes(term) ||
                u.email?.toLowerCase().includes(term)
            );
        }

        setFilteredUsers(filtered);
    };

    const handleViewDetails = async (user: User) => {
        try {
            let details: UserDetails = { ...user };

            if (user.role === 'PARENT') {
                // Fetch linked students
                const { data: studentLinks } = await supabase
                    .from('student_guardians')
                    .select('students(name)')
                    .eq('guardian_id', user.id);

                details.students = studentLinks?.map(link => (link as any).students) || [];
            }

            setSelectedUser(details);
            setShowDetailsModal(true);
            setActionMenuUser(null);
        } catch (error) {
            console.error('Error fetching user details:', error);
        }
    };

    const handleResetPassword = async () => {
        if (!selectedUser) return;

        try {
            setResetting(true);

            const { error } = await supabase.auth.resetPasswordForEmail(selectedUser.email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            alert('Email de redefinição enviado com sucesso!');
            setShowResetModal(false);
            setSelectedUser(null);
        } catch (error) {
            console.error('Error resetting password:', error);
            alert('Erro ao enviar email de redefinição.');
        } finally {
            setResetting(false);
        }
    };

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            PARENT: 'bg-purple-100 text-purple-700',
            TEACHER: 'bg-blue-100 text-blue-700',
            ADMIN: 'bg-gray-100 text-gray-700',
            SECRETARY: 'bg-pink-100 text-pink-700',
            COORDINATOR: 'bg-orange-100 text-orange-700'
        };
        const labels: Record<string, string> = {
            PARENT: 'Responsável',
            TEACHER: 'Professor',
            ADMIN: 'Admin',
            SECRETARY: 'Secretaria',
            COORDINATOR: 'Coordenação'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
                {labels[role] || role}
            </span>
        );
    };

    const handleCreateUser = async () => {
        if (!newUser.name || !newUser.email || !newUser.password) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        setCreatingUser(true);
        try {
            const { error } = await supabase.rpc('admin_create_user', {
                p_email: newUser.email,
                p_password: newUser.password,
                p_name: newUser.name,
                p_role: newUser.role
            });

            if (error) throw error;

            alert('Usuário criado com sucesso!');
            setShowCreateModal(false);
            setNewUser({ name: '', email: '', password: '', role: 'TEACHER' });
            fetchUsers();
        } catch (error: any) {
            console.error('Error creating user:', error);
            alert('Erro ao criar usuário: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setCreatingUser(false);
        }
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-brand-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Gerenciar Usuários</h1>
                            <p className="text-sm text-gray-500">
                                {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Usuário
                        </button>
                        <button
                            onClick={fetchUsers}
                            disabled={loading}
                            className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Atualizar
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                        />
                    </div>

                    {/* Role Filter */}
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as any)}
                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    >
                        <option value="ALL">Todos</option>
                        <option value="ADMIN">Administradores</option>
                        <option value="TEACHER">Professores</option>
                        <option value="PARENT">Responsáveis</option>
                        <option value="SECRETARY">Secretaria</option>
                        <option value="COORDINATOR">Coordenação</option>
                    </select>
                </div>
            </div>

            {/* User List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhum usuário encontrado</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Usuário
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Email
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Cadastrado em
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center">
                                                <span className="text-brand-600 font-semibold">
                                                    {user.name?.charAt(0).toUpperCase() || '?'}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{user.name || 'Sem nome'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {user.email}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getRoleBadge(user.role)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm relative">
                                        <button
                                            onClick={() => setActionMenuUser(actionMenuUser === user.id ? null : user.id)}
                                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                        >
                                            <MoreVertical className="w-5 h-5 text-gray-500" />
                                        </button>

                                        {/* Action Dropdown */}
                                        {actionMenuUser === user.id && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                                                <button
                                                    onClick={() => handleViewDetails(user)}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Ver Detalhes
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setShowResetModal(true);
                                                        setActionMenuUser(null);
                                                    }}
                                                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm border-t border-gray-100"
                                                >
                                                    <Mail className="w-4 h-4" />
                                                    Resetar Senha
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Detalhes do Usuário</h3>

                        <div className="space-y-3 mb-6">
                            <div>
                                <label className="text-xs text-gray-500">Nome</label>
                                <p className="font-medium text-gray-900">{selectedUser.name || 'Sem nome'}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Email</label>
                                <p className="font-medium text-gray-900">{selectedUser.email}</p>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Tipo</label>
                                <div>{getRoleBadge(selectedUser.role)}</div>
                            </div>

                            {selectedUser.role === 'PARENT' && selectedUser.students && (
                                <div>
                                    <label className="text-xs text-gray-500">Filhos Vinculados</label>
                                    {selectedUser.students.length > 0 ? (
                                        <ul className="mt-1 space-y-1">
                                            {selectedUser.students.map((student, idx) => (
                                                <li key={idx} className="text-sm text-gray-700">• {student.name}</li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500">Nenhum filho vinculado</p>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => setShowDetailsModal(false)}
                            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Resetar Senha</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            Um email será enviado para <strong>{selectedUser.email}</strong> com instruções para redefinir a senha.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowResetModal(false)}
                                disabled={resetting}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleResetPassword}
                                disabled={resetting}
                                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {resetting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Enviar Email'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Novo Usuário</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                    placeholder="Ex: João Silva"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={newUser.email}
                                    onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                    placeholder="email@escola.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                                    value={newUser.password}
                                    onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Função (Role)</label>
                                <select
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value as any })}
                                >
                                    <option value="TEACHER">Professor</option>
                                    <option value="ADMIN">Administrador</option>
                                    <option value="SECRETARY">Secretaria</option>
                                    <option value="COORDINATOR">Coordenação</option>
                                    <option value="PARENT">Responsável</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors text-gray-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreateUser}
                                disabled={creatingUser}
                                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
                            >
                                {creatingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Criar Usuário
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
