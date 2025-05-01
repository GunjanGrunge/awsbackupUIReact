import { CostExplorerClient, GetCostAndUsageCommand } from "@aws-sdk/client-cost-explorer";

const costExplorerClient = new CostExplorerClient({
  region: import.meta.env.VITE_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_SECRET_KEY,
  }
});

export const getDetailedCostData = async () => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get detailed cost data for the current month
    const [storageData, requestData, transferData] = await Promise.all([
      getCostsByMetric('StorageBytes'),
      getCostsByMetric('Requests'),
      getCostsByMetric('DataTransfer')
    ]);

    // Process and combine the data
    const storageDetails = processStorageData(storageData);
    const requestDetails = processRequestData(requestData);
    const transferDetails = processTransferData(transferData);

    return {
      usageTypes: {
        ...storageDetails.usageTypes,
        ...requestDetails.usageTypes,
        ...transferDetails.usageTypes
      },
      storageClassDetails: storageDetails.storageClasses,
      dataTransferCosts: transferDetails.transferCosts,
      dailyCosts: [...storageDetails.dailyCosts],
      monthlyTrends: calculateMonthlyTrends([...storageDetails.dailyCosts]),
      costAnomalies: detectCostAnomalies([...storageDetails.dailyCosts])
    };
  } catch (error) {
    console.error('Error fetching cost data:', error);
    throw error;
  }
};

const getCostsByMetric = async (metric) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const params = {
    TimePeriod: {
      Start: startOfMonth.toISOString().split('T')[0],
      End: now.toISOString().split('T')[0]
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost', 'UsageQuantity'],
    GroupBy: [
      { Type: 'DIMENSION', Key: 'USAGE_TYPE' }
    ],
    Filter: {
      And: [
        {
          Dimensions: {
            Key: 'SERVICE',
            Values: ['Amazon Simple Storage Service']
          }
        },
        {
          Dimensions: {
            Key: 'OPERATION',
            Values: metric === 'StorageBytes' 
              ? ['StandardStorage', 'GlacierStorage', 'IntelligentTieringStorage', 'StandardIAStorage', 'OneZoneIAStorage', 'DeepArchiveStorage']
              : metric === 'Requests'
                ? ['GetObject', 'PutObject', 'ListBucket', 'HeadObject']
                : ['DataTransfer-In-Bytes', 'DataTransfer-Out-Bytes', 'DataTransfer-Regional-Bytes']
          }
        }
      ]
    }
  };

  const command = new GetCostAndUsageCommand(params);
  return await costExplorerClient.send(command);
};

const processStorageData = (response) => {
  const storageClasses = {
    standard: { size: 0, cost: 0 },
    intelligentTiering: { size: 0, cost: 0 },
    standardIA: { size: 0, cost: 0 },
    oneZoneIA: { size: 0, cost: 0 },
    glacier: { size: 0, cost: 0 },
    glacierDeepArchive: { size: 0, cost: 0 }
  };

  const usageTypes = {};
  const dailyCosts = [];

  response.ResultsByTime.forEach(result => {
    const date = result.TimePeriod.Start;
    let dailyTotal = 0;

    result.Groups.forEach(group => {
      const [usageType] = group.Keys;
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      const usage = parseFloat(group.Metrics.UsageQuantity.Amount);
      dailyTotal += cost;

      // Map usage type to storage class
      const storageClass = mapUsageTypeToStorageClass(usageType);
      if (storageClass && storageClasses[storageClass]) {
        storageClasses[storageClass].size += usage;
        storageClasses[storageClass].cost += cost;
      }

      usageTypes[usageType] = {
        cost: (usageTypes[usageType]?.cost || 0) + cost,
        usage: (usageTypes[usageType]?.usage || 0) + usage
      };
    });

    dailyCosts.push({ date, cost: dailyTotal });
  });

  return { storageClasses, usageTypes, dailyCosts };
};

