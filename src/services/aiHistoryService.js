import { 
  GetObjectCommand, 
  PutObjectCommand 
} from "@aws-sdk/client-s3";
import { s3Client } from './s3Service';

export const getAIHistory = async () => {
  try {
    const command = new GetObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'ai-history-log.json'
    });

    try {
      const response = await s3Client.send(command);
      const bodyContents = await response.Body.transformToString();
      return JSON.parse(bodyContents);
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        await initializeAIHistory();
        return { lastAnalysis: null, history: [] };
      }
      throw error;
    }
  } catch (error) {
    console.error('Error fetching AI history:', error);
    return { lastAnalysis: null, history: [] };
  }
};

const initializeAIHistory = async () => {
  try {
    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'ai-history-log.json',
      Body: JSON.stringify({ lastAnalysis: null, history: [] }),
      ContentType: 'application/json'
    });
    await s3Client.send(command);
  } catch (error) {
    console.error('Error initializing AI history:', error);
    throw error;
  }
};

export const updateAIHistory = async (analysisReport) => {
  try {
    const currentHistory = await getAIHistory();
    const newEntry = {
      timestamp: new Date().toISOString(),
      report: analysisReport
    };

    const updatedHistory = {
      lastAnalysis: newEntry,
      history: [newEntry, ...currentHistory.history].slice(0, 10) // Keep last 10 analyses
    };

    const command = new PutObjectCommand({
      Bucket: import.meta.env.VITE_BUCKET_NAME,
      Key: 'ai-history-log.json',
      Body: JSON.stringify(updatedHistory),
      ContentType: 'application/json'
    });

    await s3Client.send(command);
    return newEntry;
  } catch (error) {
    console.error('Error updating AI history:', error);
    throw error;
  }
};
