import { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is already logged in
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const response = await api.get('/api/auth/user/');
            setUser(response.data);
        } catch (error) {
            // User is not authenticated
            console.log('User not authenticated');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = (userData) => {
        setUser(userData);
    };

    const logout = async () => {
        try {
            const response = await api.post('/api/auth/logout/');
            
            // Clear any user-related localStorage data
            if (response.data.user_id) {
                // Clear workspace data for this user
                localStorage.removeItem(`workspace-${response.data.user_id}`);
                
                // Clear any other user-specific localStorage items
                localStorage.removeItem('isNewWorkspace');
            }
            
            // Clear all user data from state
            setUser(null);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Helper functions to check user roles
    const isAdmin = () => {
        return user && (user.isAdmin === true || user.role === 'admin');
    };

    const isPowerUser = () => {
        return user && (user.isPowerUser === true || user.role === 'power_user' || user.role === 'admin');
    };

    const isNormalUser = () => {
        return user && !isAdmin() && !isPowerUser();
    };

    const value = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        isAdmin,
        isPowerUser,
        isNormalUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
