// Receipt & PDF Generation Engine for Dhadi Wala
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MONTH_NAMES_EN, MONTH_NAMES_HI, formatINR } from './data.js';

// Number to Indian Words Converter (e.g., 4500 -> Four Thousand Five Hundred Rupees Only)
export function numberToWordsINR(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees Only (शून्य रुपये)';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 
                 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 20) return units[n];
    return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + units[n % 10] : '');
  }

  function convertChunk(n) {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += units[Math.floor(n / 100)] + ' Hundred ';
      n = n % 100;
    }
    if (n > 0) {
      str += convertTwoDigits(n);
    }
    return str.trim();
  }

  let words = '';
  let crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  let thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  let hundredPart = remainder;

  if (crore > 0) {
    words += convertTwoDigits(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertTwoDigits(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertTwoDigits(thousand) + ' Thousand ';
  }
  if (hundredPart > 0) {
    words += convertChunk(hundredPart);
  }

  return words.trim() + ' Rupees Only';
}

// Generate the printable receipt HTML
export function buildReceiptData(AppState) {
  const worker = AppState.labours.find(l => l.labourId === AppState.selectedWorkerId);
  const workerName = worker ? worker.name : 'All Workers';
  const workerSkill = worker ? (worker.skill || 'General Labour') : 'General';
  const workerMobile = worker?.mobile || 'N/A';
  const workerLocation = (worker?.village ? `${worker.village}, ` : '') + (worker?.city || '');

  const contractor = AppState.currentUser || { name: 'Contractor / Supervisor', mobile: '9876543210' };
  const contractorName = contractor.name || 'Contractor / Supervisor';
  const contractorMobile = contractor.mobile || '';

  const monthIdx = AppState.selectedMonth;
  const year = AppState.selectedYear;
  const monthNameEn = MONTH_NAMES_EN[monthIdx];
  const monthNameHi = MONTH_NAMES_HI[monthIdx];

  // Count working days
  let totalWorkingDays = 0;
  let fullDaysCount = 0;
  let halfDaysCount = 0;
  let absentDaysCount = 0;

  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const val = AppState.currentDailyEntries[d];
    if (val === 1) {
      fullDaysCount++;
      totalWorkingDays += 1;
    } else if (val === 0.5) {
      halfDaysCount++;
      totalWorkingDays += 0.5;
    } else {
      absentDaysCount++;
    }
  }

  const dailyRate = AppState.currentDailyRate || 0;
  const subtotalWage = Math.round(totalWorkingDays * dailyRate);
  const advanceAmount = AppState.currentAdvanceAmount || 0;
  const bonusAmount = AppState.currentBonusAmount || 0;
  const netPayable = Math.max(0, subtotalWage - advanceAmount + bonusAmount);

  const receiptNo = `DW-${year}${String(monthIdx + 1).padStart(2, '0')}-${String(Math.abs(hashString(workerName + year))).slice(0, 4)}`;
  const issueDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return {
    receiptNo,
    issueDate,
    contractorName,
    contractorMobile,
    workerName,
    workerSkill,
    workerMobile,
    workerLocation,
    monthNameEn,
    monthNameHi,
    year,
    daysInMonth,
    fullDaysCount,
    halfDaysCount,
    absentDaysCount,
    totalWorkingDays,
    dailyRate,
    subtotalWage,
    advanceAmount,
    bonusAmount,
    netPayable,
    amountInWords: numberToWordsINR(netPayable)
  };
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// Render the Receipt HTML element inside the modal
export function renderReceiptCard(receiptData) {
  return `
    <div id="printable-receipt-card" class="printable-receipt-slip">
      <!-- Receipt Header -->
      <div class="receipt-header">
        <div class="receipt-header-left">
          <div class="receipt-brand-row">
            <div class="receipt-logo-icon"><i class="fa-solid fa-helmet-safety"></i></div>
            <div>
              <div class="receipt-brand-name">DHADI WALA (धाड़ी वाला)</div>
              <div class="receipt-brand-tag">Labour Attendance & Digital Wage Voucher</div>
            </div>
          </div>
        </div>
        <div class="receipt-header-right">
          <div class="receipt-badge">OFFICIAL SLIP</div>
          <div class="receipt-meta-row"><strong>Voucher No:</strong> <span>${receiptData.receiptNo}</span></div>
          <div class="receipt-meta-row"><strong>Date:</strong> <span>${receiptData.issueDate}</span></div>
        </div>
      </div>

      <div class="receipt-divider"></div>

      <!-- Parties Info (Contractor & Worker) -->
      <div class="receipt-parties-grid">
        <div class="receipt-party-box">
          <div class="party-role-tag">ISSUED BY (ठेकेदार / मालिक)</div>
          <div class="party-name">${receiptData.contractorName}</div>
          <div class="party-detail"><i class="fa-solid fa-phone"></i> ${receiptData.contractorMobile || 'Registered Supervisor'}</div>
          <div class="party-detail"><i class="fa-solid fa-shield-check"></i> Verified Contractor Profile</div>
        </div>
        <div class="receipt-party-box">
          <div class="party-role-tag" style="color: #0284c7; background: #e0f2fe;">WORKER / LABOUR (कारीगर / मजदूर)</div>
          <div class="party-name">${receiptData.workerName}</div>
          <div class="party-detail"><i class="fa-solid fa-wrench"></i> ${receiptData.workerSkill}</div>
          <div class="party-detail"><i class="fa-solid fa-phone"></i> ${receiptData.workerMobile}</div>
          ${receiptData.workerLocation ? `<div class="party-detail"><i class="fa-solid fa-location-dot"></i> ${receiptData.workerLocation}</div>` : ''}
        </div>
      </div>

      <!-- Month & Attendance Summary -->
      <div class="receipt-section-title">
        <span>ATTENDANCE STATEMENT: ${receiptData.monthNameEn} ${receiptData.year} (${receiptData.monthNameHi})</span>
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <th>Attendance Description</th>
            <th style="text-align: center;">Days Count</th>
            <th style="text-align: right;">Unit Rate</th>
            <th style="text-align: right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Full Day Dhadi (पूरा दिन)</strong>
              <div class="sub-text">1.0 Dhadi credit per day</div>
            </td>
            <td style="text-align: center; font-weight: 700;">${receiptData.fullDaysCount} Days</td>
            <td style="text-align: right;">${formatINR(receiptData.dailyRate)}</td>
            <td style="text-align: right; font-weight: 600;">${formatINR(receiptData.fullDaysCount * receiptData.dailyRate)}</td>
          </tr>
          <tr>
            <td>
              <strong>Half Day Dhadi (आधा दिन)</strong>
              <div class="sub-text">0.5 Dhadi credit per day</div>
            </td>
            <td style="text-align: center; font-weight: 700;">${receiptData.halfDaysCount} Days (${receiptData.halfDaysCount * 0.5} D)</td>
            <td style="text-align: right;">${formatINR(receiptData.dailyRate / 2)}</td>
            <td style="text-align: right; font-weight: 600;">${formatINR(receiptData.halfDaysCount * 0.5 * receiptData.dailyRate)}</td>
          </tr>
          <tr class="receipt-summary-row">
            <td><strong>TOTAL DHADI ATTENDANCE (कुल हाजिरी)</strong></td>
            <td style="text-align: center; font-weight: 800; color: #ea580c;">${receiptData.totalWorkingDays} Dhadi Days</td>
            <td style="text-align: right;">—</td>
            <td style="text-align: right; font-weight: 800; color: #0f172a;">${formatINR(receiptData.subtotalWage)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Financial Calculations Table -->
      <div class="receipt-section-title" style="margin-top: 14px;">
        <span>PAYMENT COMPUTATION & DEDUCTIONS (हिसाब किताब)</span>
      </div>

      <div class="receipt-calc-box">
        <div class="calc-line">
          <span>Gross Wages Earned (कुल कमाई):</span>
          <span style="font-weight: 700; color: #0f172a;">${formatINR(receiptData.subtotalWage)}</span>
        </div>
        <div class="calc-line">
          <span>Advance Paid / Kharcha Deducted (अग्रिम खर्चा काटा):</span>
          <span style="font-weight: 700; color: #dc2626;">- ${formatINR(receiptData.advanceAmount)}</span>
        </div>
        <div class="calc-line">
          <span>Bonus / Allowance / Extra (बोनस / अतिरिक्त राशि):</span>
          <span style="font-weight: 700; color: #16a34a;">+ ${formatINR(receiptData.bonusAmount)}</span>
        </div>
        <div class="calc-line grand-total-line">
          <span style="font-size: 14px; font-weight: 800;">NET AMOUNT PAYABLE (कुल देय शुद्ध राशि):</span>
          <span class="grand-total-amount">${formatINR(receiptData.netPayable)}</span>
        </div>
        <div class="amount-in-words">
          <strong>In Words:</strong> ${receiptData.amountInWords}
        </div>
      </div>

      <!-- Signatures Footer -->
      <div class="receipt-signatures-grid">
        <div class="signature-box">
          <div class="sig-line"></div>
          <div class="sig-title">Contractor / Employer Signature</div>
          <div class="sig-sub">(हस्ताक्षर ठेकेदार / मुहर)</div>
        </div>
        <div class="signature-box">
          <div class="sig-line"></div>
          <div class="sig-title">Worker Signature / Thumb Impression</div>
          <div class="sig-sub">(मजदूर के हस्ताक्षर / अंगूठा निशान)</div>
        </div>
      </div>

      <div class="receipt-footer-note">
        This is a computer generated attendance & wage voucher created via <strong>Dhadi Wala Application</strong>.<br>
        Valid for records, project accounts, and daily labour settlements.
      </div>
    </div>
  `;
}

// Download PDF using html2canvas and jsPDF
export async function downloadReceiptPDF(receiptData, showToast) {
  const card = document.getElementById('printable-receipt-card');
  if (!card) {
    if (showToast) showToast('Receipt element not found', 'fa-triangle-exclamation');
    return;
  }

  if (showToast) showToast('Generating PDF Receipt...', 'fa-spinner fa-spin');

  try {
    // Clone or capture element with html2canvas
    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

    const safeWorkerName = (receiptData.workerName || 'Worker').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Dhadi_Receipt_${safeWorkerName}_${receiptData.monthNameEn}_${receiptData.year}.pdf`;

    pdf.save(filename);

    if (showToast) showToast(`Downloaded ${filename} successfully!`, 'fa-circle-check');
  } catch (err) {
    console.error('PDF Generation Error:', err);
    // Fallback: trigger print dialog which allows "Save as PDF"
    if (showToast) showToast('Opening system print/PDF dialog...', 'fa-print');
    triggerCleanPrint();
  }
}

// Trigger Clean Printing of only the Receipt
export function triggerCleanPrint() {
  const card = document.getElementById('printable-receipt-card');
  if (!card) {
    window.print();
    return;
  }

  // Create an isolated hidden iframe for printing to avoid printing app frames or status bars
  let printFrame = document.getElementById('receipt-print-iframe');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'receipt-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dhadi Wala Receipt</title>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        body { margin: 0; padding: 20px; font-family: 'Plus Jakarta Sans', Arial, sans-serif; background: #fff; color: #1e293b; }
        .printable-receipt-slip { border: 2px solid #0f172a; padding: 24px; border-radius: 12px; background: #fff; max-width: 750px; margin: 0 auto; box-sizing: border-box; }
        .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
        .receipt-brand-row { display: flex; align-items: center; gap: 10px; }
        .receipt-logo-icon { width: 38px; height: 38px; background: #ea580c; color: #fff; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .receipt-brand-name { font-size: 18px; font-weight: 800; color: #0f172a; }
        .receipt-brand-tag { font-size: 11px; color: #64748b; font-weight: 600; }
        .receipt-badge { display: inline-block; background: #ea580c; color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 4px; }
        .receipt-meta-row { font-size: 11px; color: #475569; margin-top: 2px; }
        .receipt-divider { height: 2px; background: #e2e8f0; margin: 12px 0 16px 0; }
        .receipt-parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px; }
        .receipt-party-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .party-role-tag { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; color: #ea580c; background: #ffedd5; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 6px; }
        .party-name { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
        .party-detail { font-size: 12px; color: #475569; margin-top: 3px; display: flex; align-items: center; gap: 6px; }
        .receipt-section-title { font-size: 11px; font-weight: 800; color: #475569; letter-spacing: 0.5px; margin-bottom: 8px; border-left: 3px solid #ea580c; padding-left: 6px; }
        .receipt-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
        .receipt-table th { background: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; font-size: 11px; }
        .receipt-table td { padding: 8px 10px; border: 1px solid #e2e8f0; color: #1e293b; }
        .receipt-table .sub-text { font-size: 10px; color: #64748b; }
        .receipt-summary-row td { background: #fff7ed; border-top: 2px solid #fed7aa; }
        .receipt-calc-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; }
        .calc-line { display: flex; justify-content: space-between; font-size: 12px; color: #475569; margin-bottom: 6px; }
        .grand-total-line { border-top: 2px dashed #cbd5e1; padding-top: 8px; margin-top: 8px; color: #0f172a; display: flex; justify-content: space-between; align-items: center; }
        .grand-total-amount { font-size: 18px; font-weight: 800; color: #ea580c; }
        .amount-in-words { font-size: 11px; color: #475569; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-style: italic; }
        .receipt-signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 36px; padding-top: 10px; }
        .signature-box { text-align: center; }
        .sig-line { border-bottom: 1px solid #334155; margin-bottom: 8px; height: 30px; }
        .sig-title { font-size: 12px; font-weight: 700; color: #1e293b; }
        .sig-sub { font-size: 10px; color: #64748b; }
        .receipt-footer-note { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 24px; padding-top: 10px; border-top: 1px solid #f1f5f9; line-height: 1.4; }
        @media print {
          body { padding: 0; }
          .printable-receipt-slip { border: 1px solid #333; }
        }
      </style>
    </head>
    <body>
      ${card.outerHTML}
    </body>
    </html>
  `);
  frameDoc.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow.focus();
      printFrame.contentWindow.print();
    } catch (e) {
      console.warn('Frame print error:', e);
      window.print();
    }
  }, 400);
}
