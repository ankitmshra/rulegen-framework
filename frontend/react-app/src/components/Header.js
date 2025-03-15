import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleWorkspaceManager = () => {
        navigate('/workspace/new');
    };

    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to log out?')) {
            await logout();
            navigate('/login');
        }
    };

    return (
        <header className="bg-indigo-600 text-white shadow-lg">
            <div className="container mx-auto px-4 py-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <i className="fas fa-shield-alt text-2xl"></i>
                        <Link to="/" className="text-2xl font-bold">
                            SA Codex
                        </Link>
                    </div>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="text-white p-2"
                        >
                            <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
                        </button>
                    </div>

                    {/* Right side action buttons */}
                    <div className="hidden md:flex items-center space-x-4">
                        <button
                            onClick={handleWorkspaceManager}
                            className="bg-white text-indigo-600 px-4 py-2 rounded-md hover:bg-indigo-50 transition-colors font-medium"
                        >
                            <i className="fas fa-folder-open mr-2"></i> Workspaces
                        </button>
                        
                        <button
                            onClick={handleLogout}
                            className="text-indigo-200 hover:text-white"
                        >
                            <i className="fas fa-sign-out-alt mr-1"></i> Logout
                        </button>
                    </div>
                </div>

                {/* Mobile navigation */}
                {mobileMenuOpen && (
                    <div className="mt-4 pb-2 md:hidden">
                        <nav className="flex flex-col space-y-3">
                            <button
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    handleWorkspaceManager();
                                }}
                                className="text-indigo-200 hover:text-white text-left"
                            >
                                <i className="fas fa-folder-open mr-1"></i> Workspaces
                            </button>
                            <button
                                onClick={handleLogout}
                                className="text-indigo-200 hover:text-white text-left"
                            >
                                <i className="fas fa-sign-out-alt mr-1"></i> Logout
                            </button>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
