const Invoice = require("../models/Invoice");
const Lease = require("../models/Lease");

const INVOICE_TYPES = ["RENT", "UTILITY", "DEPOSIT", "LATE_FEE", "MAINTENANCE"];

// POST /api/invoices
exports.createInvoice = async (req, res, next) => {
  try {
    const { lease_id, amount, due_date, description } = req.body;
    let { tenant_id } = req.body;
    const rawType = String(req.body.invoice_type || req.body.type || "RENT").toUpperCase();
    const invoice_type = INVOICE_TYPES.includes(rawType) ? rawType : "RENT";

    // Invoices belong to the lease's tenant when not supplied explicitly.
    if (!tenant_id && lease_id) {
      const lease = await Lease.findByPk(lease_id);
      if (!lease) {
        return res.status(400).json({ success: false, message: "Lease not found" });
      }
      tenant_id = lease.tenant_id;
    }

    const invoice = await Invoice.create({
      lease_id,
      tenant_id,
      amount,
      due_date,
      description,
      invoice_type,
      status: "PENDING",
    });

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices
exports.getInvoices = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const page = parseInt(req.query.page, 10) || 1;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status) {
      where.status = req.query.status === "UNPAID" ? "PENDING" : req.query.status;
    }
    if (req.user && req.user.role === "TENANT") {
      where.tenant_id = req.user.id;
    }

    const { count, rows: invoices } = await Invoice.findAndCountAll({
      where,
      include: ["lease"],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Invoices retrieved successfully",
      data: invoices,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/invoices/:id
exports.getInvoiceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Invoice retrieved successfully",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/invoices/:id
exports.updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, due_date, status, description, tenant_id, lease_id } = req.body;

    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    await invoice.update({
      amount: amount !== undefined ? amount : invoice.amount,
      due_date: due_date !== undefined ? due_date : invoice.due_date,
      status: status !== undefined ? status : invoice.status,
      description: description !== undefined ? description : invoice.description,
      tenant_id: tenant_id !== undefined ? tenant_id : invoice.tenant_id,
      lease_id: lease_id !== undefined ? lease_id : invoice.lease_id,
    });

    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/invoices/:id
exports.deleteInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findByPk(id);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    await invoice.destroy();

    return res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};