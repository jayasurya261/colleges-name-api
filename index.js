const express = require('express');
const csv = require('csv-parse');
const fs = require('fs').promises; // Use promises for cleaner async handling
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let colleges = []; // Initialize as empty array to avoid undefined errors

// Function to load and parse CSV file
async function loadCSV() {
  try {
    console.log("[cAPi] : Reading file...");
    const data = await fs.readFile('db/database.csv', 'utf8');
    console.log("[cAPi] : File read!");

    // Parse CSV data
    await new Promise((resolve, reject) => {
      csv.parse(data, { trim: true }, (err, parsedData) => {
        if (err) {
          console.error("[cAPi] : Error parsing CSV:", err);
          return reject(err);
        }
        colleges = parsedData;
        console.log("[cAPi] : CSV Loaded!");
        resolve();
      });
    });
  } catch (err) {
    console.error("[cAPi] : Failed to load CSV:", err);
    throw err; // Rethrow to handle in server startup
  }
}

// Root endpoint
app.get('/', (req, res) => {
  res.send("Colleges API : SriGuru Institute of Technology, Coimbatore");
});

// Total colleges endpoint
app.post('/colleges/total', (req, res) => {
  if (!colleges || colleges.length === 0) {
    return res.status(503).send({ error: "Data not loaded yet" });
  }
  res.send(JSON.stringify({ total: colleges.length }));
});

// Search colleges by keyword
app.post('/colleges/search', (req, res) => {
  if (!colleges || colleges.length === 0) {
    return res.status(503).send({ error: "Data not loaded yet" });
  }

  const keyword = req.headers.keyword?.toLowerCase();
  if (!keyword) {
    return res.status(400).send({ error: "Keyword header is required" });
  }

  const result = colleges
    .filter(row => row[2]?.toLowerCase().includes(keyword))
    .map(row => {
      const newRow = [...row];
      newRow[2] = newRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      newRow[1] = newRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return newRow;
    });

  res.send(JSON.stringify(result));
});

// Search colleges by state
app.post('/colleges/state', (req, res) => {
  if (!colleges || colleges.length === 0) {
    return res.status(503).send({ error: "Data not loaded yet" });
  }

  const state = req.headers.state?.toLowerCase();
  const offset = Number(req.headers.offset) || 0;

  if (!state) {
    return res.status(400).send({ error: "State header is required" });
  }

  const result = colleges
    .filter(row => row[4]?.toLowerCase().includes(state))
    .map(row => {
      const newRow = [...row];
      newRow[2] = newRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      newRow[1] = newRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return newRow;
    });

  const limitResult = result.slice(offset, offset + 10);
  res.send(JSON.stringify(limitResult));
});

// Search colleges by district
app.post('/colleges/district', (req, res) => {
  if (!colleges || colleges.length === 0) {
    return res.status(503).send({ error: "Data not loaded yet" });
  }

  const district = req.headers.district?.toLowerCase();
  const offset = Number(req.headers.offset) || -1;

  if (!district) {
    return res.status(400).send({ error: "District header is required" });
  }

  const result = colleges
    .filter(row => row[5]?.toLowerCase().includes(district))
    .map(row => {
      const newRow = [...row];
      newRow[2] = newRow[2].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      newRow[1] = newRow[1].replace(/\:[^>]*\)/ig, "").replace(/(\(Id)/ig, "");
      return newRow;
    });

  if (offset === -1) {
    return res.send(JSON.stringify(result));
  }

  const limitResult = result.slice(offset, offset + 10);
  res.send(JSON.stringify(limitResult));
});

// Get all states
app.post('/allstates', (req, res) => {
  if (!colleges || colleges.length === 0) {
    return res.status(503).send({ error: "Data not loaded yet" });
  }

  const result = [...new Set(colleges.slice(1).map(row => row[4]))];
  res.send(JSON.stringify(result));
});

// Get districts by state
app.post('/districts', (req, res) => {
  if (!colleges || colleges.length === 0) {
    return res.status(503).send({ error: "Data not loaded yet" });
  }

  const state = req.headers.state?.toLowerCase();
  if (!state) {
    return res.status(400).send({ error: "State header is required" });
  }

  const result = [...new Set(
    colleges
      .filter(row => row[4]?.toLowerCase().includes(state))
      .map(row => row[5])
  )];

  res.send(JSON.stringify(result));
});

// Start server only after CSV is loaded
async function startServer() {
  try {
    await loadCSV();
    app.listen(PORT, () => {
      console.log(`Example app listening at ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
