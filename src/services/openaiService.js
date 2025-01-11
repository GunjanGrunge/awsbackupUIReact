import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const analyzeUserData = async (consolidatedData, onChunk) => {
  try {
    const simplifiedData = {
      storage: {
        totalSize: consolidatedData.storageMetrics.totalSize,
        totalObjects: consolidatedData.storageMetrics.totalObjects,
        averageFileSize: consolidatedData.storageMetrics.averageFileSize,
        storageClasses: consolidatedData.storageMetrics.storageClasses,
        utilization: {
          daily: consolidatedData.storageMetrics.utilizationTrends.daily,
          byService: consolidatedData.storageMetrics.utilizationTrends.byService,
          byUsageType: consolidatedData.storageMetrics.utilizationTrends.byUsageType
        }
      },
      costs: {
        current: {
          ...consolidatedData.costAnalytics.current,
          breakdown: consolidatedData.costAnalytics.historical.serviceBreakdown
        },
        projected: consolidatedData.costAnalytics.projected,
        historical: {
          daily: consolidatedData.costAnalytics.historical.daily,
          monthly: consolidatedData.costAnalytics.historical.monthly,
          serviceBreakdown: consolidatedData.costAnalytics.historical.serviceBreakdown
        },
        metrics: {
          costPerGB: consolidatedData.costAnalytics.metrics.costPerGB,
          costPerRequest: consolidatedData.costAnalytics.metrics.costPerRequest,
          transferCosts: consolidatedData.costAnalytics.metrics.transferCosts
        },
        trends: consolidatedData.costAnalytics.trends,
        spikes: consolidatedData.costAnalytics.trends.spikes
      },
      usage: {
        patterns: {
          hourly: consolidatedData.usagePatterns.hourlyDistribution,
          weekly: consolidatedData.usagePatterns.weeklyPatterns,
          operations: consolidatedData.usagePatterns.operationTypes,
          peakPeriods: consolidatedData.usagePatterns.peakPeriods
        }
      },
      folders: {
        total: consolidatedData.folderAnalytics.totalFolders,
        files: consolidatedData.folderAnalytics.totalFiles,
        deepestNesting: consolidatedData.folderAnalytics.deepestNesting,
        sizeDistribution: consolidatedData.folderAnalytics.sizeDistribution,
        unusedFolders: consolidatedData.folderAnalytics.unusedFolders
      }
    };

    const systemPrompt = `
    You are an AWS S3 Storage and Cost Analyst. Generate a detailed report using the provided data. Include:

    1. Cost Analysis Summary
    - Month-to-date costs vs projected costs (include % difference)
    - Cost trends and anomalies from historical data
    - Detailed daily cost breakdown with identified spikes
    - Service-wise cost distribution

    2. Storage Analysis
    - Current storage utilization by storage class
    - Storage growth trends
    - File and folder distribution analysis
    - Unused/inefficient storage identification

    3. Usage Patterns
    - Request patterns (GET, PUT, LIST) analysis
    - Peak usage periods identification
    - Data transfer patterns and costs
    - Operation type distribution

    4. Optimization Recommendations
    - Storage class optimization opportunities
    - Cost reduction strategies
    - Performance improvement suggestions
    - Resource utilization recommendations

    Use specific numbers, percentages, and trends. Highlight any anomalies or areas needing attention.
    Format the response in Markdown with clear sections and bullet points.
    `;

    const userPrompt = `Analyze this S3 data: ${JSON.stringify(simplifiedData, null, 1)}`;

    const stream = await openai.chat.completions.create({
      model: "chatgpt-4o-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 3000,
      stream: true
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
      onChunk(content);
    }

    return fullResponse;
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
