import OpenAI from "openai";

// Single OpenAI initialization
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

export const analyzeUserData = async (userData) => {
  try {
    const systemPrompt = `
    You are an expert file system analyzer and AI assistant.
    Create a professional analysis report with the following sections:
    
    # AWS File System Analysis Report
    
    ## Overview
       - Current system status
       - Key metrics
       - Quick summary

    ## Storage Analysis
       - Usage patterns
       - Size distribution
       - Growth trends

    ## Performance Insights
       - System efficiency
       - Bottlenecks
       - Areas for improvement

    ## Security & Compliance
       - Risk assessment
       - Security status
       - Compliance checks

    ## Recommendations
       - Immediate actions
       - Long-term strategy
       - Best practices

    Format using clear markdown with:
    - Tables for metrics
    - Bullet points for key findings
    - > Blockquotes for important alerts
    - \`\`\` Code blocks for technical details
    - **Bold** for emphasis on critical points
    `;

    const userPrompt = `
    Please analyze this user's system data:
    ${JSON.stringify(userData, null, 2)}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      max_tokens: 3500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API Error:', error);
    throw error;
  }
};
