import { useState, useEffect } from 'react';
import api from '../../api';

function ModuleSelector({ selectedModules, setSelectedModules, disabled = false }) {
    const [modules, setModules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchModules();
    }, []);

    const fetchModules = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/prompt-templates/modules/');
            setModules(response.data);
        } catch (error) {
            console.error('Error fetching modules:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleModuleChange = (moduleType, isChecked) => {
        // Skip if disabled
        if (disabled) return;
        
        if (isChecked) {
            setSelectedModules(prev => [...prev, moduleType]);
        } else {
            setSelectedModules(prev => prev.filter(type => type !== moduleType));
        }
    };

    // Filter modules based on search term
    const filteredModules = modules.filter(module =>
        module.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        module.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold">Prompt Modules:</h3>
                    <div className="relative w-1/3">
                        <input
                            type="text"
                            placeholder="Search modules"
                            className={`w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm ${
                                disabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={disabled}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <i className="fas fa-search text-gray-400"></i>
                        </div>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">Select modules to include in the prompt:</p>

                {isLoading ? (
                    <div className="py-4 flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                    </div>
                ) : modules.length === 0 ? (
                    <p className="text-gray-500 py-2">No prompt modules available</p>
                ) : filteredModules.length === 0 ? (
                    <p className="text-gray-500 py-2">No modules match your search</p>
                ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {filteredModules.map(module => (
                            <div
                                key={module.id}
                                className="flex items-start space-x-3 border border-gray-200 p-3 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    id={`module-${module.module_type}`}
                                    className={`rounded text-indigo-600 focus:ring-indigo-500 mt-1 ${
                                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                                    checked={selectedModules.includes(module.module_type)}
                                    onChange={(e) => handleModuleChange(module.module_type, e.target.checked)}
                                    disabled={disabled}
                                />
                                <div>
                                    <label htmlFor={`module-${module.module_type}`} className="font-medium cursor-pointer">
                                        {module.name}
                                    </label>
                                    <div className="text-sm text-gray-500 mt-1">{module.description}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ModuleSelector;
