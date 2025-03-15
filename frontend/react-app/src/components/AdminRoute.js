import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AdminRoute({ children }) {
    const { user, loading, isAdmin } = useAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="ml-3 text-gray-700">Loading...</p>
            </div>
        );
    }

    // Redirect to home page if not authenticated or not admin
    if (!user || !isAdmin()) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // Render the protected admin component
    return children;
}

export default AdminRoute;
