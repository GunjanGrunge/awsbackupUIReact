import { useState } from 'react'
import { Container, Form, Button, Card, Alert } from 'react-bootstrap'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import PrivateRoute from './components/PrivateRoute';
import NavigationBar from './components/Navbar';
import Home from './pages/Home';
import Folder from './pages/Folder';
import History from './pages/History';
import Cost from './pages/Cost';
import Login from './pages/Login';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Footer from './components/Footer';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <>
                    <NavigationBar />
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/folder" element={<Folder />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/cost" element={<Cost />} />
                      <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                    <Footer />
                  </>
                </PrivateRoute>
              }
            />
          </Routes>
          <ToastContainer 
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="colored"
          />
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
