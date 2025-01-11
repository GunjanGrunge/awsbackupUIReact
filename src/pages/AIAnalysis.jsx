import React, { useState, useEffect } from 'react';
import { FaSpinner, FaDownload, FaSync } from 'react-icons/fa';
import { marked } from 'marked';
import html2pdf from 'html2pdf.js';
import { useAuth } from '../contexts/AuthContext';
import { analyzeUserData } from '../services/openaiService';
import { getHistoryLog } from '../services/historyService';
import { getCostData } from '../services/costService';
import { 
  listS3Objects, 
  getFolderSize, 
  getBucketMetrics,
  getDetailedFolderStructure 
} from '../services/s3Service';
import { getAIHistory, updateAIHistory } from '../services/aiHistoryService';
import aiLogo from '../images/ailogo.png';
import './AIAnalysis.css';
import { getConsolidatedAnalysis } from '../services/aiAnalyticsService';

const LOADING_MESSAGES = [
  "Analyzing your system data...",
  "Crunching the numbers...",
  "Scanning your data for insights...",
  "Generating your cost analysis report...",
  "Digging deep into your usage patterns...",
  "Identifying potential savings...",
  "Optimizing your data for better performance...",
  "Uncovering hidden cost drivers...",
  "Preparing detailed usage insights...",
  "Finalizing your personalized recommendations...",
  "Processing cost trends and projections...",
  "Loading detailed service analysis...",
  "Detecting unusual spending patterns...",
  "Reviewing storage class performance...",
  "Compiling resource usage statistics...",
  "Scanning for cost optimization opportunities...",
  "Calculating potential savings...",
  "Aggregating billing and usage data...",
  "Analyzing data transfer impacts...",
  "Refining insights for maximum efficiency...",
  "Evaluating service cost distribution...",
  "Sorting through storage metrics...",
  "Reviewing request activity trends...",
  "Exploring data for optimization routes...",
  "Assessing your cloud spending habits...",
  "Highlighting resource inefficiencies...",
  "Mapping out usage forecasts...",
  "Balancing cost and performance metrics...",
  "Discovering ways to lower expenses...",
  "Unlocking actionable cost-saving insights...",
  "Examining your storage usage in detail...",
  "Checking for redundant resources...",
  "Analyzing request frequency and cost impact...",
  "Gathering the latest cost metrics...",
  "Investigating underutilized resources...",
  "Calculating storage class efficiency...",
  "Detecting cost spikes across services...",
  "Reviewing cross-region data transfers...",
  "Modeling cost projections...",
  "Filtering high-cost operations...",
  "Optimizing data retrieval processes...",
  "Spotting trends in service utilization...",
  "Analyzing backup and disaster recovery costs...",
  "Monitoring resource scalability...",
  "Auditing recent usage anomalies...",
  "Estimating future resource demands...",
  "Cross-referencing billing data...",
  "Isolating costly data transfer paths...",
  "Scanning for outdated storage objects...",
  "Recommending usage adjustments...",
  "Evaluating lifecycle policy efficiency...",
  "Sorting data by service consumption...",
  "Reviewing multi-region storage expenses...",
  "Assessing request latency and impact...",
  "Processing historical cost trends...",
  "Pinpointing high-traffic services...",
  "Simulating cost-saving scenarios...",
  "Tracking data growth rates...",
  "Auditing service request volumes...",
  "Formulating detailed optimization plans...",
  // Additional 30 loading messages
  "Analyzing performance bottlenecks...",
  "Calculating optimal storage configurations...",
  "Reviewing access patterns for improvements...",
  "Detecting idle resources for cleanup...",
  "Measuring cost impact by region...",
  "Optimizing storage lifecycle rules...",
  "Breaking down data transfer costs...",
  "Reviewing historical usage spikes...",
  "Calculating projected monthly expenses...",
  "Auditing storage permissions for security...",
  "Prioritizing high-impact optimizations...",
  "Simplifying complex cost structures...",
  "Assessing object storage distribution...",
  "Identifying unused or forgotten services...",
  "Balancing storage performance and cost...",
  "Reviewing data redundancy levels...",
  "Forecasting upcoming resource demands...",
  "Detecting overprovisioned resources...",
  "Evaluating cost anomalies across accounts...",
  "Uncovering inefficient workflows...",
  "Adjusting cost models for accuracy...",
  "Scanning service logs for insights...",
  "Segmenting costs by department or team...",
  "Aligning storage strategies with budgets...",
  "Reviewing API request efficiency...",
  "Comparing actual vs. forecasted usage...",
  "Highlighting peak usage periods...",
  "Auditing multi-account cost allocation...",
  "Consolidating resource usage reports...",
  "Generating tailored optimization tips..."
];



const groupByTimeFrame = (data, timeFrame) => {
  const grouped = {};
  data.forEach(entry => {
    const date = new Date(entry.date);
    let key;
    
    switch(timeFrame) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const week = Math.floor(date.getDate() / 7);
        key = `${date.getFullYear()}-W${week}`;
        break;
      case 'month':
        key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        break;
      default:
        key = date.toISOString();
    }
    
    grouped[key] = (grouped[key] || 0) + 1;
  });
  return grouped;
};

const analyzeDownloadPatterns = (history) => {
  const downloads = history.filter(entry => entry.action === 'Download');
  return {
    frequency: groupByTimeFrame(downloads, 'day'),
    totalDownloads: downloads.length,
    averageSize: downloads.reduce((acc, curr) => acc + curr.size, 0) / downloads.length
  };
};

