// src/components/ProtectedRoute.jsx
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';

export default function ProtectedRoute({ children }) {
  const [user, setUser] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <p className="text-center mt-10">Checking auth...</p>;

  return user ? children : <Navigate to="/" />;
}


ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
