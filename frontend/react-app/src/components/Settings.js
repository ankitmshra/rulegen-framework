import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserManagement from './UserManagement';

function Settings() {
    const [activeTab, setActiveTab] = useState('general');
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();

    if (!user) {
        navigate('/login');
        return null;
    }

    // Define available tabs based on user role
    const tabs = [
        { id: 'general', label: 'General', icon: 'fa-sliders-h' },
        { id: 'profile', label: 'My Profile', icon: 'fa-user' },
    ];
    
    // Add User Management tab for admins
    if (isAdmin()) {
        tabs.push({ id: 'users', label: 'User Management', icon: 'fa-users' });
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            
            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar */}
                <div className="md:w-64 shrink-0">
                    <ul className="space-y-1">
                        {tabs.map(tab => (
                            <li key={tab.id}>
                                <button
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center p-3 rounded-md transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'hover:bg-gray-100 text-gray-700'
                                    }`}
                                >
                                    <i className={`fas ${tab.icon} w-6`}></i>
                                    <span>{tab.label}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* Content area */}
                <div className="flex-1">
                    {activeTab === 'general' && <GeneralSettings />}
                    {activeTab === 'profile' && <ProfileSettings user={user} />}
                    {activeTab === 'users' && isAdmin() && <UserManagement />}
                </div>
            </div>
        </div>
    );
}

function GeneralSettings() {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">General Settings</h3>
            <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-md">
                    <p className="text-gray-600">
                        General application settings will be available here in future updates.
                    </p>
                </div>
            </div>
        </div>
    );
}

function ProfileSettings({ user }) {
    return (
        <div>
            <h3 className="text-xl font-semibold mb-4">My Profile</h3>
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-md">
                        <h4 className="text-md font-medium mb-2">Username</h4>
                        <p className="text-gray-700">{user.username}</p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-md">
                        <h4 className="text-md font-medium mb-2">Email</h4>
                        <p className="text-gray-700">{user.email}</p>
                    </div>
                    
                    <div className="p-4 bg-gray-50 rounded-md">
                        <h4 className="text-md font-medium mb-2">Role</h4>
                        <p className="text-gray-700">
                            {user.role === 'admin' ? 'Administrator' : 
                             user.role === 'power_user' ? 'Power User' : 
                             'Normal User'}
                        </p>
                    </div>
                </div>
                
                <div className="mt-4">
                    <h4 className="text-md font-medium mb-2">Change Password</h4>
                    <p className="text-gray-600 mb-2">
                        Password management will be available in a future update.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Settings;
