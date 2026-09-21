const Invoice = require("../models/Invoice");

// POST /api/invoices
exports.createInvoice = async (req, res, next) => {
  try {
    const { lease_id, tenant_id, amount, due_date, description } = req.body;

    const invoice = await Invoice.create({
      lease_id,
      tenant_id,
      amount,
      due_date,
      description,
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

    const { count, rows: invoices } = await Invoice.findAndCountAll({
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