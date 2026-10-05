import { Redirect } from 'expo-router';
import DashboardScreen from '../../screens/DashboardScreen';
import { useAuth } from '../../auth/AuthContext';

export default function IndexRoute() {
  const { user } = useAuth();
  if (user?.role === 'parent') return <Redirect href="/my-ward" />;
  // Teachers have no dashboard -- they start on Results, same as the web app.
  if (user?.role === 'teacher') return <Redirect href="/results" />;
  return <DashboardScreen />;
}
