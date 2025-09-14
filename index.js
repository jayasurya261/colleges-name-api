const express = require('express');
const csv = require('csv-parse');
const cors = require('cors');
const fetch = require('node-fetch'); // ✅ v2 for CommonJS

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // For JSON body parsing

let colleges = null;

// Load CSV file from Cloudinary at startup
async function loadCSV() {
  try {
    const url = "https://res.cloudinary.com/dqudvximt/raw/upload/v1757837730/database_v9cewf.csv";
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }

    const data = await response.text();
    console.log("[cAPi] : File fetched from Cloudinary!");

    await new Promise((resolve, reject) => {
      csv.parse(data, { columns: false }, (err, output) => {
        if (err) {
          console.error("[cAPi] : CSV parsing failed", err.message);
          reject(err);
          return;
        }
        colleges = output;
        console.log("[cAPi] : CSV Loaded! Total records:", colleges.length);
        resolve();
      });
    });
  } catch (err) {
    console.error("[cAPi] : Failed to load CSV file", err.message);
    throw err;
  }
}

// Root
app.get('/', (req, res) => {
  res.send("Colleges API : SriGuru Institute of Technology, Coimbatore");
});

// Total colleges
app.post('/colleges/total', (req, res) => {
  if (!colleges) return res.status(500).json({ error: 'Data not loaded' });
  res.json({ total: colleges.length });
});

// Search colleges by keyword
app.post('/colleges/search', (req, res) => {
  if (!colleges) return res.status(500).json({ error: 'Data not loaded' });

  const keyword = req.headers.keyword?.toLowerCase();
  if (!keyword) return res.status(400).json({ error: 'Missing keyword' });

  const result = colleges
    .filter(row => row[2]?.toLowerCase().includes(keyword))
    .map(row => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return cleanedRow;
    });

  res.json(result);
});

// Colleges by state
app.post('/colleges/state', (req, res) => {
  if (!colleges) return res.status(500).json({ error: 'Data not loaded' });

  const state = req.headers.state?.toLowerCase();
  const offset = Number(req.headers.offset) || 0;
  if (!state) return res.status(400).json({ error: 'Missing state' });

  const result = colleges
    .filter(row => row[4]?.toLowerCase().includes(state))
    .map(row => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return cleanedRow;
    });

  res.json(result.slice(offset, offset + 10));
});

// Colleges by district
app.post('/colleges/district', (req, res) => {
  if (!colleges) return res.status(500).json({ error: 'Data not loaded' });

  const district = req.headers.district?.toLowerCase();
  const offset = Number(req.headers.offset) || -1;
  if (!district) return res.status(400).json({ error: 'Missing district' });

  const result = colleges
    .filter(row => row[5]?.toLowerCase().includes(district))
    .map(row => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return cleanedRow;
    });

  res.json(offset === -1 ? result : result.slice(offset, offset + 10));
});

// All states
app.post('/allstates', (req, res) => {
  if (!colleges) return res.status(500).json({ error: 'Data not loaded' });
  const result = [...new Set(colleges.slice(1).map(row => row[4]))];
  res.json(result);
});

// Districts by state
app.post('/districts', (req, res) => {
  if (!colleges) return res.status(500).json({ error: 'Data not loaded' });

  const state = req.headers.state?.toLowerCase();
  if (!state) return res.status(400).json({ error: 'Missing state' });

  const result = [...new Set(
    colleges
      .filter(row => row[4]?.toLowerCase().includes(state))
      .map(row => row[5])
  )];
  res.json(result);
});

// hCaptcha verification
app.post('/verify-hcaptcha', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: 'missing-token' });

  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return res.status(500).json({ success: false, error: 'missing-secret' });

  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);

    const verifyRes = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      body: params,
    });

    const body = await verifyRes.json();
    console.log("[cAPi] : hCaptcha verification completed", { success: body.success });
    res.json(body);
  } catch (err) {
    console.error("[cAPi] : hCaptcha verification error", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server after loading CSV
loadCSV().then(() => {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}).catch(err => {
  console.error("[cAPi] : Failed to start server", err.message);
  process.exit(1);
});

