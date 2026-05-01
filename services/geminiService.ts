import { GoogleGenAI, Type } from "@google/genai";
import { Student, AnalysisResult } from '../types';

// NOTE: In a real production app, never expose API keys on the client side.
// This is for demonstration purposes as per the system prompt requirements using process.env.
// The user of this code must set the API Key in their environment.

// Safe access to process.env for web environments that might not polyfill 'process'
const getApiKey = () => {
  try {
    // Check if process is defined before accessing env to avoid ReferenceError
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY || '';
    }
    return '';
  } catch (e) {
    return '';
  }
};

export const analyzeRecruitmentData = async (students: Student[]): Promise<AnalysisResult> => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return {
      summary: "API Key 未配置。",
      trend: "无法连接 AI 服务。",
      recommendation: "请在环境变量中配置 process.env.API_KEY"
    };
  }

  if (students.length === 0) {
    return {
      summary: "暂无数据。",
      trend: "无",
      recommendation: "等待数据录入。"
    };
  }

  // Initialize client here to avoid module-level initialization errors
  const ai = new GoogleGenAI({ apiKey });

  // Minimize data payload for tokens and privacy
  const minimizedData = students.map(s => ({
    time: s.reportTime,
    // We do not send names or full IDs to AI for privacy, just metadata if needed
  }));

  const prompt = `
    作为一名招生数据分析专家，请根据以下最近的报备数据（时间戳）生成一份简要的分析报告。
    
    数据点数量: ${minimizedData.length}
    最早记录: ${minimizedData[minimizedData.length - 1]?.time}
    最新记录: ${minimizedData[0]?.time}
    
    请分析报名频率和趋势。
    
    请以 JSON 格式返回，包含以下字段：
    - summary: 总体情况摘要 (String)
    - trend: 趋势分析 (String)
    - recommendation: 给管理层的建议 (String)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            trend: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return {
      summary: "AI 分析服务暂时不可用。",
      trend: "请稍后重试。",
      recommendation: "检查网络连接或 API 配额。"
    };
  }
};