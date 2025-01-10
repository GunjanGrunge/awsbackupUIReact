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
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const params = {
      TimePeriod: {
        Start: firstDayOfMonth.toISOString().split('T')[0],
        End: now.toISOString().split('T')[0]
      },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost', 'UsageQuantity'],
      GroupBy: [
        { Type: 'DIMENSION', Key: 'SERVICE' },
        { Type: 'DIMENSION', Key: 'USAGE_TYPE' }
      ]
    };

    const command = new GetCostAndUsageCommand(params);
    const response = await costExplorerClient.send(command);

    const costDetails = {
      dailyCosts: [],
      serviceCosts: {},
      usageTypes: {},
      totalCost: 0
    };

    if (response.ResultsByTime) {
      response.ResultsByTime.forEach(result => {
        try {
          const date = result.TimePeriod.Start;
          const dailyTotal = parseFloat(result.Total?.UnblendedCost?.Amount || 0);
          
          costDetails.dailyCosts.push({
            date,
            cost: dailyTotal
          });

          costDetails.totalCost += dailyTotal;

          // Process groups if they exist
          if (result.Groups) {
            result.Groups.forEach(group => {
              if (!group.Keys || !group.Metrics) return;

              const [service = 'Unknown', usageType = 'Unknown'] = group.Keys;
              const cost = parseFloat(group.Metrics.UnblendedCost?.Amount || 0);
              const usage = parseFloat(group.Metrics.UsageQuantity?.Amount || 0);

              // Aggregate by service
              costDetails.serviceCosts[service] = (costDetails.serviceCosts[service] || 0) + cost;

              // Aggregate by usage type
              if (!costDetails.usageTypes[usageType]) {
                costDetails.usageTypes[usageType] = { cost: 0, usage: 0 };
              }
              costDetails.usageTypes[usageType].cost += cost;
              costDetails.usageTypes[usageType].usage += usage;
            });
          }
        } catch (err) {
          console.warn('Error processing cost data entry:', err);
        }
      });
    }

    // Ensure we have some default values if no data is found
    if (costDetails.dailyCosts.length === 0) {
      costDetails.dailyCosts.push({
        date: now.toISOString().split('T')[0],
        cost: 0
      });
    }

    return costDetails;
  } catch (error) {
    throw new Error('Failed to fetch cost data');
  }
};
