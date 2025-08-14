const express = require("express");
const fs = require("fs");
const xml2js = require("xml2js");
const qrcode = require("qrcode");
const path = require("path");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuration ---
const API_BASE_URL = "https://deitax.deitiestech.com";

const API_ENDPOINT = `${API_BASE_URL}/api/v1/invoices`;
const API_AUTH_TOKEN = "Basic YWRtaW46YWRtaW4=";

// Mapping from Product Name in XML to the official Item Code for the API
const ITEM_CODE_MAP = {
  ULX: "KE2UCT0066469",
  DX: "KE2UCT0066470",
};

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// In-memory "database" to hold our processed transactions
let processedTransactions = [];

// --- Helper Function to Format Date for the API ---
function formatDateForAPI(dateStr, timeStr) {
  // Converts "23-07-2025" and "13:49:37" to "20250723134937"
  const [day, month, year] = dateStr.split("-");
  const time = timeStr.replace(/:/g, "");
  return `${year}${month}${day}${time}`;
}

// --- Main Data Processing Function ---
async function loadAndProcessTransactions() {
  console.log("Starting to load and process transactions...");
  try {
    // Read the XML file from the server's filesystem
    const xmlData = fs.readFileSync(path.join(__dirname, "data.xml"), "utf-8");

    // Parse XML to JavaScript Object
    const parser = new xml2js.Parser({ explicitArray: false, trim: true }); // added trim
    const result = await parser.parseStringPromise(xmlData);

    const transactions = Array.isArray(result.data.line)
      ? result.data.line
      : [result.data.line];
    const tempTransactions = [];

    for (const line of transactions) {
      const transactionId = line.Transaction_id || `item-${Date.now()}`;
      console.log(`Processing transaction ID: ${transactionId}`);

      try {
        // 1. Extract and calculate data from XML
        const totalPrice = parseFloat(line.Total_price);
        const basePrice = parseFloat(line.Base_price);
        const quantity = basePrice > 0 ? totalPrice / basePrice : 0;
        const productName = line.Product_name;
        const itemCode = ITEM_CODE_MAP[productName];

        if (!itemCode) {
          console.warn(
            `Skipping transaction ${transactionId}: No item code mapping found for product "${productName}"`,
          );
          continue; // Skip to the next transaction
        }

        // 2. Prepare the payload for the fiscalisation API
        const apiPayload = {
          traderInvoiceNo: `VIVO-${transactionId}`, // Ensure uniqueness
          totalAmount: totalPrice,
          paymentType: "01",
          salesTypeCode: "N",
          receiptTypeCode: "S",
          salesStatusCode: "02",
          salesDate: formatDateForAPI(line.Receipt_date, line.Receipt_time),
          currency: "KES",
          exchangeRate: 1.0,
          salesItems: [
            {
              itemCode: itemCode,
              qty: quantity,
              pkg: 0,
              unitPrice: basePrice,
              amount: totalPrice,
              discountAmount: 0,
            },
          ],
          customerPin: "",
          customerName: "",
        };

        // 3. Make the API call
        console.log(
          `Sending invoice ${apiPayload.traderInvoiceNo} to fiscalisation API...`,
        );
        const apiResponse = await axios.post(API_ENDPOINT, apiPayload, {
          headers: {
            Authorization: API_AUTH_TOKEN,
            "Content-Type": "application/json",
          },
        });

        // 4. Process the successful API response
        if (apiResponse.data && apiResponse.data.statusCode === "SUCCES") {
          const fiscalData = apiResponse.data.data;
          console.log(
            `Successfully fiscalised invoice. Official Receipt No: ${fiscalData.scuReceiptNo}`,
          );

          // Generate a QR code from the official verification URL
          const qrCodeImage = await qrcode.toDataURL(
            fiscalData.invoiceVerificationUrl,
          );

          // 5. Store the combined data
          tempTransactions.push({
            id: transactionId,
            receiptNumber: fiscalData.scuReceiptNo,
            date: line.Receipt_date,
            time: line.Receipt_time,
            product: productName,
            pump: line.Pump,
            nozzle: line.Nozzle,
            unitPrice: basePrice.toFixed(2),
            totalPrice: totalPrice.toFixed(2),
            vat: fiscalData.totalTaxAmount.toFixed(2),
            subTotal: fiscalData.totalTaxableAmount.toFixed(2),
            quantity: quantity.toFixed(2),
            qrCode: qrCodeImage,
            signature: fiscalData.signature,
            internalData: fiscalData.internalData,
            scdcId: fiscalData.scdcId,
          });
        } else {
          console.error(
            `API Error for ${transactionId}:`,
            apiResponse.data.message || "Unknown API error",
          );
        }
      } catch (error) {
        // Handle errors for a single transaction (e.g., network issue, API error response)
        console.error(
          `Failed to process transaction ID ${transactionId}. Error:`,
          error.response ? error.response.data : error.message,
        );
      }
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
