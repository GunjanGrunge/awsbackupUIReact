import { useState } from 'react'
import { Container, Form, Button, Card, Alert } from 'react-bootstrap'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from './firebase'
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { TransferProvider } from './contexts/TransferContext';
import PrivateRoute from './components/PrivateRoute';
import NavigationBar from './components/Navbar';
import Home from './pages/Home';
import Folder from './pages/Folder';
import History from './pages/History';
import Cost from './pages/Cost';
import Login from './pages/Login';
import TransferProgress from './components/TransferProgress';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Footer from './components/Footer';
import AIAnalysis from './pages/AIAnalysis';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <TransferProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <PrivateRoute>
                    <div className="app-wrapper">
                      <NavigationBar />
                      <main className="main-content">
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/folder" element={<Folder />} />
                          <Route path="/history" element={<History />} />
                          <Route path="/cost" element={<Cost />} />
                          <Route 
                            path="/ai-analysis" 
                            element={
                              <PrivateRoute>
                                <AdminRoute>
                                  <AIAnalysis />
                                </AdminRoute>
                              </PrivateRoute>
                            } 
                          />
                        </Routes>
                      </main>
                      <TransferProgress />
                      <Footer />
                    </div>
                  </PrivateRoute>
                }
              />
            </Routes>
            <ToastContainer />
          </Router>
        </TransferProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