const identifyPeakUsage = (history) => {
  const hourlyUsage = new Array(24).fill(0);
  history.forEach(entry => {
    const hour = new Date(entry.date).getHours();
    hourlyUsage[hour]++;
  });
  return hourlyUsage;
};

const calculateDeepestNesting = (structure, level = 0) => {
  if (!structure || typeof structure !== 'object') return level;
  
  return Math.max(
    level,
    ...Object.values(structure)
      .filter(item => item.type === 'folder')
      .map(folder => calculateDeepestNesting(folder.contents, level + 1))
  );
};

const identifyLargestFolders = (structure) => {
  const folders = [];
  
  const traverse = (struct, path = '') => {
    Object.entries(struct).forEach(([name, item]) => {
      if (item.type === 'folder') {
        folders.push({
          path: path + name,
          size: item.size,
          lastModified: item.lastModified
        });
        traverse(item.contents, path + name + '/');
      }
    });
  };
  
  traverse(structure);
  return folders.sort((a, b) => b.size - a.size).slice(0, 5);
};

const findUnusedFolders = (structure, history, threshold = 30) => {
  const unused = [];
  const now = new Date();
  
  const traverse = (struct, path = '') => {
    Object.entries(struct).forEach(([name, item]) => {
      if (item.type === 'folder') {
        const lastAccess = new Date(item.lastModified);
        const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
        
        if (daysSinceAccess > threshold) {
          unused.push({
            path: path + name,
            daysSinceAccess: Math.floor(daysSinceAccess),
            size: item.size
          });
        }
        traverse(item.contents, path + name + '/');
      }
    });
  };
  
  traverse(structure);
  return unused;
};

const AIAnalysis = () => {
  const [analysis, setAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Changed to false initially
  const [lastAnalysisDate, setLastAnalysisDate] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const { currentUser } = useAuth();
  const [streamedContent, setStreamedContent] = useState('');

  useEffect(() => {
    loadLastAnalysis();
  }, []);

  const loadLastAnalysis = async () => {
    try {
      const aiHistory = await getAIHistory();
      if (aiHistory.lastAnalysis) {
        setAnalysis(aiHistory.lastAnalysis.report);
        setLastAnalysisDate(new Date(aiHistory.lastAnalysis.timestamp));
      }
    } catch (error) {
      console.error('Error loading last analysis:', error);
    }
  };

  // Add useEffect for loading message rotation
  useEffect(() => {
    let messageInterval;
    if (isAnalyzing) {
      messageInterval = setInterval(() => {
        setLoadingMessage(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]);
      }, 5000); // Change message every 2 seconds
    }
    return () => clearInterval(messageInterval);
  }, [isAnalyzing]);

  const analyzeUserSystem = async () => {
    try {
      setIsAnalyzing(true);
      setStreamedContent('');
      
      // This line gets all the consolidated data
      const consolidatedData = await getConsolidatedAnalysis();
      
      if (!consolidatedData) {
        throw new Error('Failed to fetch consolidated analysis data');
      }

      const handleChunk = (chunk) => {
        setStreamedContent(prev => prev + chunk);
      };

      // This line passes the data to OpenAI
      const result = await analyzeUserData(consolidatedData, handleChunk);
      
      // Update AI history and state
      await updateAIHistory(result);
      setAnalysis(result);
      setLastAnalysisDate(new Date());

    } catch (error) {
      console.error('Analysis failed:', error);
      setAnalysis('Failed to generate analysis. Please try again later.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper functions
  const getFolderStructure = async (prefix = '') => {
    try {
      // Use the new detailed function for AI analysis
      return await getDetailedFolderStructure(prefix);
    } catch (error) {
      console.error('Error getting folder structure:', error);
      return {};
    }
  };

  const calculateUploadFrequency = (history) => {
    const uploads = history.filter(entry => entry.action === 'Upload');
    return {
      daily: groupByTimeFrame(uploads, 'day'),
      weekly: groupByTimeFrame(uploads, 'week'),
      monthly: groupByTimeFrame(uploads, 'month')
    };
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

  const handleRefreshAnalysis = () => {
    analyzeUserSystem();
  };

  return (
    <div className="ai-analysis-page">
      <div className="ai-header">
        <img src={aiLogo} alt="AI Analysis" className="ai-icon" />
        <h1>Storage Analysis</h1>
        <p>AI-powered insights about your file management system</p>
      </div>

      <div className="analysis-container">
        <div className="analysis-wrapper">
          <div className="analysis-actions">
            <div className="analysis-meta">
              {lastAnalysisDate && (
                <span className="last-analysis-date">
                  Last analyzed: {lastAnalysisDate.toLocaleString()}
                </span>
              )}
            </div>
            <div className="action-buttons">
              <button 
                className="refresh-btn"
                onClick={handleRefreshAnalysis}
                disabled={isAnalyzing}
              >
                <FaSync className={isAnalyzing ? 'spinner' : ''} /> 
                {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
              </button>
              {analysis && (
                <button 
                  className="download-report-btn"
                  onClick={createPDF}
                >
                  <FaDownload /> Download Report
                </button>
              )}
            </div>
          </div>
          
          {isAnalyzing ? (
            <div className="loading-state">
              <FaSpinner className="spinner" />
              <p>{loadingMessage}</p>
              {streamedContent && (
                <div 
                  className="streamed-content"
                  dangerouslySetInnerHTML={renderMarkdown(streamedContent)}
                />
              )}
            </div>
          ) : analysis ? (
            <div 
              id="analysis-content"
              className="analysis-content"
              dangerouslySetInnerHTML={renderMarkdown(analysis)}
            />
          ) : (
            <div className="empty-state">
              <p>Click the Refresh Analysis button to generate a new report.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;
