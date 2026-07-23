import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import Events from '@/pages/Events';
import MyClubs from '@/pages/MyClubs';
import Clubs from '@/pages/Clubs';
import ClubDetail from '@/pages/ClubDetail';
import LogActivity from '@/pages/LogActivity';
import Leagues from '@/pages/Leagues';
import Profile from '@/pages/Profile';
import ClubPortal from '@/pages/ClubPortal';
import People from '@/pages/People';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Events />} />
        <Route path="/home" element={<Home />} />
        <Route path="/clubs" element={<Clubs />} />
        <Route path="/my-clubs" element={<MyClubs />} />
        <Route path="/clubs/:id" element={<ClubDetail />} />
        <Route path="/log" element={<LogActivity />} />
        <Route path="/leaderboard" element={<Leagues />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/club-portal" element={<ClubPortal />} />
        <Route path="/people" element={<People />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App