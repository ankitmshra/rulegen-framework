import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { workspaceAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setLoading(true);
        const response = await workspaceAPI.getSummary();
        setWorkspaces(response.data);
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  const createNewWorkspace = () => {
    // Navigate with state and use replace: true to avoid history issues
    navigate('/workspaces', { 
      state: { 
        showCreateModal: true,
        from: 'dashboard' // Add an indicator that we're coming from dashboard
      },
      replace: true
    });
  };

  // Group workspaces into "My Workspaces" and "Shared with Me"
  const myWorkspaces = workspaces.filter(workspace => workspace.is_owner);
  const sharedWorkspaces = workspaces.filter(workspace => !workspace.is_owner);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Welcome Header */}
      <div className="px-6 py-5 border-b border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900">Welcome, {currentUser.firstName || currentUser.username}!</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create or select a workspace to generate SpamAssassin rules
        </p>
      </div>

      {/* Dashboard Content */}
      <div className="px-6 py-5">
        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={createNewWorkspace}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center rounded-lg p-4 transition duration-150 ease-in-out"
            >
              <svg className="h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Workspace
            </button>
            
            <Link
              to="/workspaces"
              className="bg-green-50 hover:bg-green-100 text-green-700 flex items-center justify-center rounded-lg p-4 transition duration-150 ease-in-out"
            >
              <svg className="h-6 w-6 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              View All Workspaces
            </Link>
          </div>
        </div>

        {/* Recent Workspaces */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Workspaces</h2>
          
          {workspaces.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No workspaces found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new workspace.</p>
              <div className="mt-6">
                <button
                  onClick={createNewWorkspace}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Workspace
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* My Workspaces */}
              {myWorkspaces.length > 0 && (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">My Workspaces</h3>
                  <div className="bg-white shadow overflow-hidden rounded-md">
                    <ul className="divide-y divide-gray-200">
                      {myWorkspaces.slice(0, 5).map((workspace) => (
                        <li key={workspace.id}>
                          <Link
                            to={`/workspaces/${workspace.id}`}
                            className="block hover:bg-gray-50"
                          >
                            <div className="px-4 py-4 sm:px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                      {workspace.name.charAt(0).toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-indigo-600">{workspace.name}</div>
                                    <div className="text-sm text-gray-500">
                                      {workspace.rule_count || 0} rule{workspace.rule_count !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  {workspace.latest_date ? (
                                    <span>Updated {new Date(workspace.latest_date).toLocaleDateString()}</span>
                                  ) : (
                                    <span>No rules generated yet</span>
                                  )}
                                  <svg className="ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {myWorkspaces.length > 5 && (
                      <div className="bg-gray-50 px-4 py-3 text-center">
                        <Link to="/workspaces" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                          View all workspaces
                          <span aria-hidden="true"> &rarr;</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Shared Workspaces */}
              {sharedWorkspaces.length > 0 && (
                <div>
                  <h3 className="text-md font-medium text-gray-700 mb-3">Shared with Me</h3>
                  <div className="bg-white shadow overflow-hidden rounded-md">
                    <ul className="divide-y divide-gray-200">
                      {sharedWorkspaces.slice(0, 5).map((workspace) => (
                        <li key={workspace.id}>
                          <Link
                            to={`/workspaces/${workspace.id}`}
                            className="block hover:bg-gray-50"
                          >
                            <div className="px-4 py-4 sm:px-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0">
                                    <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                                      {workspace.name.charAt(0).toUpperCase()}
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-green-600">{workspace.name}</div>
                                    <div className="text-sm text-gray-500">
                                      Owner: {workspace.owner_username}
                                      <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        workspace.permission === 'write' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {workspace.permission === 'write' ? 'Read & Write' : 'Read Only'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  {workspace.latest_date ? (
                                    <span>Updated {new Date(workspace.latest_date).toLocaleDateString()}</span>
                                  ) : (
                                    <span>No rules generated yet</span>
                                  )}
                                  <svg className="ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {sharedWorkspaces.length > 5 && (
                      <div className="bg-gray-50 px-4 py-3 text-center">
                        <Link to="/workspaces" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                          View all shared workspaces
                          <span aria-hidden="true"> &rarr;</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 