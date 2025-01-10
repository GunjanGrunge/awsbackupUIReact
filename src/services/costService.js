import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getAllObjects } from './s3Service';
import { getDetailedCostData } from './costExplorerService';

export const getCostData = async () => {
  try {
    const [allObjects, awsCosts] = await Promise.all([
      getAllObjects(), // Use the new function to get all objects
      getDetailedCostData()
    ]);

    // Get current billing cycle dates
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();
    const currentDay = now.getDate();

    // Calculate total size including all objects in subfolders
    const totalSize = allObjects.reduce((acc, item) => acc + (item.Size || 0), 0);
    const sizeInGB = totalSize / (1024 * 1024 * 1024);

    // Extract AWS billing data
    const tier1Requests = awsCosts.usageTypes['APS3-Requests-Tier1'] || { cost: 0, usage: 0 };
    const tier2Requests = awsCosts.usageTypes['APS3-Requests-Tier2'] || { cost: 0, usage: 0 };
    const storageUsage = awsCosts.usageTypes['APS3-TimedStorage-ByteHrs'] || { cost: 0, usage: 0 };
    const dataTransfer = awsCosts.usageTypes['APS3-DataTransfer-Out-Bytes'] || { cost: 0, usage: 0 };

    const currentBillingCosts = {
      storage: Number(storageUsage.cost.toFixed(2)),
      transfer: Number(dataTransfer.cost.toFixed(2)),
      requests: {
        tier1: Number(tier1Requests.cost.toFixed(2)),
        tier2: Number(tier2Requests.cost.toFixed(2)),
        total: Number((tier1Requests.cost + tier2Requests.cost).toFixed(2))
      },
      total: Number((
        storageUsage.cost +
        dataTransfer.cost +
        tier1Requests.cost +
        tier2Requests.cost
      ).toFixed(2))
    };

    // Project costs based on current usage
    const dailyAverage = awsCosts.dailyCosts.reduce((acc, day) => acc + day.cost, 0) / 
                        awsCosts.dailyCosts.length;

    const projectedCosts = {
      total: Number((dailyAverage * daysInMonth).toFixed(2)),
      storage: currentBillingCosts.storage * (daysInMonth / currentDay),
      transfer: currentBillingCosts.transfer * (daysInMonth / currentDay),
      requests: currentBillingCosts.requests.total * (daysInMonth / currentDay)
    };

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
      projectedCosts,
      dailyAverage: {
        total: dailyAverage,
        storage: currentBillingCosts.storage / currentDay,
        transfer: currentBillingCosts.transfer / currentDay,
        requests: currentBillingCosts.requests.total / currentDay
      },
      requestMetrics: {
        tier1Requests: tier1Requests.usage || 0,
        tier2Requests: tier2Requests.usage || 0,
        totalRequests: (tier1Requests.usage || 0) + (tier2Requests.usage || 0)
      },
      dataTransfer: {
        bytesOut: dataTransfer.usage || 0,
        cost: dataTransfer.cost || 0
      },
      costHistory: awsCosts.dailyCosts,
      awsCostExplorer: awsCosts,
      serviceCosts: awsCosts.serviceCosts
    };
  } catch (error) {
    return {
      totalSize: 0,
      sizeInGB: 0,
      currentBillingCosts: {
        storage: 0,
        transfer: 0,
        requests: { tier1: 0, tier2: 0, total: 0 },
        total: 0
      },
      projectedCosts: {
        storage: 0,
        transfer: 0,
        requests: 0,
        total: 0
      },
      dailyAverage: {
        storage: 0,
        transfer: 0,
        requests: 0
      },
      requestMetrics: {
        tier1Requests: 0,
        tier2Requests: 0,
        totalRequests: 0
      },
      costHistory: [],
      serviceCosts: {}
    };
  }
};
