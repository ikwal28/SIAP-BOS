import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Set up JSON and urlencoded body parser with generous limit for PDF uploads
app.use(express.text({ limit: '50mb', type: ['text/*', 'application/json', 'application/x-www-form-urlencoded'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { pdfBase64, filename } = body || {};
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
    return res.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Error parsing RKAS with Gemini:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while parsing the PDF' });
  }
});

// API endpoint for parsing specifically RKAS Tahapan with new rules
app.post('/api/parse-rkas-tahapan', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { pdfBase64 } = body || {};
    if (!pdfBase64) {
      return res.status(400).json({ success: false, message: 'PDF base64 data is required' });
    }

    const ai = getAiClient();

    const promptText = `
      You are an expert Indonesian School Budget (RKAS) Auditor and PDF Parser specializing in "RKAS Tahapan" documents.
      Analyze the uploaded document's "B. BELANJA" section table.
      
      Extract rows according to these strict rules. Be extremely robust: 
      
      RULE 1: KODE KEGIATAN / KODE PROGRAM level 3 without KODE REKENING
      - Condition: If "KODE KEGIATAN/KODE PROGRAM" has exactly three segments separated by dots (e.g., "03.01.01.") AND there is NO "KODE REKENING".
      - Action: Extract ONLY the "URAIAN KEGIATAN" text. Do NOT extract rows where KODE KEGIATAN is only 1 or 2 segments (like "03." or "03.01."); ignore those entirely.
      - Mapping: 'kodeKegiatan' = activity code, 'kodeRekening' = "-", 'uraian' = Uraian Kegiatan text. Leave Volume, Satuan, Tarif Harga, Jumlah as "-".
      
      RULE 2: Full Data (KODE REKENING present + KODE KEGIATAN present)
      - Condition: If a row has BOTH data in "KODE REKENING" AND data in "KODE KEGIATAN/KODE PROGRAM".
      - Action: Extract all data.
      - Mapping: 'kodeKegiatan' = activity code, 'kodeRekening' = rekening code, 'uraian' = Uraian Kegiatan, 'volume' = Volume, 'satuan' = Satuan, 'tarifHarga' = Tarif Harga, 'jumlah' = Jumlah. 
      - IMPORTANT: If Volume, Satuan, Tarif Harga, or Jumlah cells appear to have data in the table, you MUST extract them. If a cell is visually empty or contains just a dash, use "-" as the value.

      Return the output as JSON with the requested schema.
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
        systemInstruction: "You are an ultra-precise RKAS Tahapan parser that extracts all columns including Volume, Satuan, Tarif Harga, and Jumlah when provided, and strictly filters rows based on the presence of rekening code.",
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
                  volume: { type: Type.STRING },
                  satuan: { type: Type.STRING },
                  tarifHarga: { type: Type.STRING },
                  jumlah: { type: Type.STRING },
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
    console.error('Error parsing RKAS Tahapan with Gemini:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while parsing the PDF' });
  }
});

// API endpoint for formulating RKAS Tahapan splits with Gemini AI
app.post('/api/formulate-phased', async (req, res) => {
  try {
    const { items, prompt } = req.body || {};
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Items array is required' });
    }

    const ai = getAiClient();

    const promptText = `
      You are an expert School Budgeting System Assistant (AI Formulator).
      Your task is to divide the annual RKAS items into phased chunks (Tahap I and Tahap II) based on user instructions.
      
      User Instructions / Formula:
      "${prompt || 'Bagi rata atau tempatkan secara seimbang'}"
      
      List of annual RKAS items to process:
      ${JSON.stringify(items, null, 2)}
      
      Rules for each item:
      - Assign "tahap" as:
        - "1" if only budgeted in Tahap I (Januari - Juni), with porsiTahap1 = 100 and porsiTahap2 = 0.
        - "2" if only budgeted in Tahap II (Juli - Desember), with porsiTahap1 = 0 and porsiTahap2 = 100.
        - "both" if budgeted in both stages, with porsiTahap1 and porsiTahap2 summing up strictly to 100.
      - Default assignment (if user instructions do not specify a rule for an item):
        - Items like "ujian", "asesmen", "semester 1", "ppdb", or first semester activities default to "tahap": "1" with porsiTahap1 = 100, porsiTahap2 = 0.
        - Items like "semester 2", "akhir tahun", or second semester activities default to "tahap": "2" with porsiTahap1 = 0, porsiTahap2 = 100.
        - General items default to "both" with porsiTahap1 = 50, porsiTahap2 = 50 (or similar balanced split).
      - Ensure you follow the specific user instructions precisely. For example:
        - "Bagi rata 50:50" -> All items set to "both" with porsiTahap1 = 50, porsiTahap2 = 50.
        - "ATK 80% di Tahap I" -> All stationery / ATK items get porsiTahap1 = 80, porsiTahap2 = 20, tahap = "both".
        
      For each item in the input list, return its exact "id" along with the decided "tahap", "porsiTahap1", and "porsiTahap2".
      porsiTahap1 and porsiTahap2 must be integers between 0 and 100 inclusive, and their sum must equal 100.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          text: promptText,
        },
      ],
      config: {
        systemInstruction: "You are an intelligent Indonesian school budget (RKAS) formulator. You split annual budget line-items into Tahap I (Jan-Jun) and Tahap II (Jul-Dec) based on budgeting rules and custom instructions, returning structured results in JSON.",
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  tahap: { type: Type.STRING, description: "Must be '1', '2', or 'both'" },
                  porsiTahap1: { type: Type.INTEGER, description: "Integer from 0 to 100" },
                  porsiTahap2: { type: Type.INTEGER, description: "Integer from 0 to 100" },
                },
                required: ['id', 'tahap', 'porsiTahap1', 'porsiTahap2'],
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
    console.error('Error formulating phased RKAS with Gemini:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error while formulating RKAS' });
  }
});

// Proxy endpoint to prevent "Failed to fetch" (CORS / iframe redirects)
app.all('/api/sys-proxy', async (req: any, res: any) => {
  try {
    const rawGasUrl = process.env.GAS_API_URL || "https://script.google.com/macros/s/AKfycbxWtV_fgX6QA3eSc-bN1plX2scwInZeEkbIbjMSNRWAMJaYVvqIHzjjPG2rq1hTETe0/exec";
    
    // Parse the query string to append query params
    const targetUrl = new URL(rawGasUrl);
    for (const [key, val] of Object.entries(req.query)) {
      targetUrl.searchParams.set(key, String(val));
    }

    const options: any = {
      method: req.method,
      headers: {
        'Accept': 'application/json, text/plain, */*',
      }
    };

    // Forward the content-type header if present
    const contentType = req.headers['content-type'];
    if (contentType) {
      options.headers['Content-Type'] = contentType;
    }

    // Forward body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl.toString(), options);
    const responseText = await response.text();
    
    res.status(response.status);
    const responseContentType = response.headers.get('content-type');
    if (responseContentType) {
      res.setHeader('Content-Type', responseContentType);
    }
    
    return res.send(responseText);
  } catch (error: any) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ success: false, message: 'Proxy failed to fetch', error: error.message });
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
