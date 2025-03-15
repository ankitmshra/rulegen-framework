import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import WorkspaceSelector from './components/WorkspaceSelector';
import RuleGeneration from './components/RuleGeneration';
import PromptManager from './components/PromptManager';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

// Component to handle location state
function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [previousWorkspace, setPreviousWorkspace] = useState(null);
  const { user, loading } = useAuth();

  // Load current workspace from localStorage on mount
  useEffect(() => {
    if (user) {
      const savedWorkspace = localStorage.getItem(`workspace-${user.id}`);
      if (savedWorkspace) {
        try {
          setCurrentWorkspace(JSON.parse(savedWorkspace));
        } catch (e) {
          console.error('Error parsing saved workspace:', e);
          localStorage.removeItem(`workspace-${user.id}`);
        }
      }
    }
  }, [user]);

  // Handle workspace switching from location state
  useEffect(() => {
    if (location.state?.newWorkspace && user) {
      if (currentWorkspace) {
        setPreviousWorkspace(currentWorkspace);
      }

      const newWorkspace = location.state.newWorkspace;
      const isNewWorkspace = location.state.isNewWorkspace;

      setCurrentWorkspace(newWorkspace);

      // Store the isNewWorkspace flag in localStorage to inform components
      if (isNewWorkspace) {
        localStorage.setItem('isNewWorkspace', 'true');
      } else {
        localStorage.removeItem('isNewWorkspace');
      }

      // Navigate to rulegen with the new workspace
      if (location.pathname !== '/rulegen') {
        navigate('/rulegen', { replace: true });
      }

      // Clear the location state to prevent re-setting on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, user, currentWorkspace, navigate, location.pathname]);

  // Save current workspace to localStorage when it changes
  useEffect(() => {
    if (currentWorkspace && user) {
      localStorage.setItem(`workspace-${user.id}`, JSON.stringify(currentWorkspace));
    } else if (user) {
      localStorage.removeItem(`workspace-${user.id}`);
    }
  }, [currentWorkspace, user]);

  const switchWorkspace = (workspace) => {
    if (currentWorkspace) {
      setPreviousWorkspace(currentWorkspace);
    }
    setCurrentWorkspace(workspace);
  };

  const restorePreviousWorkspace = () => {
    if (previousWorkspace) {
      setCurrentWorkspace(previousWorkspace);
      setPreviousWorkspace(null);
      return true;
    }
    return false;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="ml-3 text-gray-700">Loading application...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
      
      {/* Main Layout with sidebar tabs */}
      <Route element={<MainLayout currentWorkspace={currentWorkspace} />}>
        <Route
          path="/"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : currentWorkspace ? (
              <Navigate to="/rulegen" />
            ) : (
              <Navigate to="/workspace/new" />
            )
          }
        />
        
        <Route
          path="/workspace/new"
          element={
            <ProtectedRoute>
              <WorkspaceSelector setCurrentWorkspace={switchWorkspace} />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/rulegen"
          element={
            <ProtectedRoute>
              {currentWorkspace ? (
                <RuleGeneration
                  workspace={currentWorkspace}
                  setWorkspace={setCurrentWorkspace}
                />
              ) : (
                <Navigate to="/workspace/new" />
              )}
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/prompts"
          element={
            <ProtectedRoute>
              <PromptManager />
            </ProtectedRoute>
          }
        />
      </Route>
      
      {/* Catch all route - redirect to login if not authenticated, or home if authenticated */}
      <Route path="*" element={!user ? <Navigate to="/login" /> : <Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
