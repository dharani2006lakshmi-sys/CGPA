const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 } // keep under Vercel's request body limit
});

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash'];

const SYSTEM_PROMPT = `You are analyzing a college semester result / marksheet PDF from an Indian engineering college on a 10-point grading scale (O=10, A+=9, A=8, B+=7, B=6, C=5, U/RA/F/W=0 fail).

Extract every subject/course listed in the document, grouped by semester if the document shows semester grouping (e.g. "Semester I", "Sem 3", "III Semester"). For each subject return:
- name: the subject/course title, cleaned up (no course code, no extra whitespace)
- credit: the credit value as a number
- grade: one of exactly these letters: O, A+, A, B+, B, C, U (map any fail, reappear, arrear, absent, or withheld grade to "U")

Respond with ONLY valid JSON, no markdown code fences, no commentary, in exactly this shape:
{
  "semesters": [
    { "label": "Semester 1", "subjects": [ { "name": "string", "credit": number, "grade": "O" } ] }
  ]
}

If the document does not show a clear semester grouping, put everything under a single semester object labeled "Detected subjects".
If this document is not a result sheet / marksheet, or no subjects can be found, respond with exactly: { "semesters": [] }`;

async function handleParse(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ success: false, error: 'Server missing GEMINI_API_KEY' });
    }

    const base64Pdf = req.file.buffer.toString('base64');

    const body = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            { inline_data: { mime_type: 'application/pdf', data: base64Pdf } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json'
      }
    };

    let geminiRes;
    let lastError = '';
    let success = false;

    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`Attempting analysis with Gemini model: ${model}...`);
      try {
        geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (geminiRes.ok) {
          success = true;
          break;
        } else {
          const errText = await geminiRes.text();
          lastError = `Model ${model} returned status ${geminiRes.status}: ${errText}`;
          console.error(lastError);
        }
      } catch (e) {
        lastError = `Fetch error with model ${model}: ${e.message}`;
        console.error(lastError);
      }
    }

    if (!success) {
      console.error('All Gemini models failed. Last error:', lastError);
      return res.status(502).json({ success: false, error: 'AI service error: ' + lastError });
    }

    const data = await geminiRes.json();
    const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textOut) {
      console.error('No text in Gemini response:', JSON.stringify(data));
      return res.status(502).json({ success: false, error: 'No response from AI' });
    }

    let parsed;
    try {
      parsed = JSON.parse(textOut);
    } catch (e) {
      console.error('Failed to parse AI JSON output:', textOut);
      return res.status(502).json({ success: false, error: 'AI returned an unexpected format' });
    }

    return res.json({ success: true, semesters: parsed.semesters || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

// Handle regardless of exact path/trailing slash, since this whole
// function is dedicated to /api/parse-result on Vercel.
app.post('*', upload.single('file'), handleParse);
app.get('*', (req, res) => res.send('CGPA result-parser API is running.'));

module.exports = app;
