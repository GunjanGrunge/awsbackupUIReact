import React, { useState, useEffect } from 'react';
import { FaRobot, FaSpinner, FaDownload } from 'react-icons/fa';
import { marked } from 'marked';
import html2pdf from 'html2pdf.js';
import { useAuth } from '../contexts/AuthContext';
import { analyzeUserData } from '../services/openaiService';
import { getHistoryLog } from '../services/historyService';
import { getCostData } from '../services/costService';
import { listS3Objects } from '../services/s3Service';
import './AIAnalysis.css';

const AIAnalysis = () => {
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    analyzeUserSystem();
  }, []);

  const analyzeUserSystem = async () => {
    try {
      // Get user data with error handling
      const historyLog = await getHistoryLog().catch(() => ({}));
      const costData = await getCostData().catch(() => ({}));
      const s3Files = await listS3Objects().catch(() => ([]));
      
      const userData = {
        username: currentUser?.displayName || currentUser?.email?.split('@')[0],
        historyLog: historyLog || {},
        costData: costData || {},
        s3Files: s3Files || [],
        timestamp: new Date().toISOString(),
        userEmail: currentUser?.email
      };

      const result = await analyzeUserData(userData);
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysis('Failed to generate analysis. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const createPDF = () => {
    const element = document.getElementById('analysis-content');
    const opt = {
      margin: [0.5, 0.5],
      filename: `aws-analysis-report-${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    const brandedContent = `
      <div class="pdf-container">
        <div class="pdf-header">
          <div class="header-content">
            <img src="/aws-logo.png" alt="AWS Logo" class="pdf-logo" />
            <div class="header-text">
              <h1>AWS File System Analysis</h1>
              <p class="report-meta">Generated for ${currentUser?.email} on ${new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
        <div class="pdf-body">
          ${element.innerHTML}
        </div>
        <div class="pdf-footer">
          <p>AWS File Manager AI Assistant | Confidential Report</p>
          <p class="page-number"></p>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = brandedContent;
    tempDiv.className = 'pdf-container';
    
    html2pdf().set(opt).from(tempDiv).save();
  };

  const renderMarkdown = (content) => {
    return { __html: marked(content) };
  };

  return (
    <div className="ai-analysis-page">
      <div className="ai-header">
        <FaRobot className="ai-icon" />
        <h1>System Analysis</h1>
        <p>AI-powered insights about your file management system</p>
      </div>

      <div className="analysis-container">
        {isAnalyzing ? (
          <div className="loading-state">
            <FaSpinner className="spinner" />
            <p>Analyzing your system data...</p>
          </div>
        ) : (
          <>
            {analysis && (
              <div className="analysis-wrapper">
                <div className="analysis-actions">
                  <button 
                    className="download-report-btn"
                    onClick={createPDF}
                  >
                    <FaDownload /> Download Report
                  </button>
                </div>
                
                <div 
                  id="analysis-content"
                  className="analysis-content"
                  dangerouslySetInnerHTML={renderMarkdown(analysis)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AIAnalysis;
