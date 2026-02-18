
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Persona, AnalysisResult, Vote, MetaAnalysisResult, ReportItem } from '../types';
import { getStaticPersonas } from './staticData';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not set");
  return new GoogleGenAI({ apiKey });
};

// Helper for timeout
const timeoutPromise = (ms: number) => new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`Request timed out after ${ms/1000} seconds`)), ms)
);

// Helper for retry
async function fetchWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.warn(`Batch failed, retrying in ${delay}ms...`, error);
      await new Promise(res => setTimeout(res, delay));
      return fetchWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// Helper to strip markdown code blocks
function cleanJson(text: string): string {
  if (!text) return "{}";
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").replace(/```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").replace(/```$/, "");
  }
  return cleaned;
}

// Helper for concurrency control
async function pMap<T, R>(
    array: T[], 
    mapper: (item: T, index: number) => Promise<R>, 
    concurrency: number
): Promise<R[]> {
    const results = new Array<R>(array.length);
    let index = 0;
    const next = async (): Promise<void> => {
        if (index >= array.length) return;
        const i = index++;
        try {
            results[i] = await mapper(array[i], i);
        } catch (e) {
            throw e; 
        }
        await next();
    };
    const workers = [];
    for (let i = 0; i < concurrency && i < array.length; i++) {
        workers.push(next());
    }
    await Promise.all(workers);
    return results;
}

// 1. GENERATE PERSONAS
export const generatePersonas = async (useLiveAi: boolean = false): Promise<Persona[]> => {
  return getStaticPersonas();
};

// 2. RUN VOTING SESSION
export const runVotingSession = async (
  promptText: string,
  candidates: Record<string, string>,
  personas: Persona[]
): Promise<AnalysisResult> => {
  const ai = getAiClient();
  const modelNames = Object.keys(candidates);
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Dynamic Mapping
  const ID_MAP: Record<string, string> = {};
  const REVERSE_MAP: Record<string, string> = {};

  modelNames.forEach((name, index) => {
    const letter = LETTERS[index] || `M${index}`;
    ID_MAP[letter] = name;
    REVERSE_MAP[name] = letter;
  });

  let candidateText = "";
  for (const [key, val] of Object.entries(candidates)) {
    const safeVal = val || "[No content generated]";
    candidateText += `MODEL ${REVERSE_MAP[key]}: \n${safeVal}\n\n`;
  }

  // --- BATCHING STRATEGY ---
  const BATCH_SIZE = 10;
  const personaBatches = [];
  for (let i = 0; i < personas.length; i += BATCH_SIZE) {
    personaBatches.push(personas.slice(i, i + BATCH_SIZE));
  }

  try {
    const results = await pMap(personaBatches, async (batchPersonas, batchIndex) => {
        const globalStartIndex = batchIndex * BATCH_SIZE;

        const personaList = batchPersonas.map((p, i) => 
            `#${i} ${p.name} (${p.role}): ${p.bias}`
        ).join('\n');

        const availableOptions = modelNames.map(m => REVERSE_MAP[m]).join('|');

        const systemInstruction = `
            You are simulating a voting panel of marketing personas.
            Task: Read the User Prompt and the Model Outputs (${availableOptions}).
            
            1. Analyze texts based on persona bias.
            2. Decide which model wrote the best copy for EACH persona (#0 to #${batchPersonas.length - 1}).
            3. Provide a 'summary' of consensus.
            
            OUTPUT FORMAT:
            Return ONLY a JSON object.
            keys: "summary" (string), "votes" (array).
            votes item: { "i": number (0-${batchPersonas.length - 1}), "c": "${availableOptions}", "r": "max 6 words" }
        `;

        const userPrompt = `
            PROMPT: "${promptText}"

            --- CANDIDATES ---
            ${candidateText}

            --- JURY (Batch ${batchIndex + 1}) ---
            ${personaList}
        `;

        return fetchWithRetry(async () => {
            const response: any = await Promise.race([
                ai.models.generateContent({
                  model: 'gemini-3-pro-preview',
                  config: {
                    systemInstruction: systemInstruction,
                    safetySettings: [
                      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    ],
                    responseMimeType: 'application/json',
                    responseSchema: {
                      type: Type.OBJECT,
                      properties: {
                        summary: { type: Type.STRING },
                        votes: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              i: { type: Type.INTEGER },
                              c: { type: Type.STRING },
                              r: { type: Type.STRING }
                            },
                            required: ["i", "c"]
                          }
                        }
                      }
                    }
                  },
                  contents: userPrompt
                }),
                timeoutPromise(60000) 
            ]);
    
            if (!response.text) {
                if (response.promptFeedback?.blockReason) {
                    throw new Error(`Blocked: ${response.promptFeedback.blockReason}`);
                }
                throw new Error("Empty response from AI model");
            }
            
            let json;
            try {
                json = JSON.parse(cleanJson(response.text));
            } catch (e) {
                console.error("JSON Parse Error", response.text);
                throw new Error("Invalid JSON response");
            }
            
            // Map votes back using the dynamic ID_MAP
            const mappedVotes = (json.votes || []).map((v: any) => ({
                personaIndex: (v.i !== undefined ? v.i : -1) + globalStartIndex,
                choice: v.c || REVERSE_MAP[modelNames[0]], // Default to first model if invalid
                reason: v.r || '...'
            }));
    
            return {
                votes: mappedVotes,
                summary: json.summary || ""
            };
        }, 2, 2000); 
    }, 3); 

    // --- AGGREGATION ---
    const allVotes: any[] = results.flatMap(r => r.votes);
    const summary = results[0]?.summary || "Analysis completed.";

    const counts: Record<string, number> = {};
    modelNames.forEach(m => counts[m] = 0);

    const finalVotes: Vote[] = [];

    allVotes.forEach((v: any) => {
      let choiceChar = v.choice?.toString().toUpperCase().trim() || '';
      // Extract just the letter if model hallucinates extra text
      const match = choiceChar.match(/^[A-Z]/); 
      if (match) choiceChar = match[0];

      const modelKey = ID_MAP[choiceChar];
      
      if (modelKey && personas[v.personaIndex]) {
        counts[modelKey] = (counts[modelKey] || 0) + 1;
        finalVotes.push({
          personaName: personas[v.personaIndex].name,
          personaRole: personas[v.personaIndex].role,
          votedFor: modelKey,
          reason: v.reason
        });
      }
    });

    let winner: string = modelNames[0];
    let max = -1;
    for (const m of modelNames) {
      if (counts[m] > max) {
        max = counts[m];
        winner = m;
      }
    }

    return { winner, counts, votes: finalVotes, summary };

  } catch (e: any) {
    console.error("Evaluation failed", e);
    throw new Error(e.message || "Error during voting session");
  }
};

