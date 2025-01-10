import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
  const { currentUser } = useAuth();
  const adminEmail = "stdevilgunjan@gmail.com";

  if (currentUser?.email !== adminEmail) {
    return <Navigate to="/" />;
  }

  return children;
};

export default AdminRoute;
