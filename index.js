import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dqudvximt",
  api_key: process.env.CLOUDINARY_API_KEY || "572978986545629",
  api_secret: process.env.CLOUDINARY_API_SECRET || "Ifgck_TiOLpEWvjXkB9pASw_3n8",
});

// Supabase Configuration
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_KEY || ""
);

// CSV Loader
let colleges = null;

async function loadCSV() {
  try {
    const url = "https://res.cloudinary.com/dqudvximt/raw/upload/v1759602659/database_maro0f.csv";
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.statusText}`);
    }

    const data = await response.text();
    console.log("[cAPi] : File fetched from Cloudinary!");

    await new Promise((resolve, reject) => {
      parse(data, { columns: false }, (err, output) => {
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

// PDF Compression
async function compressPDF(inputPath, outputPath) {
  try {
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    fs.writeFileSync(outputPath, pdfBytes);
    console.log("[cAPi] : PDF compressed successfully");
  } catch (error) {
    console.error("[cAPi] : PDF compression failed", error.message);
    throw error;
  }
}

// Routes
app.get("/", (req, res) => {
  res.send("Colleges API : SriGuru Institute of Technology, Coimbatore");
});

app.post("/colleges/total", (req, res) => {
  if (!colleges) return res.status(500).json({ error: "Data not loaded" });
  res.json({ total: colleges.length });
});

app.post("/colleges/search", (req, res) => {
  if (!colleges) return res.status(500).json({ error: "Data not loaded" });

  const keyword = req.headers.keyword?.toLowerCase() || "";
  // Removed strict check for keyword to allow empty searches
  const result = colleges
    .filter((row) => !keyword || row[2]?.toLowerCase().includes(keyword))
    .map((row) => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*\)/gi, "").replace(/($$   Id)/gi, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*   $$/gi, "").replace(/($$   Id)/gi, "");
      return cleanedRow;
    });

  res.json(result);
});

app.post("/colleges/state", (req, res) => {
  if (!colleges) return res.status(500).json({ error: "Data not loaded" });

  const state = req.headers.state?.toLowerCase();
  const offset = Number(req.headers.offset) || 0;
  if (!state) return res.status(400).json({ error: "Missing state" });

  const result = colleges
    .filter((row) => row[4]?.toLowerCase().includes(state))
    .map((row) => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*   $$/gi, "").replace(/($$   Id)/gi, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*   $$/gi, "").replace(/($$   Id)/gi, "");
      return cleanedRow;
    });

  res.json(result.slice(offset, offset + 10));
});

app.post("/colleges/district", (req, res) => {
  if (!colleges) return res.status(500).json({ error: "Data not loaded" });

  const district = req.headers.district?.toLowerCase();
  const offset = Number(req.headers.offset) || -1;
  if (!district) return res.status(400).json({ error: "Missing district" });

  const result = colleges
    .filter((row) => row[5]?.toLowerCase().includes(district))
    .map((row) => {
      const cleanedRow = [...row];
      cleanedRow[2] = cleanedRow[2].replace(/\:[^>]*   $$/gi, "").replace(/($$   Id)/gi, "");
      cleanedRow[1] = cleanedRow[1].replace(/\:[^>]*   $$/gi, "").replace(/(\(Id)/gi, "");
      return cleanedRow;
    });

  res.json(offset === -1 ? result : result.slice(offset, offset + 10));
});

app.post("/allstates", (req, res) => {
  if (!colleges) return res.status(500).json({ error: "Data not loaded" });
  const result = [...new Set(colleges.slice(1).map((row) => row[4]))];
  res.json(result);
});

app.post("/districts", (req, res) => {
  if (!colleges) return res.status(500).json({ error: "Data not loaded" });

  const state = req.headers.state?.toLowerCase();
  if (!state) return res.status(400).json({ error: "Missing state" });

  const result = [...new Set(colleges.filter((row) => row[4]?.toLowerCase().includes(state)).map((row) => row[5]))];
  res.json(result);
});

app.post("/verify-hcaptcha", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, error: "missing-token" });

  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return res.status(500).json({ success: false, error: "missing-secret" });

  try {
    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);

    const verifyRes = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
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

app.post("/upload-resume", upload.single("resume"), async (req, res) => {
  const inputPath = req.file?.path;
  if (!inputPath) return res.status(400).json({ success: false, error: "No file uploaded" });

  const userId = req.body.userId;
  if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

  const outputPath = path.join("uploads", `compressed_${Date.now()}.pdf`);

  try {
    // Validate file type
    const allowedTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      throw new Error("Invalid file type. Only PDF or DOCX allowed.");
    }

    // Validate file size (2MB)
    if (req.file.size > 2 * 1024 * 1024) {
      throw new Error("File size exceeds 2MB limit.");
    }

    // Compress PDF if it's a PDF
    if (req.file.mimetype === "application/pdf") {
      await compressPDF(inputPath, outputPath);
    } else {
      fs.copyFileSync(inputPath, outputPath);
    }

    // Upload to Cloudinary
    const fileName = `resumes/${userId}-resume.pdf`; // Added .pdf extension
    const result = await cloudinary.uploader.upload(outputPath, {
      resource_type: "raw",
      public_id: fileName,
      folder: "resumes",
      overwrite: true,
      upload_preset: "resumes_unsigned",
    });

    // Update Supabase with resume URL
    const { error: updateError } = await supabase
      .from("users")
      .update({ resume_url: result.secure_url })
      .eq("uid", userId);

    if (updateError) {
      throw new Error(`Failed to update resume URL in database: ${updateError.message}`);
    }

    // Cleanup local files
    fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    console.log("[cAPi] : Resume uploaded successfully for user:", userId, "URL:", result.secure_url);
    res.json({ success: true, url: result.secure_url });
  } catch (error) {
    console.error("[cAPi] : Resume upload error", error.message);

    // Cleanup on failure
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.error("[cAPi] : Cleanup failed", cleanupErr.message);
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/delete-resume", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: "Missing userId" });

  try {
    const publicId = `resumes/${userId}-resume.pdf`; // Added .pdf extension
    console.log("[cAPi] : Attempting to delete resume with public_id:", publicId);

    // Attempt to delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
      invalidate: true,
    });

    console.log("[cAPi] : Cloudinary delete result:", result);

    if (result.result === "ok" || result.result === "not found") {
      // Update Supabase
      const { error: updateError } = await supabase
        .from("users")
        .update({ resume_url: null })
        .eq("uid", userId);

      if (updateError) {
        console.error("[cAPi] : Supabase update error:", updateError.message);
        throw new Error(`Failed to update database: ${updateError.message}`);
      }

      console.log("[cAPi] : Resume deletion processed for user:", userId, "Cloudinary result:", result.result);
      res.json({
        success: true,
        message: result.result === "ok" ? "Resume deleted successfully" : "Resume not found in storage, database updated",
      });
    } else {
      throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }
  } catch (error) {
    console.error("[cAPi] : Resume deletion error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
loadCSV()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[cAPi] : Failed to start server", err.message);
    process.exit(1);
  });