const processRequestData = (response) => {
  const usageTypes = {};
  let totalRequests = { tier1: 0, tier2: 0 };

  response.ResultsByTime.forEach(result => {
    result.Groups.forEach(group => {
      const [usageType] = group.Keys;
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      const usage = parseFloat(group.Metrics.UsageQuantity.Amount);

      if (usageType.includes('Tier1')) {
        totalRequests.tier1 += usage;
      } else if (usageType.includes('Tier2')) {
        totalRequests.tier2 += usage;
      }

      usageTypes[usageType] = {
        cost: (usageTypes[usageType]?.cost || 0) + cost,
        usage: (usageTypes[usageType]?.usage || 0) + usage
      };
    });
  });

  return { usageTypes, totalRequests };
};

const processTransferData = (response) => {
  const transferCosts = {
    inbound: { size: 0, cost: 0 },
    outbound: { size: 0, cost: 0 },
    crossRegion: { size: 0, cost: 0 },
    accelerated: { size: 0, cost: 0 }
  };

  const usageTypes = {};

  response.ResultsByTime.forEach(result => {
    result.Groups.forEach(group => {
      const [usageType] = group.Keys;
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      const usage = parseFloat(group.Metrics.UsageQuantity.Amount);

      usageTypes[usageType] = {
        cost: (usageTypes[usageType]?.cost || 0) + cost,
        usage: (usageTypes[usageType]?.usage || 0) + usage
      };

      categorizeTransferCost(usageType, cost, usage, transferCosts);
    });
  });

  return { transferCosts, usageTypes };
};

const mapUsageTypeToStorageClass = (usageType) => {
  if (usageType.includes('StandardStorage')) return 'standard';
  if (usageType.includes('IntelligentTiering')) return 'intelligentTiering';
  if (usageType.includes('StandardIAStorage')) return 'standardIA';
  if (usageType.includes('OneZoneIAStorage')) return 'oneZoneIA';
  if (usageType.includes('GlacierStorage')) return 'glacier';
  if (usageType.includes('DeepArchiveStorage')) return 'glacierDeepArchive';
  return null;
};

const categorizeTransferCost = (usageType, cost, usage, transferCosts) => {
  if (usageType.includes('In-Bytes')) {
    transferCosts.inbound.size += usage;
    transferCosts.inbound.cost += cost;
  } else if (usageType.includes('Out-Bytes')) {
    transferCosts.outbound.size += usage;
    transferCosts.outbound.cost += cost;
  } else if (usageType.includes('Region')) {
    transferCosts.crossRegion.size += usage;
    transferCosts.crossRegion.cost += cost;
  } else if (usageType.includes('Accelerated')) {
    transferCosts.accelerated.size += usage;
    transferCosts.accelerated.cost += cost;
  }
};

const calculateMonthlyTrends = (dailyCosts) => {
  if (!dailyCosts.length) return [];
  
  const monthlyData = dailyCosts.reduce((acc, { date, cost }) => {
    const monthKey = date.substring(0, 7);
    if (!acc[monthKey]) {
      acc[monthKey] = { total: 0, days: 0 };
    }
    acc[monthKey].total += cost;
    acc[monthKey].days++;
    return acc;
  }, {});

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    total: Number(data.total.toFixed(4)),
    average: Number((data.total / data.days).toFixed(4))
  }));
};

const detectCostAnomalies = (dailyCosts) => {
  if (dailyCosts.length < 7) return [];

  const movingAverage = 7;
  const anomalies = [];

  for (let i = movingAverage - 1; i < dailyCosts.length; i++) {
    const window = dailyCosts.slice(i - movingAverage + 1, i + 1);
    const costs = window.map(d => d.cost);
    
    const average = costs.reduce((a, b) => a + b) / movingAverage;
    const stdDev = Math.sqrt(
      costs.reduce((sq, n) => sq + Math.pow(n - average, 2), 0) / movingAverage
    );

    const currentCost = dailyCosts[i].cost;
    if (Math.abs(currentCost - average) > stdDev * 2) {
      anomalies.push({
        date: dailyCosts[i].date,
        cost: Number(currentCost.toFixed(4)),
        average: Number(average.toFixed(4)),
        deviation: Number(((currentCost - average) / average * 100).toFixed(2))
      });
    }
  }

  return anomalies;
};
