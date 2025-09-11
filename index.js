const express = require('express');
const csv = require('csv');
const fs = require('fs');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let colleges = [];

// Helper function to clean names
function cleanName(name) {
    if (!name) return '';
    name = name.replace(/\:[^>]*\)/ig, "");
    name = name.replace(/(\(Id)/ig, "");
    return name;
}

// Load CSV before starting the server
fs.readFile('database.csv', (err, data) => {
    if (err) {
        console.error("Error reading CSV:", err);
        process.exit(1);
    }

    csv.parse(data, (err, data) => {
        if (err) {
            console.error("Error parsing CSV:", err);
            process.exit(1);
        }

        colleges = data;
        console.log("[cAPI] : CSV Loaded!");

        // Start server only after CSV is loaded
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    });
});

// Routes
app.get('/', (req, res) => {
    res.send("Colleges API: SriGuru Institute of Technology, Coimbatore");
});

// Get total colleges
app.post('/colleges/total', (req, res) => {
    if (!colleges || colleges.length === 0) return res.status(503).json({ error: "Data not loaded yet" });
    res.json({ total: colleges.length });
});

// Search colleges by keyword
app.post('/colleges/search', (req, res) => {
    if (!colleges || colleges.length === 0) return res.status(503).json({ error: "Data not loaded yet" });

    const keyword = (req.headers.keyword || "").toLowerCase();
    const result = [];

    for (let i = 0; i < colleges.length; i++) {
        if ((colleges[i][2] || "").toLowerCase().includes(keyword)) {
            colleges[i][2] = cleanName(colleges[i][2]);
            colleges[i][1] = cleanName(colleges[i][1]);
            result.push(colleges[i]);
        }
    }

    res.json(result);
});

// Get colleges by state with offset
app.post('/colleges/state', (req, res) => {
    if (!colleges || colleges.length === 0) return res.status(503).json({ error: "Data not loaded yet" });

    const state = (req.headers.state || "").toLowerCase();
    const offset = Number(req.headers.offset) || 0;

    const filtered = colleges.filter(c => (c[4] || "").toLowerCase().includes(state))
                             .map(c => ({ ...c, name: cleanName(c[2]), other_name: cleanName(c[1]) }));

    res.json(filtered.slice(offset, offset + 10));
});

// Get colleges by district with offset
app.post('/colleges/district', (req, res) => {
    if (!colleges || colleges.length === 0) return res.status(503).json({ error: "Data not loaded yet" });

    const district = (req.headers.district || "").toLowerCase();
    const offset = Number(req.headers.offset) || -1;

    const filtered = colleges.filter(c => (c[5] || "").toLowerCase().includes(district))
                             .map(c => ({ ...c, name: cleanName(c[2]), other_name: cleanName(c[1]) }));

    if (offset === -1) {
        res.json(filtered);
    } else {
        res.json(filtered.slice(offset, offset + 10));
    }
});

// Get all states
app.post('/allstates', (req, res) => {
    if (!colleges || colleges.length === 0) return res.status(503).json({ error: "Data not loaded yet" });

    const states = [...new Set(colleges.map(c => c[4]).filter(Boolean))];
    res.json(states);
});

// Get districts by state
app.post('/districts', (req, res) => {
    if (!colleges || colleges.length === 0) return res.status(503).json({ error: "Data not loaded yet" });

    const state = (req.headers.state || "").toLowerCase();
    const districts = [...new Set(colleges
        .filter(c => (c[4] || "").toLowerCase().includes(state))
        .map(c => c[5])
        .filter(Boolean)
    )];

    res.json(districts);
});
