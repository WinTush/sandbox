const traderName = "Vivo Energy";
let currentTransaction = null; // To hold the data of the currently viewed receipt

function formatWithHyphens(str) {
  // Remove existing hyphens (if any) and split into chunks of 4
  return str
    .replace(/-/g, "")
    .match(/.{1,4}/g)
    .join("-");
}

async function viewReceipt(transactionId) {
  try {
    // Fetch the specific transaction details from our server's API
    const response = await fetch(`/transaction/${transactionId}`);
    if (!response.ok) {
      throw new Error("Transaction not found");
    }
    const tx = await response.json();
    currentTransaction = tx; // Store the transaction data

    const receiptContainer = document.getElementById("receipt-container");
    const modal = document.getElementById("receiptModal");

    const receiptHTML = `
            <div style="text-align: center;">
                <img src="imgs/kra.png" alt="KRA Logo" style="width: 80px; margin-bottom: 5px;">
                <p style="font-weight: bold; font-size: 1.1em; margin:0;">KENYA REVENUE AUTHORITY</p>
                <p style="margin:0; font-size: 0.7em;">ISO 9001:2015 CERTIFIED</p>
                <h3 style="margin: 10px 0 5px 0;">Normal Invoice</h3>
            </div>
            <div>
                <p><strong>Trader:</strong> ${traderName}<br>
                   <strong>PIN:</strong> P000000000Z</p>
                <p style="border-top: 1px dashed; border-bottom: 1px dashed; padding: 5px 0; margin: 10px 0; text-align:center;"><strong>TAX INVOICE</strong></p>
                <p><strong>PUMP:</strong> ${tx.pump} &nbsp;&nbsp; <strong>NOZZLE:</strong> ${tx.nozzle}</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                     <thead>
                        <tr>
                            <th style="text-align: left;">Item</th>
                            <th style="text-align: right;">Qty</th>
                            <th style="text-align: right;">Price</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td colspan="4" style="border-bottom: 1px dashed;"></td></tr>
                        <tr>
                            <td style="padding-top: 5px;">${tx.product}</td>
                            <td style="text-align: right;">${tx.quantity}</td>
                            <td style="text-align: right;">${tx.unitPrice}</td>
                            <td style="text-align: right;">${tx.totalPrice} B</td>
                        </tr>
                    </tbody>
                </table>
                 <table style="width: 100%; margin-top: 20px;">
                    <tr><td>SUB TOTAL</td><td style="text-align: right;">${tx.subTotal}</td></tr>
                    <tr><td style="font-weight: bold;">VAT</td><td style="text-align: right; font-weight: bold;">${tx.vat}</td></tr>
                    <tr><td style="font-weight: bold; font-size: 0.9em;">TOTAL</td><td style="text-align: right; font-weight: bold; font-size: 0.9em;">${tx.totalPrice}</td></tr>
                </table>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <p style="border-top: 1px dashed; padding-top: 10px;">--- SCU INFORMATION ---</p>
                <p><strong>Internal Data:</strong><br /> ${formatWithHyphens(tx.internalData)}</p>
                <p><strong>Receipt Signature:</strong><br /> ${formatWithHyphens(tx.signature)}</p>
                <p><strong>SCU ID:</strong> KRACU0300003629 </p>
                <p><strong>CU INVOICE NO:</strong> KRACU0300003629/${tx.receiptNumber} </p>
                <p><strong>Date:</strong> ${tx.date} <strong>Time:</strong> ${tx.time}</p>
                <!-- Use the pre-generated QR code from the server -->
                <img src="${tx.qrCode}" alt="QR Code" style="margin: 10px auto; display:block;">
                <p style="border-top: 1px dashed; padding-top: 10px;">--- TIS INFORMATION ---</p>
                <!-- Use the stable receipt number from the server -->
                <p><strong>RECEIPT NUMBER:</strong> ${tx.receiptNumber}</p>
                <p style="border-top: 1px dashed; padding-top: 10px;">THANK YOU</p>
            </div>
        `;
    receiptContainer.innerHTML = receiptHTML;
    modal.style.display = "block";
  } catch (error) {
    console.error("Failed to fetch transaction:", error);
    alert(error.message);
  }
}

function printReceipt() {
  const receiptContent = document.getElementById("receipt-container");
  const printWindow = window.open("", "", "height=800,width=500");
  printWindow.document.write("<html><head><title>Print Receipt</title>");
  printWindow.document.write(
    "<style>body { font-family: monospace; font-size: 11px; } table { width: 100%; border-collapse: collapse; } th, td { padding: 2px; } </style>",
  );
  printWindow.document.write("</head><body>");
  printWindow.document.write(receiptContent.innerHTML);
  printWindow.document.write("</body></html>");
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

function downloadReceipt() {
  if (!currentTransaction) return;
  const element = document.getElementById("receipt-container");
  const opt = {
    margin: [0.2, 0.2, 0.2, 0.2],
    filename: `receipt-${currentTransaction.receiptNumber}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "in", format: [3.15, 8], orientation: "portrait" },
  };
  html2pdf().from(element).set(opt).save();
}

// --- Modal close functionality ---
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("receiptModal");
  const span = document.getElementsByClassName("close-button")[0];
  span.onclick = () => (modal.style.display = "none");
  window.onclick = (event) => {
    if (event.target == modal) {
      modal.style.display = "none";
    }
  };
});
