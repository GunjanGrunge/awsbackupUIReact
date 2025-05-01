import { getAllObjects } from './s3Service';
import { getDetailedCostData } from './costExplorerService';

export const getCostData = async () => {
  try {
    const [allObjects, awsCosts] = await Promise.all([
      getAllObjects(),
      getDetailedCostData()
    ]);

    // Get current billing cycle dates
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const currentDay = now.getDate();

    // Calculate total size and storage class distributions
    const totalSize = allObjects.reduce((acc, item) => acc + (item.Size || 0), 0);
    const sizeInGB = totalSize / (1024 * 1024 * 1024);

    // Process storage costs by storage class
    const storageClassCosts = awsCosts.storageClassDetails;
    const totalStorageCost = Object.values(storageClassCosts).reduce(
      (sum, cls) => sum + cls.cost, 
      0
    );

    // Calculate data transfer costs
    const transferCosts = awsCosts.dataTransferCosts;
    const totalTransferCost = Object.values(transferCosts).reduce(
      (sum, type) => sum + type.cost,
      0
    );

    // Calculate request costs
    const requestCosts = {
      tier1: awsCosts.usageTypes['APS3-Requests-Tier1']?.cost || 0,
      tier2: awsCosts.usageTypes['APS3-Requests-Tier2']?.cost || 0
    };
    const totalRequestCost = requestCosts.tier1 + requestCosts.tier2;

    const currentBillingCosts = {
      storage: Number(totalStorageCost.toFixed(4)),
      transfer: Number(totalTransferCost.toFixed(4)),
      requests: {
        tier1: Number(requestCosts.tier1.toFixed(4)),
        tier2: Number(requestCosts.tier2.toFixed(4)),
        total: Number(totalRequestCost.toFixed(4))
      },
      storageClasses: {
        standard: Number(storageClassCosts.standard.cost.toFixed(4)),
        intelligentTiering: Number(storageClassCosts.intelligentTiering.cost.toFixed(4)),
        standardIA: Number(storageClassCosts.standardIA.cost.toFixed(4)),
        oneZoneIA: Number(storageClassCosts.oneZoneIA.cost.toFixed(4)),
        glacier: Number(storageClassCosts.glacier.cost.toFixed(4)),
        glacierDeepArchive: Number(storageClassCosts.glacierDeepArchive.cost.toFixed(4))
      },
      total: Number((totalStorageCost + totalTransferCost + totalRequestCost).toFixed(4))
    };

    // Calculate projected costs based on current usage and trends
    const projectedCosts = calculateProjectedCosts(
      currentBillingCosts,
      awsCosts.monthlyTrends,
      daysInMonth,
      currentDay
    );

    return {
      totalSize,
      sizeInGB: Number(sizeInGB.toFixed(2)),
      billingCycle: {
        start: firstDayOfMonth.toISOString(),
        end: lastDayOfMonth.toISOString(),
        daysElapsed: currentDay,
        daysRemaining: daysInMonth - currentDay
      },
      currentBillingCosts,
      storageDistribution: {
        standard: formatStorageClass(storageClassCosts.standard),
        intelligentTiering: formatStorageClass(storageClassCosts.intelligentTiering),
        standardIA: formatStorageClass(storageClassCosts.standardIA),
        oneZoneIA: formatStorageClass(storageClassCosts.oneZoneIA),
        glacier: formatStorageClass(storageClassCosts.glacier),
        glacierDeepArchive: formatStorageClass(storageClassCosts.glacierDeepArchive)
      },
      transferDetails: {
        inbound: formatTransferCosts(transferCosts.inbound),
        outbound: formatTransferCosts(transferCosts.outbound),
        crossRegion: formatTransferCosts(transferCosts.crossRegion),
        accelerated: formatTransferCosts(transferCosts.accelerated)
      },
      requestMetrics: {
        tier1Requests: awsCosts.usageTypes['APS3-Requests-Tier1']?.usage || 0,
        tier2Requests: awsCosts.usageTypes['APS3-Requests-Tier2']?.usage || 0
      },
      projectedCosts,
      costTrends: awsCosts.monthlyTrends,
      costAnomalies: awsCosts.costAnomalies
    };
  } catch (error) {
    console.error('Error getting cost data:', error);
    return getDefaultCostData();
  }
};

// Storage pricing constants (USD per GB per month)
const STORAGE_PRICES = {
  standard: 0.023,  // Standard storage
  glacier: 0.004,   // Glacier storage
  glacierDeepArchive: 0.00099  // Glacier Deep Archive
};

// Calculate storage costs for different storage classes
const calculateStorageCosts = (sizeInGB, storageClass) => {
  const price = STORAGE_PRICES[storageClass.toLowerCase()] || STORAGE_PRICES.standard;
  return Number((sizeInGB * price).toFixed(4));
};

const formatStorageClass = (classData) => {
  const sizeInGB = Number((classData.size / (1024 * 1024 * 1024)).toFixed(2)); // Convert to GB
  return {
    size: sizeInGB,
    cost: calculateStorageCosts(sizeInGB, classData.storageClass || 'standard')
  };
};

const formatTransferCosts = (transferData) => ({
  size: Number((transferData.size / (1024 * 1024 * 1024)).toFixed(2)), // Convert to GB
  cost: Number(transferData.cost.toFixed(4))
});

const calculateProjectedCosts = (currentCosts, trends, daysInMonth, currentDay) => {
  // Use historical trends to project future costs
  const lastMonthTrend = trends[trends.length - 1]?.average || 0;
  const projectionFactor = daysInMonth / currentDay;

  return {
    storage: Number((currentCosts.storage * projectionFactor).toFixed(4)),
    transfer: Number((currentCosts.transfer * projectionFactor).toFixed(4)),
    requests: Number((currentCosts.requests.total * projectionFactor).toFixed(4)),
    total: Number(((currentCosts.storage + currentCosts.transfer + currentCosts.requests.total) * 
           projectionFactor).toFixed(4)),
    trend: Number(lastMonthTrend.toFixed(4))
  };
};

const getDefaultCostData = () => ({
  totalSize: 0,
  sizeInGB: 0,
  billingCycle: {
    start: new Date().toISOString(),
    end: new Date().toISOString(),
    daysElapsed: 0,
    daysRemaining: 30
  },
  currentBillingCosts: {
    storage: 0,
    transfer: 0,
    requests: { tier1: 0, tier2: 0, total: 0 },
    storageClasses: {
      standard: 0,
      intelligentTiering: 0,
      standardIA: 0,
      oneZoneIA: 0,
      glacier: 0,
      glacierDeepArchive: 0
    },
    total: 0
  },
  storageDistribution: {
    standard: { size: 0, cost: 0 },
    intelligentTiering: { size: 0, cost: 0 },
    standardIA: { size: 0, cost: 0 },
    oneZoneIA: { size: 0, cost: 0 },
    glacier: { size: 0, cost: 0 },
    glacierDeepArchive: { size: 0, cost: 0 }
  },
  transferDetails: {
    inbound: { size: 0, cost: 0 },
    outbound: { size: 0, cost: 0 },
    crossRegion: { size: 0, cost: 0 },
    accelerated: { size: 0, cost: 0 }
  },
  requestMetrics: {
    tier1Requests: 0,
    tier2Requests: 0
  },
  projectedCosts: {
    storage: 0,
    transfer: 0,
    requests: 0,
    total: 0,
    trend: 0
  },
  costTrends: [],
  costAnomalies: []
});
