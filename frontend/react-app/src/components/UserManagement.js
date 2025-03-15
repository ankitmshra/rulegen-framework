import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showAddUserForm, setShowAddUserForm] = useState(false);
    const [filterRole, setFilterRole] = useState('all');
    const navigate = useNavigate();
    const { isAdmin } = useAuth();

    useEffect(() => {
        // Redirect if not admin
        if (!isAdmin()) {
            navigate('/');
            return;
        }
        
        fetchUsers();
    }, [isAdmin, navigate, filterRole]);

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            
            // Build query string for role filtering
            let url = '/api/users/';
            if (filterRole !== 'all') {
                url += `?role=${filterRole}`;
            }
            
            const response = await api.get(url);
            setUsers(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            await api.patch(`/api/users/${userId}/`, { role: newRole });
            
            // Update local state to avoid refetching
            setUsers(prevUsers => 
                prevUsers.map(user => 
                    user.id === userId ? { ...user, profile: { ...user.profile, role: newRole } } : user
                )
            );
        } catch (err) {
            console.error('Error updating user role:', err);
            setError('Failed to update user role. Please try again.');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }
        
        try {
            await api.delete(`/api/users/${userId}/`);
            // Remove user from local state
            setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
        } catch (err) {
            console.error('Error deleting user:', err);
            setError('Failed to delete user. Please try again.');
        }
    };

    // Get role display name
    const getRoleDisplay = (role) => {
        switch (role) {
            case 'admin':
                return 'Admin';
            case 'power_user':
                return 'Power User';
            case 'normal':
                return 'Normal User';
            default:
                return 'Unknown';
        }
    };

    // Get role badge class
    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'admin':
                return 'bg-red-100 text-red-800';
            case 'power_user':
                return 'bg-purple-100 text-purple-800';
            case 'normal':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">User Management</h3>
            
            <div className="flex justify-between items-center mb-4">
                <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button
                        onClick={() => setFilterRole('all')}
                        className={`px-3 py-1 text-sm font-medium rounded-l-md ${filterRole === 'all'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        All Users
                    </button>
                    <button
                        onClick={() => setFilterRole('admin')}
                        className={`px-3 py-1 text-sm font-medium ${filterRole === 'admin'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        Admins
                    </button>
                    <button
                        onClick={() => setFilterRole('power_user')}
                        className={`px-3 py-1 text-sm font-medium ${filterRole === 'power_user'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        Power Users
                    </button>
                    <button
                        onClick={() => setFilterRole('normal')}
                        className={`px-3 py-1 text-sm font-medium rounded-r-md ${filterRole === 'normal'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        Normal Users
                    </button>
                </div>
                
                <button
                    onClick={() => setShowAddUserForm(true)}
                    className="bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors text-sm"
                >
                    <i className="fas fa-user-plus mr-1"></i> Add User
                </button>
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {showAddUserForm ? (
                <AddUserForm 
                    onCancel={() => setShowAddUserForm(false)} 
                    onUserAdded={(newUser) => {
                        setUsers(prevUsers => [newUser, ...prevUsers]);
                        setShowAddUserForm(false);
                    }}
                />
            ) : (
                <>
                    {isLoading ? (
                        <div className="flex justify-center items-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="ml-3">Loading users...</p>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-500">No users found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Username
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Role
                                        </th>
                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {user.username}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                {user.email}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeClass(user.profile?.role)}`}>
                                                    {getRoleDisplay(user.profile?.role)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex justify-end space-x-3">
                                                    <select
                                                        value={user.profile?.role || 'normal'}
                                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                        className="text-sm border border-gray-300 rounded-md p-1"
                                                    >
                                                        <option value="normal">Normal User</option>
                                                        <option value="power_user">Power User</option>
                                                        <option value="admin">Admin</option>
                                                    </select>
                                                    <button
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Delete User"
                                                    >
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function AddUserForm({ onCancel, onUserAdded }) {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        role: 'normal'
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Clear error when field is edited
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};
        
        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        }
        
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }
        
        if (!formData.password.trim()) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validate()) {
            return;
        }
        
        setIsSubmitting(true);
        
        try {
            const response = await api.post('/api/users/', formData);
            onUserAdded(response.data);
        } catch (err) {
            console.error('Error creating user:', err);
            
            // Handle API validation errors
            if (err.response?.data) {
                setErrors(prev => ({
                    ...prev,
                    ...err.response.data,
                    general: 'Failed to create user. Please check the form for errors.'
                }));
            } else {
                setErrors(prev => ({
                    ...prev,
                    general: 'Failed to create user. Please try again.'
                }));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-gray-50 p-4 rounded-lg border mb-4">
            <h3 className="text-lg font-semibold mb-3">Add New User</h3>
            
            {errors.general && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {errors.general}
                </div>
            )}
            
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm" htmlFor="username">
                            Username*
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                            value={formData.username}
                            onChange={handleChange}
                        />
                        {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm" htmlFor="email">
                            Email*
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                            value={formData.email}
                            onChange={handleChange}
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm" htmlFor="first_name">
                            First Name
                        </label>
                        <input
                            id="first_name"
                            name="first_name"
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={formData.first_name}
                            onChange={handleChange}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm" htmlFor="last_name">
                            Last Name
                        </label>
                        <input
                            id="last_name"
                            name="last_name"
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={formData.last_name}
                            onChange={handleChange}
                        />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm" htmlFor="password">
                            Password*
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                            value={formData.password}
                            onChange={handleChange}
                        />
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                    </div>
                    
                    <div>
                        <label className="block text-gray-700 font-medium mb-1 text-sm" htmlFor="role">
                            Role
                        </label>
                        <select
                            id="role"
                            name="role"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={formData.role}
                            onChange={handleChange}
                        >
                            <option value="normal">Normal User</option>
                            <option value="power_user">Power User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-3 py-2 bg-indigo-600 text-sm text-white rounded-md hover:bg-indigo-700 transition-colors"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center">
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Creating...
                            </span>
                        ) : 'Create User'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default UserManagement;
