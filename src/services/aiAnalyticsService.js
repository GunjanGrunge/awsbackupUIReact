import { getDetailedCostData } from './costExplorerService';
import { 
  getBucketMetrics, 
  getDetailedFolderStructure, 
  formatFileSize 
} from './s3Service';
import { getHistoryLog } from './historyService';
import { getCostData } from './costService';

// Add these helper functions before getConsolidatedAnalysis
const groupCostsByMonth = (dailyCosts) => {
  return dailyCosts.reduce((acc, { date, cost }) => {
    const monthKey = date.substring(0, 7); // Gets YYYY-MM format
    acc[monthKey] = (acc[monthKey] || 0) + cost;
    return acc;
  }, {});
};

const calculateTrends = (costs) => {
  const entries = Object.entries(costs);
  if (entries.length < 2) return { change: 0, trend: 'stable' };

  const current = entries[entries.length - 1][1];
  const previous = entries[entries.length - 2][1];
  const change = ((current - previous) / previous) * 100;

  return {
    change,
    trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable'
  };
};

const identifyCostSpikes = (dailyCosts) => {
  if (!dailyCosts.length) return [];

  const mean = dailyCosts.reduce((sum, { cost }) => sum + cost, 0) / dailyCosts.length;
  const stdDev = Math.sqrt(
    dailyCosts.reduce((sum, { cost }) => sum + Math.pow(cost - mean, 2), 0) / dailyCosts.length
  );
  const threshold = mean + (2 * stdDev);

  return dailyCosts
    .filter(({ cost }) => cost > threshold)
    .map(({ date, cost }) => ({
      date,
      cost,
      percentage: ((cost - mean) / mean) * 100
    }));
};

const calculateMonthOverMonthChange = (monthlyCosts) => {
  const months = Object.keys(monthlyCosts).sort();
  if (months.length < 2) return 0;

  const currentMonth = monthlyCosts[months[months.length - 1]];
  const previousMonth = monthlyCosts[months[months.length - 2]];

  return previousMonth ? (currentMonth - previousMonth) / previousMonth : 0;
};

// Add these helper functions before analyzeUsagePatterns
const calculateHourlyDistribution = (history = []) => {
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  const hourlyDistribution = new Array(24).fill(0);
  
  safeHistory.forEach(entry => {
    if (entry && entry.date) {
      const hour = new Date(entry.date).getHours();
      hourlyDistribution[hour]++;
    }
  });
  
  return {
    distribution: hourlyDistribution,
    peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
    totalActions: hourlyDistribution.reduce((a, b) => a + b, 0)
  };
};

const calculateWeeklyPatterns = (history = []) => {
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  const weeklyDistribution = new Array(7).fill(0);
  
  safeHistory.forEach(entry => {
    if (entry && entry.date) {
      const day = new Date(entry.date).getDay();
      weeklyDistribution[day]++;
    }
  });
  
  return {
    distribution: weeklyDistribution,
    peakDay: weeklyDistribution.indexOf(Math.max(...weeklyDistribution)),
    totalActions: weeklyDistribution.reduce((a, b) => a + b, 0)
  };
};

const categorizeOperations = (history = []) => {
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  
  return safeHistory.reduce((acc, entry) => {
    if (entry && entry.action) {
      const operation = entry.action;
      acc[operation] = (acc[operation] || 0) + 1;
    }
    return acc;
  }, {});
};

