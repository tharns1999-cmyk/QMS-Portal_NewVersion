const express = require('express');
const { Pool } = require('pg');
const CcNumberService = require('./services/CcNumberService');
const PdfService = require('./services/PdfService');
const ReplacementService = require('./services/ReplacementService');
const AutoEffectiveJob = require('./jobs/AutoEffectiveJob');
const RecallEscalationJob = require('./jobs/RecallEscalationJob');

const app = express();
app.use(express.json());

// ==========================================
// Mock Security Middleware
// ==========================================
const requireDccAdmin = (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  // For testing purposes, if no header is provided, we might allow it or strictly deny it.
  // The plan said to use a dummy header 'x-user-role' to simulate identity.
  if (userRole === 'DCC_ADMIN' || userRole === 'SUPER_ADMIN') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Requires DCC Admin privileges.' });
  }
};


// In a real app, this pool would be configured via env vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/qms_portal'
});

const ccNumberService = new CcNumberService(pool);
const pdfService = new PdfService(pool);
const replacementService = new ReplacementService(pool, pdfService);

// Initialize Background Jobs
const autoEffectiveJob = new AutoEffectiveJob(pool);
const recallEscalationJob = new RecallEscalationJob(pool);

// ==========================================
// Scheduled Jobs
// ==========================================
// Run every minute for testing purposes, normally '0 0 * * *'
autoEffectiveJob.start('* * * * *');
recallEscalationJob.start('* * * * *');

// ==========================================
// Export APIs
// ==========================================

app.get('/api/reports/controlled-copies', requireDccAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        dd.document_id,
        dd.department_id,
        dd.custodian_name,
        ccs.cc_number,
        cci.issue_number,
        cci.status,
        cci.created_at
      FROM controlled_copy_instances cci
      JOIN controlled_copy_slots ccs ON cci.slot_id = ccs.id
      JOIN document_distributions dd ON ccs.distribution_id = dd.id
      ORDER BY dd.document_id, ccs.cc_number, cci.issue_number;
    `;
    const result = await pool.query(query);
    
    // Generate simple CSV
    let csv = 'Document ID,Department,Custodian,CC Number,Issue Number,Status,Created At\n';
    result.rows.forEach(row => {
      csv += `${row.document_id},${row.department_id},${row.custodian_name || ''},${row.cc_number},${row.issue_number},${row.status},${row.created_at}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('controlled_copies.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Export CC error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reports/recalls', requireDccAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        rc.superseded_doc_id,
        rc.new_doc_id,
        cci.id AS instance_id,
        ccs.cc_number,
        dd.department_id,
        dd.custodian_name,
        cr.status,
        cr.recalled_at
      FROM controlled_copy_recalls cr
      JOIN recall_campaigns rc ON cr.campaign_id = rc.id
      JOIN controlled_copy_instances cci ON cr.instance_id = cci.id
      JOIN controlled_copy_slots ccs ON cci.slot_id = ccs.id
      JOIN document_distributions dd ON ccs.distribution_id = dd.id
      WHERE cr.status = 'PENDING_RETURN'
      ORDER BY cr.recalled_at DESC;
    `;
    const result = await pool.query(query);
    
    let csv = 'Superseded Doc ID,New Doc ID,CC Number,Department,Custodian,Status,Recalled At\n';
    result.rows.forEach(row => {
      csv += `${row.superseded_doc_id},${row.new_doc_id},${row.cc_number},${row.department_id},${row.custodian_name || ''},${row.status},${row.recalled_at}\n`;
    });

    res.header('Content-Type', 'text/csv');
    res.attachment('recalls.csv');
    return res.send(csv);
  } catch (error) {
    console.error('Export Recalls error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================

app.get('/api/documents/:id/cc-numbers/preview', async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId, quantity } = req.query;
    
    if (!departmentId || !quantity) {
      return res.status(400).json({ error: 'Missing departmentId or quantity' });
    }
    
    const qty = parseInt(quantity, 10);
    const previews = await ccNumberService.previewCcNumbers(id, departmentId, qty);
    
    res.json({ previews });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents/:id/cc-numbers/allocate', requireDccAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { departmentId, copyType, quantity } = req.body;
    
    if (!departmentId || !copyType || !quantity) {
      return res.status(400).json({ error: 'Missing departmentId, copyType, or quantity' });
    }
    
    const qty = parseInt(quantity, 10);
    const allocated = await ccNumberService.allocateCcNumbers(id, departmentId, copyType, qty);
    
    res.status(201).json({ allocated });
  } catch (error) {
    console.error('Allocate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PDF Stamping Endpoints
app.post('/api/documents/:id/print-uncontrolled', async (req, res) => {
  try {
    const { id } = req.params;
    const pdfBuffer = await pdfService.printUncontrolled(id);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document_${id}_uncontrolled.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Print uncontrolled error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents/:id/issue-cc', async (req, res) => {
  try {
    const { id } = req.params;
    const { slotId, ccNumber, department } = req.body;
    
    if (!slotId || !ccNumber || !department) {
      return res.status(400).json({ error: 'Missing slotId, ccNumber, or department' });
    }
    
    const result = await pdfService.issueControlledCopy(id, slotId, ccNumber, department);
    
    // In a real scenario you might want to return JSON with the instanceId and a URL to download the PDF, 
    // or just return the PDF directly. We'll return the PDF for simplicity.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${ccNumber}_${department}.pdf"`);
    res.send(result.stampedBuffer);
  } catch (error) {
    console.error('Issue CC error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/documents/:documentId/cc-instances/:instanceId/replace', requireDccAdmin, async (req, res) => {
  try {
    const { documentId, instanceId } = req.params;
    const { reasonType, reasonText } = req.body; // 'DAMAGED' or 'LOST'

    if (!['DAMAGED', 'LOST'].includes(reasonType)) {
      return res.status(400).json({ error: 'Invalid reasonType. Must be DAMAGED or LOST.' });
    }

    const result = await replacementService.replaceInstance(documentId, instanceId, reasonType, reasonText || '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.ccNumber}_${result.department}_Replacement.pdf"`);
    res.send(result.stampedBuffer);
  } catch (error) {
    console.error('Replace instance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// For testing purposes, we export the app and pool
module.exports = { app, pool };
