const express = require("express");
const fs = require("fs");
const xml2js = require("xml2js");
const qrcode = require("qrcode");
const path = require("path"); // Corrected typo here as well

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// In-memory "database" to hold our processed transactions
let processedTransactions = [];
let receiptCounter = 10000; // Initial receipt number

// --- Data Processing Function ---
async function loadAndProcessTransactions() {
  try {
    // Read the XML file from the server's filesystem
    const xmlData = fs.readFileSync(path.join(__dirname, "data.xml"), "utf-8");

    // Parse XML to JavaScript Object
    const parser = new xml2js.Parser({ explicitArray: false, trim: true }); // added trim
    const result = await parser.parseStringPromise(xmlData);

    // Handle case where there's only one 'line' item, xml2js won't make it an array
    const transactions = Array.isArray(result.data.line)
      ? result.data.line
      : [result.data.line];
    const tempTransactions = [];

    // Use a for...of loop to handle async operations correctly
    for (const line of transactions) {
      // Helper to get text content from a node
      const getText = (node) => (node ? node.toString() : "");

      const totalPrice = parseFloat(getText(line.Total_price));
      const basePrice = parseFloat(getText(line.Base_price));
      const vatAmount = parseFloat(getText(line.VAT_Amount));
      // --- THIS IS THE CORRECTED LINE ---
      const preVatAmount = parseFloat(getText(line["Pre-VAT_Amount"]));

      const receiptNumber = receiptCounter++; // Assign a unique, sequential receipt number

      // Generate QR Code in the background
      const qrData = `https://etims.kra.go.ke/verify?receipt=${receiptNumber}&pin=P000000000Z&date=${getText(line.Receipt_date)}`;
      const qrCodeImage = await qrcode.toDataURL(qrData);

      tempTransactions.push({
        id: getText(line.Transaction_id),
        receiptNumber: receiptNumber,
        date: getText(line.Receipt_date),
        time: getText(line.Receipt_time),
        product: getText(line.Product_name),
        pump: getText(line.Pump),
        nozzle: getText(line.Nozzle),
        unitPrice: basePrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        vat: vatAmount.toFixed(2),
        subTotal: (preVatAmount - vatAmount).toFixed(2),
        quantity: basePrice > 0 ? (totalPrice / basePrice).toFixed(2) : "0.00",
        qrCode: qrCodeImage, // Store the generated QR code Data URL
      });
    }
    processedTransactions = tempTransactions;
    console.log(
      `${processedTransactions.length} transactions loaded and processed successfully.`,
    );
  } catch (error) {
    console.error("Failed to load or process XML data:", error);
  }
}

// --- Routes ---

// Main route to display the list of transactions
app.get("/", (req, res) => {
  res.render("index", { transactions: processedTransactions });
});

// API endpoint to get details for a single transaction
app.get("/transaction/:id", (req, res) => {
  const transaction = processedTransactions.find(
    (tx) => tx.id === req.params.id,
  );
  if (transaction) {
    res.json(transaction);
  } else {
    res.status(404).json({ error: "Transaction not found" });
  }
});

// --- Start the Server ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Load data as soon as the server starts
  loadAndProcessTransactions();
});
