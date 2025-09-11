const express = require('express');
const fs = require('fs').promises;
const csv = require('csv');
const cors = require('cors');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let colleges = [];

// Helper function to clean college names
function cleanName(name) {
    if (!name) return "";
    name = name.replace(/\:[^>]*\)/ig, "");
    name = name.replace(/(\(Id)/ig, "");
    return name;
}

// Load CSV file asynchronously
async function loadCSV() {
    try {
        const data = await fs.readFile('db/database.csv');
        csv.parse(data, (err, parsedData) => {
            if (err) {
                console.error("Error parsing CSV:", err);
                process.exit(1);
            }
            colleges = parsedData;
            console.log("[cAPI] : CSV Loaded!");
        });
    } catch (err) {
        console.error("Error reading CSV file:", err);
        process.exit(1);
    }
}

// Middleware to check if colleges data is loaded
function ensureDataLoaded(req, res, next) {
    if (!colleges || colleges.length === 0) {
        return res.status(503).json({ error: "Data not loaded yet. Try again later." });
    }
    next();
}

// Routes
app.get('/', (req, res) => {
    res.send("Colleges API: SriGuru Institute of Technology, Coimbatore");
});

app.post('/colleges/total', ensureDataLoaded, (req, res) => {
    res.json({ total: colleges.length });
});

app.post('/colleges/search', ensureDataLoaded, (req, res) => {
    const keyword = (req.headers.keyword || "").toLowerCase();
    const result = [];

    colleges.forEach(college => {
        if ((college[2] || "").toLowerCase().includes(keyword)) {
            college[2] = cleanName(college[2]);
            college[1] = cleanName(college[1]);
            result.push(college);
        }
    });

    res.json(result);
});

app.post('/colleges/state', ensureDataLoaded, (req, res) => {
    const state = (req.headers.state || "").toLowerCase();
    const offset = Number(req.headers.offset) || 0;
    const result = [];

    colleges.forEach(college => {
        if ((college[4] || "").toLowerCase().includes(state)) {
            college[2] = cleanName(college[2]);
            college[1] = cleanName(college[1]);
            result.push(college);
        }
    });

    res.json(result.slice(offset, offset + 10));
});

app.post('/colleges/district', ensureDataLoaded, (req, res) => {
    const district = (req.headers.district || "").toLowerCase();
    const offset = Number(req.headers.offset) || -1;
    const result = [];

    colleges.forEach(college => {
        if ((college[5] || "").toLowerCase().includes(district)) {
            college[2] = cleanName(college[2]);
            college[1] = cleanName(college[1]);
            result.push(college);
        }
    });

    if (offset === -1) {
        return res.json(result);
    }

    res.json(result.slice(offset, offset + 10));
});

app.post('/allstates', ensureDataLoaded, (req, res) => {
    const states = [];
    colleges.forEach(college => {
        if (college[4] && !states.includes(college[4])) {
            states.push(college[4]);
        }
    });
    res.json(states);
});

app.post('/districts', ensureDataLoaded, (req, res) => {
    const state = (req.headers.state || "").toLowerCase();
    const districts = [];
    colleges.forEach(college => {
        if ((college[4] || "").toLowerCase().includes(state)) {
            if (college[5] && !districts.includes(college[5])) {
                districts.push(college[5]);
            }
        }
    });
    res.json(districts);
});

// Start the server after loading CSV
loadCSV().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});
