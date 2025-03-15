import { useNavigate, useLocation } from 'react-router-dom';

function ContentTabs({ currentWorkspace }) {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Determine active tab based on current route
    const activeTab = location.pathname.includes('/prompts') 
        ? 'prompts' 
        : location.pathname.includes('/rulegen') 
            ? 'rulegen' 
            : '';

    const handleTabChange = (tabName) => {
        navigate(`/${tabName}`);
    };

    return (
        <div className="flex flex-col h-full">
            {currentWorkspace && (
                <div className="p-4 bg-indigo-50 border-b border-indigo-100 mb-4">
                    <h2 className="text-lg font-semibold text-indigo-800">
                        Workspace: {currentWorkspace.name}
                    </h2>
                </div>
            )}
            
            <nav className="flex flex-col lg:w-64 md:w-48 w-full">
                <button
                    onClick={() => handleTabChange('rulegen')}
                    className={`text-left p-4 mb-2 rounded-md transition-colors ${
                        activeTab === 'rulegen'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                >
                    <i className="fas fa-magic mr-3"></i>
                    Rule Generation
                </button>
                <button
                    onClick={() => handleTabChange('prompts')}
                    className={`text-left p-4 mb-2 rounded-md transition-colors ${
                        activeTab === 'prompts'
                            ? 'bg-indigo-600 text-white'
                            : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                    }`}
                >
                    <i className="fas fa-file-alt mr-3"></i>
                    Prompt Manager
                </button>
            </nav>
        </div>
    );
}

export default ContentTabs;
