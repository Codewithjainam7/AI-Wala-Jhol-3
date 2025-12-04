
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from '../constants';
import { ScanResponse } from '../types';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeContent = async (
  content: string | { mimeType: string; data: string }, 
  mode: 'text' | 'image' | 'humanize' = 'text'
): Promise<ScanResponse> => {
  try {
    const startTime = Date.now();
    
    // Construct the user prompt based on mode
    let promptText = "";
    
    if (mode === 'humanize') {
      promptText = `Analyze and HUMANIZE the provided content. 
      - Rewrite the text to be more natural, varied, and less robotic.
      - Remove common AI phrases.
      - Return the JSON response with the 'humanizer' field fully populated.`;
    } else if (mode === 'image') {
      promptText = `ACT AS AN AI IMAGE FORENSICS EXPERT.
      
      Your task is strictly VISUAL PIXEL ANALYSIS to detect generative AI artifacts.

      Analyze for these specific AI indicators:
      1. WATERMARKS: Look for specific AI generation watermarks (e.g., color strips in bottom right, specific logo patterns). If a watermark is found, it is almost certainly AI.
      2. TEXT RENDERING: Do not read the text for meaning, but look at the SHAPE of letters. If text is gibberish, symbols are broken, letters are merged, alien-like glyphs, or "pseudolanguage", this is a strong sign of AI generation.
      3. ANATOMY: Look for malformed hands, extra fingers, asymmetric eyes, or blending teeth.
      4. PHYSICS: Check for impossible lighting, inconsistent shadows, or reflections that don't match the environment.
      5. TEXTURE: Look for "plastic" skin, overly smooth surfaces, or hair that blends into the background.
      6. COMPOSITION: Check for background geometry errors or nonsensical objects.
      
      CRITICAL INSTRUCTIONS:
      - UNDER NO CIRCUMSTANCES should the analysis involve OCR or text interpretation for meaning. Focus solely on visual, pixel-level artifacts and glyph quality.
      - If you detect strong AI signals (Risk > 70), populate a field called 'suspected_prompt' with a detailed English prompt that likely generated this image.
      
      HINDI PHRASES (Include these in the 'summary'):
      - If High Risk (AI detected): Start summary with "Pakda gaya! Ye toh AI ka Jhol hai." or "Jhol pakda gaya!"
      - If Medium Risk: Start summary with "Kuch toh gadbad hai." or "Daal mein kuch kaala hai."
      - If Low Risk (Human): Start summary with "Bilkul asli hai bhai!" or "Sab sahi lag raha hai."

      Return the standard JSON response:
      - 'detection.is_ai_generated' MUST be based on visual evidence only.
      - 'detection.signals' MUST list specific visual flaws found.
      - 'detection.risk_score' should reflect the likelihood of it being a generated image.
      - 'detection.suspected_prompt' (string): If AI detected, write the reverse-engineered prompt here.
      `;
    } else {
      // Default Text/Document analysis
      promptText = `Analyze the provided content for AI generation patterns (textual analysis). 
      Look for:
      1. Formulaic sentence structure.
      2. Repetitive phrasing.
      3. Lack of depth or personal nuance.
      4. Common AI transition words (e.g., "In conclusion", "It is important to note").
      
      HINDI PHRASES (Include in 'summary'):
      - High Risk: "Pakda gaya! Ye text AI likha hai."
      - Low Risk: "Bilkul asli hai bhai! Human written lag raha hai."
      
      Return the standard JSON response.`;
    }

    let contents;

    if (typeof content === 'string') {
      // Text Input
      contents = {
        parts: [
          { text: `${promptText}\n\nTEXT:\n${content}` }
        ]
      };
    } else {
      // File Input (Image/PDF)
      contents = {
        parts: [
          { text: promptText },
          { 
            inlineData: {
              mimeType: content.mimeType,
              data: content.data
            }
          }
        ]
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: mode === 'humanize' ? 0.7 : 0.4, // Lower temp for detection to be more analytical
      }
    });

    let responseText = response.text;
    
    if (!responseText) {
      throw new Error("Empty response from AI");
    }

    // Robust JSON Extraction
    // 1. Remove markdown code blocks
    responseText = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    
    // 2. Extract JSON object using regex if there's extra text around it
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    const result = JSON.parse(responseText) as ScanResponse;
    
    // Calculate processing time client-side
    result.metadata.processing_time_ms = Date.now() - startTime;
    
    return result;

  } catch (error) {
    console.error("Analysis Error:", error);
    return {
      scan_id: `err_${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: mode === 'image' ? 'image' : 'text',
      file_info: { name: null, type: null, size_bytes: null, pages: null },
      detection: {
        is_ai_generated: false,
        ai_probability: 0,
        human_probability: 0,
        risk_score: 0,
        risk_level: 'LOW',
        confidence: 'low',
        summary: "Error occurred during analysis. Please try again.",
        signals: [],
        model_suspected: null,
        detailed_analysis: "Unable to process request due to an error.",
        suspected_prompt: undefined
      },
      humanizer: {
        requested: mode === 'humanize',
        humanized_text: null,
        changes_made: [],
        improvement_score: 0,
        notes: null
      },
      recommendations: [],
      ui_hints: {
        show_loading_animation: false,
        suggested_color: 'red',
        suggested_view: 'card',
        alert_level: 'danger'
      },
      metadata: {
        processing_time_ms: 0,
        apis_used: [],
        version: "1.0.0"
      },
      error: true,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
};
