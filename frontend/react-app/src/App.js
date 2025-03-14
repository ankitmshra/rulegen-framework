import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import WorkspaceSelector from './components/WorkspaceSelector';
import RuleGeneration from './components/RuleGeneration';
import History from './components/History';
import PromptManager from './components/PromptManager';
import './index.css';

function App() {
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [previousWorkspace, setPreviousWorkspace] = useState(null);

  // Load current workspace from localStorage on mount
  useEffect(() => {
    const savedWorkspace = localStorage.getItem('currentWorkspace');
    if (savedWorkspace) {
      try {
        setCurrentWorkspace(JSON.parse(savedWorkspace));
      } catch (e) {
        console.error('Error parsing saved workspace:', e);
        localStorage.removeItem('currentWorkspace');
      }
    }
  }, []);

  // Save current workspace to localStorage when it changes
  useEffect(() => {
    if (currentWorkspace) {
      localStorage.setItem('currentWorkspace', JSON.stringify(currentWorkspace));
    } else {
      localStorage.removeItem('currentWorkspace');
    }
  }, [currentWorkspace]);

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

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header currentWorkspace={currentWorkspace} />

        <main className="flex-grow container mx-auto px-4 py-8">
          <Routes>
            <Route
              path="/"
              element={
                currentWorkspace ?
                  <Navigate to="/rulegen" /> :
                  <WorkspaceSelector setCurrentWorkspace={switchWorkspace} />
              }
            />
            <Route
              path="/rulegen"
              element={
                currentWorkspace ?
                  <RuleGeneration
                    workspace={currentWorkspace}
                    setWorkspace={setCurrentWorkspace}
                  /> :
                  <Navigate to="/" />
              }
            />
            <Route
              path="/history"
              element={
                <History
                  setWorkspace={switchWorkspace}
                  currentWorkspace={currentWorkspace}
                  restorePreviousWorkspace={restorePreviousWorkspace}
                />
              }
            />
            <Route
              path="/prompts"
              element={<PromptManager />}
            />
          </Routes>
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
    </Router>
  );
}

export default App;
