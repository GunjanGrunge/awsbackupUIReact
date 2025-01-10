import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Table from './Table';

const AdminPage = () => {
  const [users, setUsers] = useState([]);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchAllFiles();
  }, []);

  const fetchUsers = async () => {
    const usersCollection = collection(db, 'users');
    const userSnapshot = await getDocs(usersCollection);
    const userList = userSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setUsers(userList);
  };

  const fetchAllFiles = async () => {
    const filesCollection = collection(db, 'files');
    const fileSnapshot = await getDocs(filesCollection);
    const fileList = fileSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    setFiles(fileList);
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      await deleteDoc(doc(db, 'users', userId));
      fetchUsers();
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      await deleteDoc(doc(db, 'files', fileId));
      fetchAllFiles();
    }
  };

  return (
    <div className="container mt-4">
      <div className="admin-container">
        <h2 className="mb-4">Admin Dashboard</h2>
        
        <section className="users-section mb-5">
          <h3 className="mb-3">Users Management</h3>
          <Table
            data={users}
            columns={[
              { header: 'Email', key: 'email' },
              { header: 'Last Login', key: 'lastLogin' },
              {
                header: 'Actions',
                key: 'actions',
                render: (row) => (
                  <button 
                    onClick={() => handleDeleteUser(row.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                )
              }
            ]}
          />
        </section>

        <section className="files-section">
          <h3 className="mb-3">Files Management</h3>
          <Table
            data={files}
            columns={[
              { header: 'File Name', key: 'fileName' },
              { header: 'Upload Date', key: 'uploadDate' },
              { header: 'User', key: 'userEmail' },
              {
                header: 'Actions',
                key: 'actions',
                render: (row) => (
                  <button 
                    onClick={() => handleDeleteFile(row.id)}
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                )
              }
            ]}
          />
        </section>
      </div>
    </div>
  );
};

export default AdminPage;
