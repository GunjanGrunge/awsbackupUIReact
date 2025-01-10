import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const analyzeUserData = async (userData) => {
  try {
    const simplifiedData = {
      storage: {
        totalSize: userData.systemMetrics.storageUsage.totalSize,
        totalObjects: userData.systemMetrics.storageUsage.totalObjects,
        avgFileSize: userData.systemMetrics.storageUsage.averageFileSize,
      },
      costs: {
        monthly: userData.systemMetrics.costs.totalMonthlyCost,
        storage: userData.systemMetrics.costs.monthlyCosts?.storage || 0,
        transfer: userData.systemMetrics.costs.monthlyCosts?.transfer || 0,
        requests: userData.systemMetrics.costs.monthlyCosts?.requests || 0,
        billing: userData.systemMetrics.costs.billing || {},
        recommendations: userData.systemMetrics.costs.recommendations || [],
        awsActual: {
          dailyCosts: userData.systemMetrics.costs.awsCostExplorer.dailyCosts,
          byService: userData.systemMetrics.costs.awsCostExplorer.serviceCosts,
          byUsageType: userData.systemMetrics.costs.awsCostExplorer.usageTypes,
          costComparison: userData.systemMetrics.costs.costBreakdown
        },
        actual: {
          daily: userData.systemMetrics.costs.costHistory,
          byService: userData.systemMetrics.costs.serviceCosts,
          byUsageType: userData.systemMetrics.costs.awsCostExplorer.usageTypes,
        },
        trends: {
          dailyAverage: userData.systemMetrics.costs.dailyAverage,
          projected: userData.systemMetrics.costs.projectedCosts
        }
      },
      activity: {
        uploadCount: Object.values(userData.activityMetrics.uploadFrequency.monthly || {}).reduce((a, b) => a + b, 0),
        downloadCount: userData.activityMetrics.downloadPatterns.totalDownloads,
        peakHour: userData.activityMetrics.peakUsageTimes.indexOf(Math.max(...userData.activityMetrics.peakUsageTimes)),
      },
      folders: {
        unused: userData.folderAnalysis.unusedFolders.length,
        deepestNesting: userData.folderAnalysis.deepestNesting,
        largestFolders: userData.folderAnalysis.largestFolders.slice(0, 3),
      }
    };

    const systemPrompt = `
    Act as an AWS S3 Cost Analyzer. Generate a clear, data-driven bullet-point report using AWS Cost Explorer data. The report must include specific numbers, percentages, and highlight anomalies or cost spikes. Structure the report as follows:

Cost Analysis Summary
Month-to-date S3 costs vs projected costs (with % difference)
Notable usage trends and any cost anomalies
Daily cost breakdown highlighting spikes or drops
Service Usage Analysis
Current S3 storage utilization by storage class (in GB/TB and %)
Breakdown of request patterns (GET, PUT, LIST) and their costs
Data transfer insights (intra-region, cross-region, internet) with cost impact
Cost Optimization Recommendations
Suggested storage class transitions (e.g., Standard → Infrequent Access) with estimated savings
Tips to reduce request costs (batching, caching strategies)
Data transfer cost optimization strategies (e.g., using CloudFront, Transfer Acceleration)
Ensure the report is concise, focused on actionable insights, and emphasizes significant cost drivers or unusual patterns.
    `;

    const userPrompt = `Analyze this S3 data: ${JSON.stringify(simplifiedData, null, 1)}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000 // Significantly reduced token limit
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', {
      error,
      message: error.message,
      name: error.name
    });
    if (error.name === 'RateLimitError') {
      return "Analysis temporarily unavailable due to rate limits. Please try again in a few minutes.";
    }
    throw error;
  }
};
