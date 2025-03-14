import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

function Header({ currentWorkspace }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => {
        return location.pathname === path;
    };

    const handleCreateNew = () => {
        if (currentWorkspace && !window.confirm('Creating a new workspace will close your current workspace. Continue?')) {
            return;
        }
        navigate('/');
    };

    return (
        <header className="bg-indigo-600 text-white shadow-lg">
            <div className="container mx-auto px-4 py-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <i className="fas fa-shield-alt text-2xl"></i>
                        <Link to={currentWorkspace ? '/rulegen' : '/'} className="text-2xl font-bold">
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

                    {/* Desktop navigation */}
                    <div className="hidden md:flex items-center space-x-6">
                        {currentWorkspace && (
                            <div className="text-sm bg-indigo-700 px-3 py-1 rounded">
                                Workspace: {currentWorkspace.name}
                            </div>
                        )}
                        <nav className="flex space-x-6">
                            <Link
                                to="/rulegen"
                                className={`${isActive('/rulegen') ? 'text-white font-semibold' : 'text-indigo-200 hover:text-white'}`}
                            >
                                Rule Generation
                            </Link>
                            <Link
                                to="/history"
                                className={`${isActive('/history') ? 'text-white font-semibold' : 'text-indigo-200 hover:text-white'}`}
                            >
                                History
                            </Link>
                            <Link
                                to="/prompts"
                                className={`${isActive('/prompts') ? 'text-white font-semibold' : 'text-indigo-200 hover:text-white'}`}
                            >
                                Prompt Manager
                            </Link>
                        </nav>
                        <button
                            onClick={handleCreateNew}
                            className="bg-white text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100 transition-colors"
                        >
                            New Workspace
                        </button>
                    </div>
                </div>

                {/* Mobile navigation */}
                {mobileMenuOpen && (
                    <div className="mt-4 pb-2 md:hidden">
                        {currentWorkspace && (
                            <div className="text-sm bg-indigo-700 px-3 py-1 rounded mb-4">
                                Workspace: {currentWorkspace.name}
                            </div>
                        )}
                        <nav className="flex flex-col space-y-3">
                            <Link
                                to="/rulegen"
                                className={`${isActive('/rulegen') ? 'text-white font-semibold' : 'text-indigo-200 hover:text-white'}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Rule Generation
                            </Link>
                            <Link
                                to="/history"
                                className={`${isActive('/history') ? 'text-white font-semibold' : 'text-indigo-200 hover:text-white'}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                History
                            </Link>
                            <Link
                                to="/prompts"
                                className={`${isActive('/prompts') ? 'text-white font-semibold' : 'text-indigo-200 hover:text-white'}`}
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                Prompt Manager
                            </Link>
                            <button
                                onClick={() => {
                                    handleCreateNew();
                                    setMobileMenuOpen(false);
                                }}
                                className="bg-white text-indigo-600 px-3 py-1 rounded hover:bg-indigo-100 transition-colors self-start"
                            >
                                New Workspace
                            </button>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
