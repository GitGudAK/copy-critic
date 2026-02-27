
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Persona, AnalysisResult, Vote, MetaAnalysisResult, ReportItem } from '../types';
import { getStaticPersonas } from './staticData';

let manualApiKey: string | null = null;

export const setManualApiKey = (key: string | null) => {
  manualApiKey = key;
};

const getAiClient = () => {
  const apiKey = manualApiKey || process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY not set. Please provide an API key in the settings.");
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
            
            CONTEXT:
            The Model Outputs contain marketing copy. This may include Headlines, Body Copy, CTAs, etc.
            **NOTE**: Some models may include technical metadata (e.g., "Character Count: 45", "Word Count: 10") or labels.
            
            INSTRUCTIONS:
            1. **Holistic Quality is King**: Evaluate the impact, wit, and persuasiveness of the content provided.
               - **DO NOT PENALIZE MISSING STRUCTURE**: If a model output is missing a CTA, Headline, or specific element, IGNORE that omission. Judge what IS there.
               - **IGNORE METADATA**: Treat "Character Counts", "Word Counts", or structural labels (e.g. "Headline:") as invisible informational metadata. They are NOT part of the creative copy. Do not penalize or reward their presence.
               - **Focus on Strength**: Judge the model based solely on the quality of the creative text. A single brilliant headline can beat a mediocre full ad unit.
               - **Synergy**: If multiple elements are present, judge how they work together. If only one is present, judge it on its own merit.
            2. **Persona Bias**: Analyze based on your specific persona bias.
            3. **Decision**: Decide which model constructed the best overall ad unit for EACH persona (#0 to #${batchPersonas.length - 1}).
            4. **Rationale**:
               - **choice_reason**: Crisp reason why this unit won (max 15 words).
               - **rejection_reason**: Crisp reason why the LOSERS failed (max 15 words). 
                 - **NAMING CONVENTION**: ALWAYS refer to losing models as "Model A", "Model B", etc. (e.g. "Model A was too generic", "Model A and Model B lacked wit"). DO NOT use "A" or "B" on their own. This allows for post-processing.
                 - Focus on tone, style, or lack of impact. Do NOT cite "missing elements", "incomplete", or "character counts".

            OUTPUT FORMAT:
            Return ONLY a JSON object.
            keys: "summary" (string), "votes" (array).
            votes item: { 
                "i": number (0-${batchPersonas.length - 1}), 
                "c": "${availableOptions}", 
                "choice_reason": "string",
                "rejection_reason": "string"
            }
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
                              choice_reason: { type: Type.STRING },
                              rejection_reason: { type: Type.STRING }
                            },
                            required: ["i", "c", "choice_reason", "rejection_reason"]
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
            
            // Map votes back using the dynamic ID_MAP AND post-process alias names
            const mappedVotes = (json.votes || []).map((v: any) => {
                let cRat = v.choice_reason || "Good fit";
                let rRat = v.rejection_reason || "Others were worse";
                
                // Replace "Model A", "Option B" aliases with Real Names in the rationales
                modelNames.forEach((realName, idx) => {
                    const alias = LETTERS[idx] || `M${idx}`;
                    // Regex matches "Model A" or "Option A"
                    const specificRegex = new RegExp(`\\b(Model|Option|Candidate)\\s?${alias}\\b`, 'gi');
                    cRat = cRat.replace(specificRegex, realName);
                    rRat = rRat.replace(specificRegex, realName);
                });

                return {
                    personaIndex: (v.i !== undefined ? v.i : -1) + globalStartIndex,
                    choice: v.c || REVERSE_MAP[modelNames[0]], 
                    choiceRationale: cRat,
                    rejectionRationale: rRat
                };
            });
    
            // Also post-process the summary text for the batch
            let summaryText = json.summary || "";
            modelNames.forEach((realName, idx) => {
                const alias = LETTERS[idx] || `M${idx}`;
                const specificRegex = new RegExp(`\\b(Model|Option|Candidate)\\s?${alias}\\b`, 'gi');
                summaryText = summaryText.replace(specificRegex, realName);
            });

            return {
                votes: mappedVotes,
                summary: summaryText
            };
        }, 2, 2000); 
    }, 3); 

    // --- AGGREGATION ---
    const allVotes: any[] = results.flatMap(r => r.votes);
    
    // Combine summaries? For now, we take the first batch summary as the overall "consensus" 
    // or we could concatenate them. Taking first is usually sufficient for tone, but let's concat if short.
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
          choiceRationale: v.choiceRationale,
          rejectionRationale: v.rejectionRationale
        });
      }
    });

    // Ensure counts has all model names even if they got 0 votes
    modelNames.forEach(m => {
      if (counts[m] === undefined) counts[m] = 0;
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

    // Aggregate rich data for the analyst
    const summaryData = completedItems.map((item, idx) => {
        const votes = item.analysis?.votes || [];
        
        // Structure: Group rationales by model
        const modelFeedback: Record<string, { likes: string[], voteCount: number }> = {};
        const rejectionFeedback: string[] = [];

        // Initialize counts
        Object.keys(item.analysis?.counts || {}).forEach(m => {
            modelFeedback[m] = { likes: [], voteCount: item.analysis?.counts[m] || 0 };
        });

        votes.forEach(v => {
            // Collect why they chose this model
            if (modelFeedback[v.votedFor]) {
                modelFeedback[v.votedFor].likes.push(v.choiceRationale);
            }
            // Collect general rejection feedback (applies to non-chosen models)
            if (v.rejectionRationale) {
                rejectionFeedback.push(v.rejectionRationale);
            }
        });

        // Sample to fit in context window (take 5 distinct reasons per model)
        const sampledFeedback: Record<string, any> = {};
        Object.keys(modelFeedback).forEach(m => {
            const uniqueLikes = Array.from(new Set(modelFeedback[m].likes));
            sampledFeedback[m] = {
                votes: modelFeedback[m].voteCount,
                top_reasons_for_choosing: uniqueLikes.slice(0, 5)
            };
        });

        // Sample rejection feedback
        const uniqueRejections = Array.from(new Set(rejectionFeedback));

        return {
            test_id: idx,
            test_topic: item.Test,
            prompt: item.Prompt.substring(0, 150),
            winner: item.analysis?.winner,
            model_performance: sampledFeedback,
            general_criticism_of_losers: uniqueRejections.slice(0, 8)
        };
    });

    const systemInstruction = `
        You are a Senior Marketing Analyst. 
        Your job is to review a series of A/B tests between different AI models and provide high-level strategic insights.
        
        The tested content is creative marketing copy.
        
        Analyze the provided JSON data. For each test, you have:
        - "model_performance": containing vote counts and specific reasons ("top_reasons_for_choosing") why personas liked a model.
        - "general_criticism_of_losers": reasons why personas rejected the other options.

        Task:
        1. Identify the Overall Champion (highest total win rate).
        2. Assign Specific "Awards" (e.g. Best Headline Writer, Strongest Visual Flow, Best CTA, Best for Corporate, Safest Choice) based on the patterns in the feedback.
        3. Create a Deep Dive for EACH model. Use the "top_reasons_for_choosing" to identify STRENGTHS (e.g., "Great headlines"). Use "general_criticism_of_losers" to identify WEAKNESSES (e.g., "Weak CTAs", "Body copy disconnected from visual").
        4. Define "Best Use Cases" for each model based on where it succeeded.
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
