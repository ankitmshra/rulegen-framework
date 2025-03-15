import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import ContentTabs from './ContentTabs';
import { useAuth } from '../context/AuthContext';

function MainLayout({ currentWorkspace }) {
    const { user } = useAuth();
    const location = useLocation();
    
    // Determine if tabs should be shown
    const showTabs = user && 
        (location.pathname.includes('/rulegen') || location.pathname.includes('/prompts')) &&
        currentWorkspace;

    // Determine if content should be full width
    const isWorkspacePage = location.pathname === '/workspace/new';
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {user && <Header />}
            
            <main className="flex-grow container mx-auto px-4 py-8">
                {isWorkspacePage ? (
                    // Workspace selector page - full width
                    <div className="w-full">
                        <Outlet />
                    </div>
                ) : (
                    // Content pages with sidebar
                    <div className="flex flex-col md:flex-row">
                        {showTabs && (
                            <div className="w-full md:w-64 mb-6 md:mb-0 md:mr-6">
                                <ContentTabs currentWorkspace={currentWorkspace} />
                            </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                            <Outlet />
                        </div>
                    </div>
                )}
            </main>
            
            <footer className="bg-gray-800 text-white py-6">
                <div className="container mx-auto px-4">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <div className="mb-4 md:mb-0">
                            <span className="text-sm">SA Codex - TA - BCI</span>
                        </div>
                        <div>
                            <ul className="flex space-x-4">
                                <li>
                                    <button className="text-gray-400 hover:text-white">
                                        <i className="fab fa-github"></i>
                                    </button>
                                </li>
                                <li>
                                    <button className="text-gray-400 hover:text-white">
                                        <i className="fas fa-envelope"></i>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

export default MainLayout;
