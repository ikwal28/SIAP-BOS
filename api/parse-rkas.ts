import { GoogleGenAI, Type } from '@google/genai';

// Initialize AI Client lazily to prevent serverless boot timeout crashes
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
    });
  }
  return aiClient;
}

export default async function handler(req: any, res: any) {
  // CORS configuration headers for flexibility
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Return immediately for preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const { pdfBase64, filename } = req.body || {};
    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: 'PDF base64 data is required' });
    }

    const ai = getAiClient();

    const promptText = `
      You are an expert Indonesian School Budget (RKAS) Auditor and PDF Parser.
      Analyze the uploaded RKAS (Rencana Kegiatan dan Anggaran Sekolah) document, focusing strictly on the "B. BELANJA" section table.
      
      Extract rows/lines according to these TWO strict rules:

      RULE 1: YELLOW HIGHLIGHT (Highlight Kuning)
      - Condition: If a row has a Kode Kegiatan matching the format "0X.XX.XX." (exactly 3 segments separated by dots, e.g. "03.01.01.", "03.01.03."), AND the corresponding cell in the "Uraian Kegiatan" column or the parent row itself has a YELLOW background highlight/color (berwarna kuning).
      - For these rows, set 'kodeKegiatan' to the exact activity code, 'kodeRekening' to "-", and 'uraian' to the text in the "Uraian Kegiatan" cell.

      RULE 2: ITALIC DESCRIPTION WITH ACCOUNT CODE (Tulisan Miring dengan Kode Rekening)
      - Condition: If a row has a Kode Kegiatan matching the format "0X.XX.XX." (exactly 3 segments separated by dots, e.g. "03.01.01.") AND has a Kode Rekening (e.g. "5.1.02.01.01.0026" or similar), AND the description under "Uraian Kegiatan" is styled in ITALIC text / cursive / skewed (tulisannya miring).
      - For these rows, set 'kodeKegiatan' to the activity code, 'kodeRekening' to the expenditure account code (e.g. "5.1.02.01.01.0026"), and 'uraian' to the italicized description of the individual line item.

      General Rules:
      - Only target the tables/sections within "B. BELANJA".
      - Strictly ignore any items that do not fit Rule 1 or Rule 2 (e.g., non-italic text with a code, or category headers with a different background color like green/blue, or plain upright text).
      - Clean the extracted digital strings: strip any trailing numeric prices/amounts at the far right end of descriptions (like "Rp 1.500.000").
      - Ensure you do NOT convert decimal codes like "3.2" or "3.01" to dates. They must remain strings of text exactly.
      
      Return the output as a JSON object strictly matching the requested schema structure.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          text: promptText,
        },
      ],
      config: {
        systemInstruction: "You are an ultra-precise RKAS parser that specializes in detecting cell formatting styles such as yellow highlights (highlight kuning) and italicized descriptions (tulisannya miring) in tables. Extract codes and descriptions exactly as written, and never convert decimal codes to dates.",
        temperature: 0.0,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kodeRekening: { type: Type.STRING },
                  kodeKegiatan: { type: Type.STRING },
                  uraian: { type: Type.STRING },
                },
                required: ['kodeRekening', 'kodeKegiatan', 'uraian'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const textOutput = response.text;
    if (!textOutput) {
      throw new Error('Received empty response from Gemini API');
    }

    const parsedData = JSON.parse(textOutput);
    return res.status(200).json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing RKAS with Gemini:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while parsing the PDF' });
  }
}
