const { Op } = require('sequelize');
const Property = require('../models/Property');
const Unit = require('../models/Unit');
const Lease = require('../models/Lease');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const Document = require('../models/Document');
const Vendor = require('../models/Vendor');
const Inspection = require('../models/Inspection');

exports.globalSearch = async (req, res) => {
  try {
    const { q, scope, limit: queryLimit, offset: queryOffset } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const limit = parseInt(queryLimit) || 5;
    const offset = parseInt(queryOffset) || 0;

    const searchPattern = `%${q}%`;
    const results = [];

    // Base conditions based on RBAC
    let propertyQuery = {};
    let unitQuery = {};
    let leaseQuery = {};
    let propertyIds = [];
    let unitIds = [];
    let leaseIds = [];
    
    if (req.user.role === 'OWNER') {
      propertyQuery.owner_id = req.user.id;
      const ownerProperties = await Property.findAll({ where: { owner_id: req.user.id }, attributes: ['id'] });
      propertyIds = ownerProperties.map(p => p.id);
      
      unitQuery.property_id = { [Op.in]: propertyIds };
      const ownerUnits = await Unit.findAll({ where: { property_id: { [Op.in]: propertyIds } }, attributes: ['id'] });
      unitIds = ownerUnits.map(u => u.id);
      
      leaseQuery.unit_id = { [Op.in]: unitIds };
      const ownerLeases = await Lease.findAll({ where: { unit_id: { [Op.in]: unitIds } }, attributes: ['id'] });
      leaseIds = ownerLeases.map(l => l.id);
    } else if (req.user.role === 'TENANT') {
      const leases = await Lease.findAll({ where: { tenant_id: req.user.id } });
      unitIds = leases.map(l => l.unit_id);
      leaseIds = leases.map(l => l.id);
      
      const units = await Unit.findAll({ where: { id: { [Op.in]: unitIds } }});
      propertyIds = units.map(u => u.property_id);
      
      propertyQuery.id = { [Op.in]: propertyIds };
      unitQuery.id = { [Op.in]: unitIds };
      leaseQuery.tenant_id = req.user.id;
    }

    // 1. Search Properties
    if (!scope || scope === 'properties' || scope === 'all') {
      const properties = await Property.findAll({
        where: {
          ...propertyQuery,
          [Op.or]: [
            { name: { [Op.like]: searchPattern } },
            { address: { [Op.like]: searchPattern } },
            { city: { [Op.like]: searchPattern } },
            { country: { [Op.like]: searchPattern } },
            { property_type: { [Op.like]: searchPattern } },
            { status: { [Op.like]: searchPattern } }
          ]
        },
        limit, offset
      });
      properties.forEach(p => {
        results.push({
          type: 'PROPERTY',
          id: p.id,
          title: p.name,
          subtitle: `${p.city || ''} · ${p.property_type || ''} · ${p.status || ''}`,
          icon: 'apartment_rounded',
          payload: p.toJSON()
        });
      });
    }

    // 2. Search Units
    if (!scope || scope === 'units' || scope === 'all') {
      const units = await Unit.findAll({
        where: {
          ...unitQuery,
          [Op.or]: [
            { unit_number: { [Op.like]: searchPattern } },
            { status: { [Op.like]: searchPattern } },
            { '$property.name$': { [Op.like]: searchPattern } }
          ]
        },
        include: [
          { model: Property, as: 'property', attributes: ['name'], required: false }
        ],
        limit, offset
      });
      units.forEach(u => {
        results.push({
          type: 'UNIT',
          id: u.id,
          title: u.property ? `${u.property.name} · Unit ${u.unit_number}` : `Unit ${u.unit_number}`,
          subtitle: `Status: ${u.status || ''} · Rent: ${u.rent_amount || ''}`,
          icon: 'meeting_room_rounded',
          payload: u.toJSON()
        });
      });
    }

    // 3. Search Leases
    if (!scope || scope === 'leases' || scope === 'all') {
      const leases = await Lease.findAll({
        where: {
          ...leaseQuery,
          [Op.or]: [
            { status: { [Op.like]: searchPattern } },
            { '$tenant.username$': { [Op.like]: searchPattern } },
            { '$tenant.email$': { [Op.like]: searchPattern } },
            { '$unit.unit_number$': { [Op.like]: searchPattern } }
          ]
        },
        include: [
          { model: User, as: 'tenant', attributes: ['username', 'email'], required: false },
          { model: Unit, as: 'unit', attributes: ['unit_number'], required: false }
        ],
        limit, offset
      });
      leases.forEach(l => {
        results.push({
          type: 'LEASE',
          id: l.id,
          title: `Lease #${l.id} ${l.unit ? '· Unit ' + l.unit.unit_number : ''}`,
          subtitle: `Tenant: ${l.tenant ? l.tenant.username : 'Unknown'} · Status: ${l.status || ''}`,
          icon: 'description_rounded',
          payload: l.toJSON()
        });
      });
    }

    // 4. Search Tenants (Users)
    if (!scope || scope === 'tenants' || scope === 'all') {
      if (req.user.role === 'OWNER') {
        const leases = await Lease.findAll({ where: leaseQuery, attributes: ['tenant_id'] });
        const tenantIds = leases.map(l => l.tenant_id);
        const users = await User.findAll({
          where: {
            id: { [Op.in]: tenantIds },
            role: 'TENANT',
            [Op.or]: [
              { username: { [Op.like]: searchPattern } },
              { email: { [Op.like]: searchPattern } },
              { phone: { [Op.like]: searchPattern } }
            ]
          },
          limit, offset
        });
        users.forEach(u => {
          results.push({
            type: 'TENANT',
            id: u.id,
            title: u.username || u.email,
            subtitle: `${u.email} ${u.phone ? '· ' + u.phone : ''}`,
            icon: 'person_rounded',
            payload: u.toJSON()
          });
        });
      }
    }

    // 5. Search Invoices
    if (!scope || scope === 'invoices' || scope === 'all') {
      const invoices = await Invoice.findAll({
        where: {
          lease_id: { [Op.in]: leaseIds },
          [Op.or]: [
            { description: { [Op.like]: searchPattern } },
            { status: { [Op.like]: searchPattern } },
            { amount: { [Op.like]: searchPattern } },
            { '$tenant.username$': { [Op.like]: searchPattern } }
          ]
        },
        include: [
          { model: User, as: 'tenant', attributes: ['username'], required: false }
        ],
        limit, offset
      });
      invoices.forEach(i => {
        results.push({
          type: 'INVOICE',
          id: i.id,
          title: i.invoice_number || `Invoice #${i.id}`,
          subtitle: `Amount: $${i.amount} · Status: ${i.status} ${i.tenant ? '· ' + i.tenant.username : ''}`,
          icon: 'receipt_rounded',
          payload: i.toJSON()
        });
      });
    }

    // 6. Search Payments
    if (!scope || scope === 'payments' || scope === 'all') {
      const invoiceIds = (await Invoice.findAll({ where: { lease_id: { [Op.in]: leaseIds } }, attributes: ['id'] })).map(i => i.id);
      const payments = await Payment.findAll({
        where: {
          invoice_id: { [Op.in]: invoiceIds },
          [Op.or]: [
            { transaction_reference: { [Op.like]: searchPattern } },
            { status: { [Op.like]: searchPattern } },
            { payment_method: { [Op.like]: searchPattern } },
            { amount: { [Op.like]: searchPattern } },
            { '$tenant.username$': { [Op.like]: searchPattern } }
          ]
        },
        include: [
          { model: User, as: 'tenant', attributes: ['username'], required: false }
        ],
        limit, offset
      });
      payments.forEach(p => {
        results.push({
          type: 'PAYMENT',
          id: p.id,
          title: p.transaction_reference || `Payment #${p.id}`,
          subtitle: `Amount: $${p.amount} · Method: ${p.payment_method || ''} · Status: ${p.status}`,
          icon: 'payments_rounded',
          payload: p.toJSON()
        });
      });
    }

    // 7. Search Maintenance
    if (!scope || scope === 'maintenance' || scope === 'all') {
      const maintenance = await MaintenanceRequest.findAll({
        where: {
          unit_id: { [Op.in]: unitIds },
          [Op.or]: [
            { title: { [Op.like]: searchPattern } },
            { description: { [Op.like]: searchPattern } },
            { priority: { [Op.like]: searchPattern } },
            { status: { [Op.like]: searchPattern } },
            { '$property.name$': { [Op.like]: searchPattern } },
            { '$unit.unit_number$': { [Op.like]: searchPattern } },
            { '$tenant.username$': { [Op.like]: searchPattern } }
          ]
        },
        include: [
          { model: Property, as: 'property', attributes: ['name'], required: false },
          { model: Unit, as: 'unit', attributes: ['unit_number'], required: false },
          { model: User, as: 'tenant', attributes: ['username'], required: false }
        ],
        limit, offset
      });
      maintenance.forEach(m => {
        results.push({
          type: 'MAINTENANCE',
          id: m.id,
          title: m.title,
          subtitle: `${m.property ? m.property.name : ''} ${m.unit ? '· Unit ' + m.unit.unit_number : ''} · Priority: ${m.priority} · Status: ${m.status}`,
          icon: 'build_rounded',
          payload: m.toJSON()
        });
      });
    }

    // 8. Search Vendors
    if ((!scope || scope === 'vendors' || scope === 'all') && req.user.role === 'OWNER') {
      const vendors = await Vendor.findAll({
        where: {
          [Op.or]: [
            { name: { [Op.like]: searchPattern } },
            { email: { [Op.like]: searchPattern } },
            { phone: { [Op.like]: searchPattern } }
          ]
        },
        limit, offset
      });
      vendors.forEach(v => {
        results.push({
          type: 'VENDOR',
          id: v.id,
          title: v.name,
          subtitle: `${v.phone || v.email || ''}`,
          icon: 'handyman_rounded',
          payload: v.toJSON()
        });
      });
    }

    // 9. Search Documents
    if (!scope || scope === 'documents' || scope === 'all') {
      const documents = await Document.findAll({
        where: {
          [Op.or]: [
            { property_id: { [Op.in]: propertyIds } },
            { lease_id: { [Op.in]: leaseIds } }
          ],
          [Op.or]: [
            { title: { [Op.like]: searchPattern } },
            { file_type: { [Op.like]: searchPattern } },
            { description: { [Op.like]: searchPattern } }
          ]
        },
        limit, offset
      });
      documents.forEach(d => {
        results.push({
          type: 'DOCUMENT',
          id: d.id,
          title: d.title,
          subtitle: `Type: ${d.file_type || 'Unknown'}`,
          icon: 'description_rounded',
          payload: d.toJSON()
        });
      });
    }

    // 10. Search Inspections
    if (!scope || scope === 'inspections' || scope === 'all') {
      const inspections = await Inspection.findAll({
        where: {
          lease_id: { [Op.in]: leaseIds },
          [Op.or]: [
            { inspection_type: { [Op.like]: searchPattern } },
            { status: { [Op.like]: searchPattern } },
            { notes: { [Op.like]: searchPattern } },
            { '$lease.unit.unit_number$': { [Op.like]: searchPattern } },
            { '$lease.tenant.username$': { [Op.like]: searchPattern } }
          ]
        },
        include: [
          { 
            model: Lease, 
            as: 'lease', 
            attributes: ['id'], 
            required: false,
            include: [
              { model: Unit, as: 'unit', attributes: ['unit_number'], required: false },
              { model: User, as: 'tenant', attributes: ['username'], required: false }
            ]
          }
        ],
        limit, offset
      });
      inspections.forEach(i => {
        const unitNum = i.lease && i.lease.unit ? i.lease.unit.unit_number : '';
        const tenantName = i.lease && i.lease.tenant ? i.lease.tenant.username : '';
        results.push({
          type: 'INSPECTION',
          id: i.id,
          title: `${i.inspection_type} Inspection`,
          subtitle: `${unitNum ? 'Unit ' + unitNum : ''} ${tenantName ? '· ' + tenantName : ''} · Status: ${i.status}`,
          icon: 'fact_check_rounded',
          payload: i.toJSON()
        });
      });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
