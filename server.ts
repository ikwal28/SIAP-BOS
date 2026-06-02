import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON body parser with generous limit for PDF uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Initialize Google GenAI securely on the server
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// API endpoint for parsing RKAS yearly PDF with Gemini
app.post('/api/parse-rkas', async (req, res) => {
  try {
    const { pdfBase64, filename } = req.body;
    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: 'PDF base64 data is required' });
    }

    const ai = getAiClient();

    const promptText = `
      You are an expert Indonesian School Budget (RKAS) Auditor and PDF Parser.
      Analyze the uploaded RKAS (Rencana Kegiatan dan Anggaran Sekolah) document and extract the items from the "B. BELANJA" section according to the following strict rules:

      Columns/Fields to Extract:
      1. 'kodeRekening' (String): The expenditure account code (e.g., "5.1.02.01.01.0026"). For top-level nested categories or parent program/activities that do not have an account code, set this to "-".
      2. 'kodeKegiatan' (String): The activity code (e.g., "3.1", "03.", "03.01.", "03.01.01."). IMPORTANT: Ensure decimal activity codes like "3.1", "3.2", "2.1" are extracted EXACTLY as strings (do NOT convert them to dates or let them be represented as calendar dates).
      3. 'uraian' (String): The complete program name, sub-activity, or line item name.

      Row Filtering & Level Extraction Rules:
      - Only read the tables in the "B. BELANJA" section.
      - Parse nested levels according to their styling/colors on the original document:
        - Level 1: Marked by bold/colored headers (like RED/MERAH), typically indicating high-level activities (e.g. "03. Pengembangan Standar...").
        - Level 2: Marked by intermediate headers (like GREEN/HIJAU) (e.g. "03.01. Kegiatan Belajar...").
        - Level 3: Marked by yellow/KUNING background or sub-activities (e.g. "03.01.01. Penyediaan ATK...").
        - Level 4: Marked by italic font / huruf miring, which contains individual items and specific account codes (e.g., 5.1.02...).
      - Skip/Ignore: Ignore any other rows that are not highlighted with these colors and are in plain upright text (bukan miring).
      - Reconcile multi-line descriptions: If a description spans multiple physical rows vertically under the same record, combine them into a single string.

      Return the list of budget entries in structured JSON format. Run as fast and as focused as possible.
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
        systemInstruction: "You are a ultra-precise and lightning-fast RKAS OCR scanner. Extract activity codes exactly as written (e.g., '3.1', '2.2') and never convert decimal codes into date strings.",
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
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing RKAS with Gemini:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while parsing the PDF' });
  }
});

// Configure Vite middleware in development or static hosting in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SIAP BOS] Server listening on http://localhost:${PORT}`);
  });
}

startServer();
