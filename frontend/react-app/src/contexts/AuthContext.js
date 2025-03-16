import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI } from '../services/api';

// Create Authentication Context
const AuthContext = createContext();

// Create Provider Component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        const response = await authAPI.getCurrentUser();
        if (response.data.authenticated) {
          setCurrentUser(response.data);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error('Authentication check failed:', err);
        setCurrentUser(null);
        setError('Failed to check authentication status');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authAPI.login(username, password);
      setCurrentUser(response.data.user);
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);
      await authAPI.logout();
      setCurrentUser(null);
      
      // Clear localStorage items related to the app
      localStorage.removeItem('selectedWorkspace');
      localStorage.removeItem('lastVisitedTab');
      
      // Redirect to login page
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed:', err);
      setError('Failed to logout');
    } finally {
      setLoading(false);
    }
  };

  // Update user function (for admin user management)
  const updateUserData = (userData) => {
    setCurrentUser(userData);
  };

  // Check if user has admin role
  const isAdmin = () => {
    return currentUser?.isAdmin || currentUser?.role === 'admin';
  };

  // Check if user has power user role
  const isPowerUser = () => {
    return currentUser?.isPowerUser || currentUser?.role === 'power_user' || isAdmin();
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    updateUserData,
    isAdmin,
    isPowerUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
