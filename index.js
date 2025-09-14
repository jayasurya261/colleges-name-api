const express = require('express');
const csv = require('csv-parse'); // Changed from 'csv' to 'csv-parse'
const fs = require('fs').promises; // Use promises for async file handling
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // Required for parsing JSON body in hCaptcha endpoint

let colleges = null;

// Load CSV file at startup
async function loadCSV() {
  try {
    const data = await fs.readFile('database.csv');
    console.log("[cAPi] : File read !");

    await new Promise((resolve, reject) => {
      csv.parse(data, { columns: false }, (err, output) => {
        if (err) {
          console.error("[cAPi] : CSV parsing failed", err.message);
          reject(err);
          return;
        }
        colleges = output;
        console.log("[cAPi] : CSV Loaded ! Total records:", colleges.length);
        resolve();
      });
    });
  } catch (err) {
    console.error("[cAPi] : Failed to load CSV file", err.message);
    throw err;
  }
}

app.get('/', (req, res) => {
  res.send("Colleges API : SriGuru Institute of Technology, Coimbatore");
});

app.post('/colleges/total', (req, res) => {
  if (!colleges) {
    console.error("[cAPi] : Colleges data not loaded");
    return res.status(500).json({ error: 'Data not loaded' });
  }
  res.json({ total: colleges.length });
});

app.post('/colleges/search', (req, res) => {
  if (!colleges) {
    console.error("[cAPi] : Colleges data not loaded");
    return res.status(500).json({ error: 'Data not loaded' });
  }
  const keyword = req.headers.keyword?.toLowerCase();
  if (!keyword) {
    console.warn("[cAPi] : Search endpoint called without keyword");
    return res.status(400).json({ error: 'Missing keyword' });
  }

  const result = colleges
    .filter(row => row[2]?.toLowerCase().indexOf(keyword) >= 0)
    .map(row => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return cleanedRow;
    });

  res.json(result);
});

app.post('/colleges/state', (req, res) => {
  if (!colleges) {
    console.error("[cAPi] : Colleges data not loaded");
    return res.status(500).json({ error: 'Data not loaded' });
  }
  const state = req.headers.state?.toLowerCase();
  const offset = Number(req.headers.offset) || 0;
  console.log("[cAPi] : Offset:", offset);

  if (!state) {
    console.warn("[cAPi] : State endpoint called without state");
    return res.status(400).json({ error: 'Missing state' });
  }

  const result = colleges
    .filter(row => row[4]?.toLowerCase().indexOf(state) >= 0)
    .map(row => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return cleanedRow;
    });

  const limitResult = result.slice(offset, offset + 10);
  res.json(limitResult);
});

app.post('/colleges/district', (req, res) => {
  if (!colleges) {
    console.error("[cAPi] : Colleges data not loaded");
    return res.status(500).json({ error: 'Data not loaded' });
  }
  const district = req.headers.district?.toLowerCase();
  const offset = Number(req.headers.offset) || -1;
  console.log("[cAPi] : Offset:", offset);

  if (!district) {
    console.warn("[cAPi] : District endpoint called without district");
    return res.status(400).json({ error: 'Missing district' });
  }

  const result = colleges
    .filter(row => row[5]?.toLowerCase().indexOf(district) >= 0)
    .map(row => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return cleanedRow;
    });

  const response = offset === -1 ? result : result.slice(offset, offset + 10);
  res.json(response);
});

app.post('/allstates', (req, res) => {
  if (!colleges) {
    console.error("[cAPi] : Colleges data not loaded");
    return res.status(500).json({ error: 'Data not loaded' });
  }
  const result = [...new Set(colleges.slice(1).map(row => row[4]))];
  res.json(result);
});

app.post('/districts', (req, res) => {
  if (!colleges) {
    console.error("[cAPi] : Colleges data not loaded");
    return res.status(500).json({ error: 'Data not loaded' });
  }
  const state = req.headers.state?.toLowerCase();
  if (!state) {
    console.warn("[cAPi] : Districts endpoint called without state");
    return res.status(400).json({ error: 'Missing state' });
  }

  const result = [...new Set(
    colleges
      .filter(row => row[4]?.toLowerCase().indexOf(state) >= 0)
      .map(row => row[5])
  )];
  res.json(result);
});

// hCaptcha Verification Endpoint
app.post('/verify-hcaptcha', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    console.warn("[cAPi] : hCaptcha verification failed: missing token");
    return res.status(400).json({ success: false, error: 'missing-token' });
  }

  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) {
    console.error("[cAPi] : hCaptcha verification failed: missing secret");
    return res.status(500).json({ success: false, error: 'missing-secret' });
  }

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
    console.log("Example app listening at " + PORT);
  });
}).catch(err => {
  console.error("[cAPi] : Failed to start server", err.message);
  process.exit(1);
});