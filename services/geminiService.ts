
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Persona, AnalysisResult, ModelKey, MODELS, Vote } from '../types';
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
  candidates: Record<ModelKey, string>,
  personas: Persona[]
): Promise<AnalysisResult> => {
  const ai = getAiClient();

  const ID_MAP: Record<string, ModelKey> = {
    'A': 'Writer (Agent Mode)',
    'B': 'Writer (Chat mode)',
    'C': 'GPT 5.2',
    'D': 'GS PeM',
    'E': 'Gemini'
  };

  const REVERSE_MAP: Record<ModelKey, string> = {
    'Writer (Agent Mode)': 'A',
    'Writer (Chat mode)': 'B',
    'GPT 5.2': 'C',
    'GS PeM': 'D',
    'Gemini': 'E'
  };

  let candidateText = "";
  for (const [key, val] of Object.entries(candidates)) {
    const safeVal = val || "[No content generated]";
    candidateText += `MODEL ${REVERSE_MAP[key as ModelKey]}:\n${safeVal}\n\n`;
  }

  // --- BATCHING STRATEGY ---
  // Reduced to 10 for higher reliability.
  // 100 personas / 10 = 10 requests total.
  const BATCH_SIZE = 10;
  const personaBatches = [];
  for (let i = 0; i < personas.length; i += BATCH_SIZE) {
    personaBatches.push(personas.slice(i, i + BATCH_SIZE));
  }

  try {
    // Use pMap to limit concurrency to 3 parallel requests to avoid Rate Limits (429)
    // and server overloads, which are common causes of "failures".
    const results = await pMap(personaBatches, async (batchPersonas, batchIndex) => {
        const globalStartIndex = batchIndex * BATCH_SIZE;

        const personaList = batchPersonas.map((p, i) => 
            `#${i} ${p.name} (${p.role}): ${p.bias}`
        ).join('\n');

        const systemInstruction = `
            You are simulating a voting panel of marketing personas.
            Task: Read the User Prompt and 5 Model Outputs (A-E).
            
            1. Analyze texts based on persona bias.
            2. Decide which model wrote the best copy for EACH persona (#0 to #${batchPersonas.length - 1}).
            3. Provide a 'summary' of consensus.
            
            OUTPUT FORMAT:
            Return ONLY a JSON object.
            keys: "summary" (string), "votes" (array).
            votes item: { "i": number (0-${batchPersonas.length - 1}), "c": "A"|"B"|"C"|"D"|"E", "r": "max 6 words" }
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
                  model: 'gemini-3-flash-preview',
                  config: {
                    systemInstruction: systemInstruction,
                    // CRITICAL: Set BLOCK_NONE to prevent false positives on "marketing" language
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
                timeoutPromise(60000) // 60s is enough for 10 items
            ]);
    
            if (!response.text) {
                // Check if blocked
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
            
            const mappedVotes = (json.votes || []).map((v: any) => ({
                personaIndex: (v.i !== undefined ? v.i : -1) + globalStartIndex,
                choice: v.c || 'E',
                reason: v.r || '...'
            }));
    
            return {
                votes: mappedVotes,
                summary: json.summary || ""
            };
        }, 2, 2000); // Retry 2 times, start with 2s delay
    }, 3); // Max concurrency: 3 requests at a time

    // --- AGGREGATION ---
    const allVotes: any[] = results.flatMap(r => r.votes);
    const summary = results[0]?.summary || "Analysis completed.";

    const counts: Record<ModelKey, number> = {
      'Writer (Agent Mode)': 0,
      'Writer (Chat mode)': 0,
      'GPT 5.2': 0,
      'GS PeM': 0,
      'Gemini': 0
    };

    const finalVotes: Vote[] = [];

    allVotes.forEach((v: any) => {
      let choiceChar = v.choice?.toString().toUpperCase().trim().charAt(0) || '';
      const match = v.choice?.toString().toUpperCase().match(/\b([ABCDE])\b/);
      if (match) choiceChar = match[1];

      const modelKey = ID_MAP[choiceChar];
      
      if (modelKey && personas[v.personaIndex]) {
        counts[modelKey]++;
        finalVotes.push({
          personaName: personas[v.personaIndex].name,
          personaRole: personas[v.personaIndex].role,
          votedFor: modelKey,
          reason: v.reason
        });
      }
    });

    // Determine winner
    let winner: ModelKey = 'Gemini';
    let max = -1;
    for (const m of MODELS) {
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