// 3. META ANALYSIS (From Session Data)
export const analyzeSessionResults = async (items: ReportItem[]): Promise<MetaAnalysisResult> => {
    const ai = getAiClient();
    const completedItems = items.filter(i => i.status === 'done' && i.analysis);

    if (completedItems.length === 0) throw new Error("No completed tests to analyze");

    // Simplify data to reduce token count
    const summaryData = completedItems.map((item, idx) => ({
        id: idx,
        test: item.Test,
        prompt: item.Prompt.substring(0, 100),
        winner: item.analysis?.winner,
        voteDistribution: item.analysis?.counts,
        panelSummary: item.analysis?.summary
    }));

    const systemInstruction = `
        You are a Senior Marketing Analyst. 
        Your job is to review a series of A/B tests between different AI models and provide high-level strategic insights.
        
        Analyze the provided JSON data of test results.
        Identify:
        1. The Overall Champion (highest win rate).
        2. Specific "Awards" (e.g. Best for Humor, Best for Professionalism, Safest Choice) based on the test topics/summaries.
        3. A deep dive into each model involved (strengths, weaknesses, best use cases).
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Using Pro for complex reasoning over dataset
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    overallChampion: { type: Type.STRING },
                    executiveSummary: { type: Type.STRING },
                    scenarios: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                winner: { type: Type.STRING },
                                description: { type: Type.STRING },
                                icon: { type: Type.STRING, enum: ['zap', 'shield', 'smile', 'briefcase', 'pen'] }
                            }
                        }
                    },
                    modelInsights: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                modelName: { type: Type.STRING },
                                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                                bestUseCases: { type: Type.ARRAY, items: { type: Type.STRING } },
                                winRate: { type: Type.NUMBER, description: "Percentage 0-100" }
                            }
                        }
                    }
                }
            }
        },
        contents: JSON.stringify(summaryData)
    });

    if (!response.text) throw new Error("No analysis generated");
    return JSON.parse(cleanJson(response.text));
};

// 4. META ANALYSIS (From PDF)
export const analyzePdfReport = async (base64Pdf: string): Promise<MetaAnalysisResult> => {
    const ai = getAiClient();

    // The PDF is generated via html2canvas, so it consists of screenshots/images of tables and charts.
    // The model needs to visually parse these images.
    const systemInstruction = `
        You are a Senior Marketing Analyst. 
        Read the provided PDF report. 
        
        IMPORTANT: This PDF contains SCREENSHOTS of data tables, bar charts, and text summaries from a validation tool.
        You must visually analyze the images in the PDF to extract the data.
        
        Extract and Analyze:
        1. The Overall Champion (which model won the most tests?).
        2. Specific "Awards" (Best for Humor, Professionalism, etc) based on the test prompts/results you see.
        3. Model Deep Dives (Strengths/Weaknesses).

        Return ONLY valid JSON with the following structure:
        {
          "overallChampion": "string",
          "executiveSummary": "string",
          "scenarios": [{ "title": "string", "winner": "string", "description": "string", "icon": "zap" | "shield" | "smile" | "briefcase" | "pen" }],
          "modelInsights": [{ "modelName": "string", "strengths": ["string"], "weaknesses": ["string"], "bestUseCases": ["string"], "winRate": number }]
        }
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            // NOTE: We do NOT use responseSchema here intentionally. 
            // When dealing with complex visual parsing from PDFs in the Preview model, 
            // strict schema validation can sometimes cause the model to fail or reject valid visual interpretations.
            // We rely on the system instruction and JSON mode to get the correct structure.
        },
        contents: {
            parts: [
                { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
                { text: "Analyze this visual report and provide the structured JSON insights." }
            ]
        }
    });

    if (!response.text) throw new Error("No analysis generated");
    
    try {
        return JSON.parse(cleanJson(response.text));
    } catch (e) {
        console.error("Failed to parse PDF analysis JSON", response.text);
        throw new Error("The AI analyzed the PDF but returned invalid JSON.");
    }
};
