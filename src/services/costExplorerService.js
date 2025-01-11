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
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Make separate API calls for different groupings
    const [serviceData, usageData, operationData] = await Promise.all([
      getCostsByDimension('SERVICE'),
      getCostsByDimension('USAGE_TYPE'),
      getCostsByDimension('OPERATION')
    ]);

    return {
      dailyCosts: serviceData.dailyCosts,
      serviceCosts: serviceData.dimensionMap,
      usageTypes: usageData.dimensionMap,
      operationCosts: operationData.dimensionMap,
      storageClassDetails: processStorageClasses(usageData.dimensionMap),
      dataTransferCosts: processDataTransferCosts(usageData.dimensionMap),
      monthlyTrends: calculateMonthlyTrends(serviceData.dailyCosts),
      costAnomalies: detectCostAnomalies(serviceData.dailyCosts)
    };
  } catch (error) {
    console.error('Error fetching cost data:', error);
    throw error;
  }
};

const getCostsByDimension = async (dimension) => {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const params = {
    TimePeriod: {
      Start: threeMonthsAgo.toISOString().split('T')[0],
      End: now.toISOString().split('T')[0]
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost', 'UsageQuantity'],
    GroupBy: [
      { Type: 'DIMENSION', Key: dimension }
    ]
  };

  const command = new GetCostAndUsageCommand(params);
  const response = await costExplorerClient.send(command);

  const dailyCosts = [];
  const dimensionMap = {};
  let totalCost = 0;

  response.ResultsByTime.forEach(result => {
    const date = result.TimePeriod.Start;
    const dailyTotal = parseFloat(result.Total?.UnblendedCost?.Amount || 0);
    
    dailyCosts.push({ date, cost: dailyTotal });
    totalCost += dailyTotal;

    result.Groups.forEach(group => {
      const key = group.Keys[0];
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      const usage = parseFloat(group.Metrics.UsageQuantity.Amount);

      if (!dimensionMap[key]) {
        dimensionMap[key] = { cost: 0, usage: 0 };
      }
      dimensionMap[key].cost += cost;
      dimensionMap[key].usage += usage;
    });
  });

  return { dailyCosts, dimensionMap, totalCost };
};

const processStorageClasses = (usageTypes) => {
  const storageClasses = {};
  
  Object.entries(usageTypes).forEach(([type, data]) => {
    if (type.includes('StorageType')) {
      const className = type.split(':')[1] || 'Standard';
      storageClasses[className] = {
        size: data.usage,
        cost: data.cost
      };
    }
  });

  return storageClasses;
};

const processDataTransferCosts = (usageTypes) => {
  const transferCosts = {
    inbound: { size: 0, cost: 0 },
    outbound: { size: 0, cost: 0 },
    crossRegion: { size: 0, cost: 0 }
  };

  Object.entries(usageTypes).forEach(([type, data]) => {
    if (type.includes('DataTransfer')) {
      if (type.includes('In')) {
        transferCosts.inbound.size += data.usage;
        transferCosts.inbound.cost += data.cost;
      } else if (type.includes('Out')) {
        transferCosts.outbound.size += data.usage;
        transferCosts.outbound.cost += data.cost;
      } else if (type.includes('Region')) {
        transferCosts.crossRegion.size += data.usage;
        transferCosts.crossRegion.cost += data.cost;
      }
    }
  });

  return transferCosts;
};

const calculateMonthlyTrends = (dailyCosts) => {
  const monthlyData = dailyCosts.reduce((acc, { date, cost }) => {
    const monthKey = date.substring(0, 7);
    if (!acc[monthKey]) {
      acc[monthKey] = { total: 0, days: 0, average: 0 };
    }
    acc[monthKey].total += cost;
    acc[monthKey].days++;
    acc[monthKey].average = acc[monthKey].total / acc[monthKey].days;
    return acc;
  }, {});

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    total: data.total,
    average: data.average
  }));
};

const detectCostAnomalies = (dailyCosts) => {
  if (dailyCosts.length < 7) return [];

  const movingAverage = 7; // 7-day moving average
  const anomalies = [];

  for (let i = movingAverage - 1; i < dailyCosts.length; i++) {
    const windowCosts = dailyCosts.slice(i - movingAverage + 1, i + 1)
      .map(d => d.cost);
    
    const average = windowCosts.reduce((a, b) => a + b) / movingAverage;
    const stdDev = Math.sqrt(
      windowCosts.reduce((sq, n) => sq + Math.pow(n - average, 2), 0) / movingAverage
    );

    const currentCost = dailyCosts[i].cost;
    if (Math.abs(currentCost - average) > stdDev * 2) {
      anomalies.push({
        date: dailyCosts[i].date,
        cost: currentCost,
        average,
        deviation: ((currentCost - average) / average) * 100
      });
    }
  }

  return anomalies;
};