const identifyPeakPeriods = (history = []) => {
  // Ensure history is an array
  const safeHistory = Array.isArray(history) ? history : [];
  const periods = {};
  const timeWindow = 3600000; // 1 hour in milliseconds
  
  safeHistory.forEach(entry => {
    if (entry && entry.date) {
      const timestamp = new Date(entry.date).getTime();
      const windowStart = Math.floor(timestamp / timeWindow) * timeWindow;
      periods[windowStart] = (periods[windowStart] || 0) + 1;
    }
  });
  
  const averageActions = Object.values(periods).reduce((a, b) => a + b, 0) / Object.keys(periods).length;
  
  return Object.entries(periods)
    .filter(([_, count]) => count > averageActions * 1.5) // 50% above average
    .map(([timestamp, count]) => ({
      startTime: new Date(parseInt(timestamp)),
      count,
      percentage: ((count - averageActions) / averageActions) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Top 5 peak periods
};

export const getConsolidatedAnalysis = async () => {
  try {
    // Fetch all data in parallel with proper destructuring
    const [
      costExplorerData,
      bucketMetrics,
      folderStructure,
      historyLog,  // Add historyLog to destructuring
      costData
    ] = await Promise.all([
      getDetailedCostData(),
      getBucketMetrics(),
      getDetailedFolderStructure(),
      getHistoryLog(),     // Add getHistoryLog() to Promise.all
      getCostData()
    ]);

    // Ensure historyLog is an array
    const safeHistoryLog = Array.isArray(historyLog) ? historyLog : [];

    // Process storage metrics
    const storageMetrics = {
      totalSize: bucketMetrics.totalSize,
      totalObjects: bucketMetrics.totalObjects,
      averageFileSize: bucketMetrics.totalObjects ? 
        bucketMetrics.totalSize / bucketMetrics.totalObjects : 0,
      storageClasses: costData.storageClassStats || {},
      utilizationTrends: {
        daily: costExplorerData.dailyCosts,
        byService: costExplorerData.serviceCosts,
        byUsageType: costExplorerData.usageTypes
      }
    };

    // Process cost analytics with safe history
    const costAnalytics = {
      current: {
        storage: costData.monthlyCosts?.storage || 0,
        transfer: costData.monthlyCosts?.transfer || 0,
        requests: costData.monthlyCosts?.requests || 0,
        total: costData.totalMonthlyCost || 0
      },
      projected: costData.projectedCosts || {},
      historical: {
        daily: costExplorerData.dailyCosts,
        monthly: costExplorerData.monthlyCosts,
        serviceBreakdown: costExplorerData.serviceCosts
      },
      metrics: {
        costPerGB: calculateCostPerGB(costData, bucketMetrics),
        costPerRequest: calculateCostPerRequest(costData, safeHistoryLog),  // Use safeHistoryLog
        transferCosts: analyzeTransferCosts(costExplorerData)
      },
      trends: analyzeSpendingTrends(costExplorerData)
    };

    // Process folder analytics
    const folderAnalytics = analyzeFolderStructure(folderStructure);

    // Process usage patterns with safe history
    const usagePatterns = analyzeUsagePatterns(safeHistoryLog);  // Use safeHistoryLog

    // Compile recommendations
    const recommendations = generateRecommendations({
      storage: storageMetrics,
      costs: costAnalytics,
      folders: folderAnalytics,
      usage: usagePatterns
    });

    return {
      summary: {
        totalStorage: formatFileSize(storageMetrics.totalSize),
        totalCost: costAnalytics.current.total,
        projectedCost: costAnalytics.projected.total,
        activeObjects: storageMetrics.totalObjects,
        costTrend: costAnalytics.trends.monthOverMonth
      },
      storageMetrics,
      costAnalytics,
      folderAnalytics,
      usagePatterns,
      recommendations,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in consolidated analysis:', error);
    throw new Error('Failed to generate consolidated analysis');
  }
};

// Helper functions
const calculateCostPerGB = (costData, metrics) => {
  const storageGB = metrics.totalSize / (1024 * 1024 * 1024);
  return storageGB > 0 ? costData.monthlyCosts?.storage / storageGB : 0;
};

const calculateCostPerRequest = (costData, history) => {
  const totalRequests = history.length;
  return totalRequests > 0 ? costData.monthlyCosts?.requests / totalRequests : 0;
};

const analyzeTransferCosts = (costExplorerData) => {
  const transferTypes = Object.entries(costExplorerData.usageTypes)
    .filter(([key]) => key.includes('DataTransfer'))
    .reduce((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});

  return {
    byType: transferTypes,
    total: Object.values(transferTypes).reduce((sum, { cost }) => sum + cost, 0)
  };
};

const analyzeFolderStructure = (structure) => {
  const stats = {
    totalFolders: 0,
    totalFiles: 0,
    deepestNesting: 0,
    averageNesting: 0,
    sizeDistribution: {},
    largestFolders: [],
    unusedFolders: []
  };

  const analyzePath = (struct, level = 0, path = '') => {
    Object.entries(struct).forEach(([name, item]) => {
      if (item.type === 'folder') {
        stats.totalFolders++;
        stats.deepestNesting = Math.max(stats.deepestNesting, level);
        
        const sizeCategory = categorizeFolderSize(item.size);
        stats.sizeDistribution[sizeCategory] = (stats.sizeDistribution[sizeCategory] || 0) + 1;

        if (isUnusedFolder(item)) {
          stats.unusedFolders.push({ path: path + name, size: item.size });
        }

        analyzePath(item.contents, level + 1, path + name + '/');
      } else {
        stats.totalFiles++;
      }
    });
  };

  analyzePath(structure);
  return stats;
};

const analyzeSpendingTrends = (costData) => {
  // Ensure dailyCosts is an array with the correct structure
  const daily = Array.isArray(costData.dailyCosts) ? costData.dailyCosts : [];
  const monthly = groupCostsByMonth(daily);
  
  return {
    daily: calculateTrends(daily.reduce((acc, { date, cost }) => {
      acc[date] = cost;
      return acc;
    }, {})),
    monthly: calculateTrends(monthly),
    monthOverMonth: calculateMonthOverMonthChange(monthly),
    spikes: identifyCostSpikes(daily)
  };
};

// Update the analyzeUsagePatterns function to use these helpers
const analyzeUsagePatterns = (history) => {
  return {
    hourlyDistribution: calculateHourlyDistribution(history),
    weeklyPatterns: calculateWeeklyPatterns(history),
    operationTypes: categorizeOperations(history),
    peakPeriods: identifyPeakPeriods(history)
  };
};

const generateRecommendations = (data) => {
  const recommendations = [];

  // Storage class recommendations
  if (data.storage.totalSize > 1024 * 1024 * 1024 * 100) { // 100GB
    recommendations.push({
      type: 'storage_class',
      title: 'Consider Infrequent Access Storage',
      impact: 'high',
      description: 'Large storage volume could benefit from S3 Standard-IA for less frequently accessed data.'
    });
  }

  // Cost optimization recommendations
  if (data.costs.trends.monthOverMonth > 0.2) { // 20% increase
    recommendations.push({
      type: 'cost_optimization',
      title: 'Investigate Cost Increase',
      impact: 'high',
      description: `Monthly costs have increased by ${(data.costs.trends.monthOverMonth * 100).toFixed(1)}%.`
    });
  }

  // Add more recommendation logic as needed

  return recommendations;
};

const categorizeFolderSize = (size) => {
  const GB = 1024 * 1024 * 1024;
  if (size > 100 * GB) return 'very-large';
  if (size > 10 * GB) return 'large';
  if (size > 1 * GB) return 'medium';
  return 'small';
};

const isUnusedFolder = (folder) => {
  const now = new Date();
  const lastAccess = new Date(folder.lastModified);
  const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
  return daysSinceAccess > 30;
};

export default getConsolidatedAnalysis;
