import { GoogleGenAI, Type } from "@google/genai";
import { Persona, VoteResult, ModelKey, MODELS } from '../types';
import { getStaticPersonas } from './staticData';

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to generate a smaller batch of personas
const generatePersonaBatch = async (count: number, batchIndex: number): Promise<Persona[]> => {
  const ai = getAiClient();
  
  const prompt = `
    Create ${count} UNIQUE synthetic user personas for a marketing validation study (Batch #${batchIndex}).
    
    REQUIREMENTS:
    - Mix of Copywriters (Direct Response, Brand, SEO, Technical) and Marketers (Growth, Product, Retention, Brand Manager).
    - DIVERSE Demographics: Varying ages (Gen Z to Boomer), cultural backgrounds, genders, and locations.
    - DIVERSE Psychographics: Varying professional biases (e.g., "Hates jargon", "Loves data", "Focuses on empathy", "Grammar stickler").
    
    Return a JSON array where each object has:
    - id (string)
    - name (string)
    - role (one of: 'Copywriter', 'Marketer', 'Creative Director', 'Growth Hacker')
    - specialty (string)
    - yearsExperience (number, 1-30)
    - bias (string, short description)
    - avatarId (number, 1-100)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              specialty: { type: Type.STRING },
              yearsExperience: { type: Type.INTEGER },
              bias: { type: Type.STRING },
              avatarId: { type: Type.INTEGER }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as Persona[];
  } catch (error) {
    console.error(`Error generating batch ${batchIndex}:`, error);
    return [];
  }
};

export const generatePersonas = async (useLiveAi: boolean = false): Promise<Persona[]> => {
  // FAST PATH: Return pre-generated static personas instantly.
  if (!useLiveAi) {
    return getStaticPersonas();
  }

  // SLOW PATH: Generate fresh personas via Gemini API
  const batchSize = 25;
  const batches = [1, 2, 3, 4];
  
  try {
    const results = await Promise.all(batches.map(i => generatePersonaBatch(batchSize, i)));
    
    // Flatten and ensure IDs are unique
    const allPersonas = results.flat().map((p, idx) => ({
      ...p,
      id: `persona-${idx}-${Date.now()}` // Ensure unique key
    }));
    
    return allPersonas;
  } catch (error) {
    console.error("Error in parallel generation:", error);
    return [];
  }
};

export const evaluateCopyRow = async (
  promptText: string,
  modelOutputs: Record<ModelKey, string>,
  personas: Persona[]
): Promise<VoteResult> => {
  const ai = getAiClient();

  // Optimization: Send only psychographic data, strip IDs/Names to reduce input token count and latency.
  // The model needs biases, roles, and specialties to make decisions, not names.
  const personaContext = JSON.stringify(personas.map(p => ({
    role: p.role,
    bias: p.bias,
    specialty: p.specialty
  })));

  const analysisPrompt = `
    You are simulating a voting session with 100 marketing experts (Personas).
    
    THE TASK:
    Evaluate 5 ad/email copy variations based on the User Prompt.
    
    USER PROMPT:
    "${promptText}"
    
    CANDIDATES (Model Outputs):
    ${JSON.stringify(modelOutputs, null, 2)}
    
    THE JURY (100 Personas):
    ${personaContext}
    
    INSTRUCTIONS:
    1. Analyze the 100 personas collectively to determine the vote distribution. Consider how each persona's role and bias would influence their vote.
    2. Tally the votes accurately.
    3. Group the voters into 3-4 meaningful segments based on voting patterns (e.g., "Direct Response Copywriters", "Gen Z Marketers").
    4. For each segment, explain which model they preferred and why.
    5. Provide an overall summary.
    
    Return a JSON object with:
    - winner: The name of the winning model key.
    - counts: An object mapping each model key to the vote count (must sum to 100).
    - reasoning: A concise summary explaining the overall win.
    - segments: An array of segment analysis objects ({name, winner, reason}).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: analysisPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                winner: { type: Type.STRING },
                counts: {
                    type: Type.OBJECT,
                    properties: {
                        'Writer (Agent Mode)': { type: Type.INTEGER },
                        'Writer (Chat mode)': { type: Type.INTEGER },
                        'GPT 5.2': { type: Type.INTEGER },
                        'GS PeM': { type: Type.INTEGER },
                        'Gemini': { type: Type.INTEGER },
                    }
                },
                reasoning: { type: Type.STRING },
                segments: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: "Name of the voter segment" },
                            winner: { type: Type.STRING, description: "The model this segment preferred" },
                            reason: { type: Type.STRING, description: "Why this segment voted this way" }
                        }
                    }
                }
            }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini for evaluation");
    const result = JSON.parse(text) as VoteResult;
    return result;

  } catch (error) {
    console.error("Error evaluating row:", error);
    return {
      winner: "Error",
      counts: {
        'Writer (Agent Mode)': 0,
        'Writer (Chat mode)': 0,
        'GPT 5.2': 0,
        'GS PeM': 0,
        'Gemini': 0
      },
      reasoning: "Failed to process this row due to an error.",
      segments: []
    };
  }
};