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
        avgFileSize: consolidatedData.storageMetrics.averageFileSize,
        utilizationTrends: consolidatedData.storageMetrics.utilizationTrends
      },
      costs: {
        current: consolidatedData.costAnalytics.current,
        projected: consolidatedData.costAnalytics.projected,
        historical: consolidatedData.costAnalytics.historical,
        metrics: consolidatedData.costAnalytics.metrics,
        trends: consolidatedData.costAnalytics.trends
      },
      folders: {
        total: consolidatedData.folderAnalytics.totalFolders,
        files: consolidatedData.folderAnalytics.totalFiles,
        deepestNesting: consolidatedData.folderAnalytics.deepestNesting,
        sizeDistribution: consolidatedData.folderAnalytics.sizeDistribution,
        unusedFolders: consolidatedData.folderAnalytics.unusedFolders
      },
      usage: consolidatedData.usagePatterns,
      recommendations: consolidatedData.recommendations
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

    const stream = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
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
