const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

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
const Notification = require('../models/Notification');

exports.globalSearch = async (req, res) => {
  try {
    const { q, type, cursor } = req.query;
    if (!q || q.length < 2) {
      return res.json({ success: true, data: { results: {} } });
    }

    const limit = parseInt(req.query.limit) || 5;
    const searchPattern = `%${q}%`;
    const isNumeric = !isNaN(q);
    const numericQ = isNumeric ? parseInt(q) : null;

    const results = {
      PEOPLE: [],
      PROPERTY: [],
      'LEASE & FINANCE': [],
      OPERATIONS: [],
      COMMUNICATION: [],
      DOCUMENTS: [],
    };

    let nextCursor = null;
    const pagination = getCursorPagination(cursor, limit);
    const userRole = req.user.role;

    // --- RBAC BASE CONDITIONS ---
    let rbac = { property: {}, unit: {}, lease: {}, tenant: {}, vendor: {}, maintenance: {}, invoice: {}, payment: {} };
    let allowedPropertyIds = [];
    let allowedUnitIds = [];
    let allowedLeaseIds = [];
    let allowedTenantIds = [];

    if (userRole === 'OWNER') {
      rbac.property.owner_id = req.user.id;
      const ownerProps = await Property.findAll({ where: rbac.property, attributes: ['id'] });
      allowedPropertyIds = ownerProps.map(p => p.id);
      
      rbac.unit.property_id = { [Op.in]: allowedPropertyIds };
      const ownerUnits = await Unit.findAll({ where: rbac.unit, attributes: ['id'] });
      allowedUnitIds = ownerUnits.map(u => u.id);

      rbac.lease.unit_id = { [Op.in]: allowedUnitIds };
      const ownerLeases = await Lease.findAll({ where: rbac.lease, attributes: ['id', 'tenant_id'] });
      allowedLeaseIds = ownerLeases.map(l => l.id);
      
      const ownerRequests = await MaintenanceRequest.findAll({ where: { unit_id: { [Op.in]: allowedUnitIds } }, attributes: ['tenant_id'] });
      const Booking = require('../models/Booking'); // ensure Booking is available
      const ownerBookings = await Booking.findAll({ where: { property_id: { [Op.in]: allowedPropertyIds } }, attributes: ['guest_id'] });

      allowedTenantIds = [...new Set([
        ...ownerLeases.map(l => l.tenant_id),
        ...ownerRequests.map(r => r.tenant_id),
        ...ownerBookings.map(b => b.guest_id)
      ].filter(Boolean))];

      rbac.tenant.id = { [Op.in]: allowedTenantIds };
      rbac.maintenance.unit_id = { [Op.in]: allowedUnitIds };
      
      const invs = await Invoice.findAll({ where: { lease_id: { [Op.in]: allowedLeaseIds } }, attributes: ['id'] });
      rbac.invoice.lease_id = { [Op.in]: allowedLeaseIds };
      rbac.payment.invoice_id = { [Op.in]: invs.map(i => i.id) };

    } else if (userRole === 'TENANT') {
      const leases = await Lease.findAll({ where: { tenant_id: req.user.id } });
      allowedUnitIds = leases.map(l => l.unit_id);
      allowedLeaseIds = leases.map(l => l.id);
      
      const units = await Unit.findAll({ where: { id: { [Op.in]: allowedUnitIds } } });
      allowedPropertyIds = units.map(u => u.property_id);

      rbac.property.id = { [Op.in]: allowedPropertyIds };
      rbac.unit.id = { [Op.in]: allowedUnitIds };
      rbac.lease.tenant_id = req.user.id;
      rbac.maintenance.tenant_id = req.user.id;
      rbac.invoice.lease_id = { [Op.in]: allowedLeaseIds };
      
      const invs = await Invoice.findAll({ where: { lease_id: { [Op.in]: allowedLeaseIds } }, attributes: ['id'] });
      rbac.payment.invoice_id = { [Op.in]: invs.map(i => i.id) };
      rbac.tenant.id = req.user.id; // Only see themselves
    } else if (userRole === 'VENDOR') {
      rbac.maintenance.assigned_vendor_id = req.user.id;
      // Vendors shouldn't globally search everything
    } else if (userRole === 'CARETAKER') {
      // Assuming caretakers see all operations but restricted finance
    } else {
      // ADMIN / MANAGER: No restrictions on base
    }

    const scope = type || 'all';
    const isSingleScope = scope !== 'all';

    // --- PHASE 1: IDENTIFY BASE ENTITIES ---
    let matchedPropertyIds = [];
    let matchedUnitIds = [];
    let matchedTenantIds = [];
    let matchedVendorIds = [];

    if (['ADMIN', 'MANAGER', 'OWNER', 'CARETAKER', 'TENANT'].includes(userRole)) {
      const p = await Property.findAll({ where: { ...rbac.property, [Op.or]: [{ name: { [Op.like]: searchPattern } }, { address: { [Op.like]: searchPattern } }] }, attributes: ['id'] });
      matchedPropertyIds = p.map(x => x.id);

      const u = await Unit.findAll({ where: { ...rbac.unit, [Op.or]: [{ unit_number: { [Op.like]: searchPattern } }, ...(matchedPropertyIds.length ? [{ property_id: { [Op.in]: matchedPropertyIds } }] : [])] }, attributes: ['id'] });
      matchedUnitIds = u.map(x => x.id);
      
      const t = await User.findAll({ where: { role: 'TENANT', ...rbac.tenant, [Op.or]: [{ username: { [Op.like]: searchPattern } }, { email: { [Op.like]: searchPattern } }, { phone: { [Op.like]: searchPattern } }, { first_name: { [Op.like]: searchPattern } }, { last_name: { [Op.like]: searchPattern } }, sequelize.where(sequelize.fn('concat', sequelize.fn('IFNULL', sequelize.col('first_name'), ''), ' ', sequelize.fn('IFNULL', sequelize.col('last_name'), '')), { [Op.like]: searchPattern }), sequelize.where(sequelize.fn('REPLACE', sequelize.fn('concat', sequelize.fn('IFNULL', sequelize.col('first_name'), ''), sequelize.fn('IFNULL', sequelize.col('last_name'), '')), ' ', ''), { [Op.like]: `%${q.replace(/\s+/g, '')}%` })] }, attributes: ['id'] });
      matchedTenantIds = t.map(x => x.id);
    }
    if (['ADMIN', 'MANAGER', 'CARETAKER'].includes(userRole)) {
      const v = await Vendor.findAll({ where: { [Op.or]: [{ name: { [Op.like]: searchPattern } }, { email: { [Op.like]: searchPattern } }, { phone: { [Op.like]: searchPattern } }] }, attributes: ['id'] });
      matchedVendorIds = v.map(x => x.id);
    }

    // --- PHASE 2: RELATIONSHIP SEARCH ---

    // 1. Properties
    if (['all', 'properties'].includes(scope) && ['ADMIN', 'MANAGER', 'OWNER', 'CARETAKER', 'TENANT'].includes(userRole)) {
      const propWhere = {
        ...rbac.property, ...(isSingleScope ? pagination.where : {}),
        [Op.or]: [
          { name: { [Op.like]: searchPattern } }, { address: { [Op.like]: searchPattern } }, { city: { [Op.like]: searchPattern } },
          ...(isNumeric ? [{ id: numericQ }] : [])
        ]
      };
      const data = await Property.findAll({ where: propWhere, limit: pagination.limit, order: pagination.order });
      if (isSingleScope) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
      results.PROPERTY.push(...data.map(p => ({
        id: p.id, type: 'PROPERTY', title: p.name, subtitle: `${p.city || ''} · ${p.property_type || ''}`, status: p.status, icon: 'apartment_rounded'
      })));
    }

    // 2. Units
    if (['all', 'units'].includes(scope) && ['ADMIN', 'MANAGER', 'OWNER', 'CARETAKER', 'TENANT'].includes(userRole)) {
      const unitWhere = {
        ...rbac.unit, ...(isSingleScope ? pagination.where : {}),
        [Op.or]: [
          { unit_number: { [Op.like]: searchPattern } },
          ...(matchedPropertyIds.length ? [{ property_id: { [Op.in]: matchedPropertyIds } }] : []),
          ...(isNumeric ? [{ id: numericQ }] : [])
        ]
      };
      const data = await Unit.findAll({ where: unitWhere, include: [{ model: Property, as: 'property', attributes: ['name'] }], limit: pagination.limit, order: pagination.order });
      if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
      results.PROPERTY.push(...data.map(u => ({
        id: u.id, type: 'UNIT', title: u.property ? `${u.property.name} · Unit ${u.unit_number}` : `Unit ${u.unit_number}`, subtitle: `Status: ${u.status || ''}`, status: u.status, icon: 'meeting_room_rounded'
      })));
    }

    // 3. People (Tenants)
    if (['all', 'people'].includes(scope) && ['ADMIN', 'MANAGER', 'OWNER', 'CARETAKER'].includes(userRole)) {
      const tenantWhere = {
        role: 'TENANT', ...rbac.tenant, ...(isSingleScope ? pagination.where : {}),
        [Op.or]: [
          { username: { [Op.like]: searchPattern } }, { email: { [Op.like]: searchPattern } }, { phone: { [Op.like]: searchPattern } },
          { first_name: { [Op.like]: searchPattern } }, { last_name: { [Op.like]: searchPattern } },
          sequelize.where(sequelize.fn('concat', sequelize.fn('IFNULL', sequelize.col('first_name'), ''), ' ', sequelize.fn('IFNULL', sequelize.col('last_name'), '')), { [Op.like]: searchPattern }),
          sequelize.where(sequelize.fn('REPLACE', sequelize.fn('concat', sequelize.fn('IFNULL', sequelize.col('first_name'), ''), sequelize.fn('IFNULL', sequelize.col('last_name'), '')), ' ', ''), { [Op.like]: `%${q.replace(/\s+/g, '')}%` }),
          ...(isNumeric ? [{ id: numericQ }] : [])
        ]
      };
      const data = await User.findAll({ where: tenantWhere, limit: pagination.limit, order: pagination.order });
      if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
      results.PEOPLE.push(...data.map(u => {
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ');
        return {
          id: u.id, type: 'TENANT', title: fullName || u.username || u.email, subtitle: `${u.email} ${u.phone ? '· ' + u.phone : ''}`, icon: 'person_rounded'
        };
      }));
    }

    // 4. Maintenance
    if (['all', 'maintenance'].includes(scope)) {
      const maintWhere = {
        ...rbac.maintenance, ...(isSingleScope ? pagination.where : {}),
        [Op.or]: [
          { title: { [Op.like]: searchPattern } },
          { priority: { [Op.like]: searchPattern } },
          ...(isNumeric ? [{ id: numericQ }] : []),
          ...(matchedPropertyIds.length ? [{ property_id: { [Op.in]: matchedPropertyIds } }] : []),
          ...(matchedUnitIds.length ? [{ unit_id: { [Op.in]: matchedUnitIds } }] : []),
          ...(matchedTenantIds.length ? [{ tenant_id: { [Op.in]: matchedTenantIds } }] : []),
          ...(matchedVendorIds.length ? [{ assigned_vendor_id: { [Op.in]: matchedVendorIds } }] : [])
        ]
      };
      const data = await MaintenanceRequest.findAll({
        where: maintWhere,
        include: [
          { model: Property, as: 'property', attributes: ['name'] },
          { model: Unit, as: 'unit', attributes: ['unit_number'] },
          { model: User, as: 'tenant', attributes: ['username'] }
        ],
        limit: pagination.limit, order: pagination.order
      });
      if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
      results.OPERATIONS.push(...data.map(m => ({
        id: m.id, type: 'MAINTENANCE', title: m.title, subtitle: `${m.property ? m.property.name : ''} ${m.unit ? '· Unit ' + m.unit.unit_number : ''}`, status: m.status, icon: 'build_rounded'
      })));
    }

    // 5. Vendors
    if (['all', 'vendors'].includes(scope) && ['ADMIN', 'MANAGER', 'OWNER', 'CARETAKER'].includes(userRole)) {
      const vendWhere = {
        ...rbac.vendor, ...(isSingleScope ? pagination.where : {}),
        [Op.or]: [
          { name: { [Op.like]: searchPattern } }, { email: { [Op.like]: searchPattern } }, { phone: { [Op.like]: searchPattern } },
          ...(isNumeric ? [{ id: numericQ }] : [])
        ]
      };
      const data = await Vendor.findAll({ where: vendWhere, limit: pagination.limit, order: pagination.order });
      if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
      results.PEOPLE.push(...data.map(v => ({
        id: v.id, type: 'VENDOR', title: v.name, subtitle: `${v.phone || v.email || ''}`, icon: 'handyman_rounded'
      })));
    }

    // 6. Leases & Finances
    if (['ADMIN', 'MANAGER', 'OWNER', 'TENANT'].includes(userRole)) {
      if (['all', 'leases'].includes(scope)) {
        const leaseWhere = {
          ...rbac.lease, ...(isSingleScope ? pagination.where : {}),
          [Op.or]: [
            ...(isNumeric ? [{ id: numericQ }] : []),
            ...(matchedUnitIds.length ? [{ unit_id: { [Op.in]: matchedUnitIds } }] : []),
            ...(matchedTenantIds.length ? [{ tenant_id: { [Op.in]: matchedTenantIds } }] : [])
          ]
        };
        const data = await Lease.findAll({ where: leaseWhere, include: [{ model: User, as: 'tenant', attributes: ['username'] }, { model: Unit, as: 'unit', attributes: ['unit_number'] }], limit: pagination.limit, order: pagination.order });
        if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
        results['LEASE & FINANCE'].push(...data.map(l => ({
          id: l.id, type: 'LEASE', title: `Lease #${l.id} ${l.unit ? '· Unit ' + l.unit.unit_number : ''}`, subtitle: `Tenant: ${l.tenant ? l.tenant.username : 'Unknown'}`, status: l.status, icon: 'description_rounded'
        })));
      }

      if (['all', 'invoices'].includes(scope)) {
        const invWhere = {
          ...rbac.invoice, ...(isSingleScope ? pagination.where : {}),
          [Op.or]: [
            { description: { [Op.like]: searchPattern } },
            ...(isNumeric ? [{ id: numericQ }] : []),
            ...(isNumeric ? [{ amount: numericQ }] : [])
          ]
        };
        const data = await Invoice.findAll({ where: invWhere, limit: pagination.limit, order: pagination.order });
        if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
        results['LEASE & FINANCE'].push(...data.map(i => ({
          id: i.id, type: 'INVOICE', title: `Invoice #${i.id}`, subtitle: `Amount: $${i.amount}`, status: i.status, icon: 'receipt_rounded'
        })));
      }

      if (['all', 'payments'].includes(scope)) {
        const pmtWhere = {
          ...rbac.payment, ...(isSingleScope ? pagination.where : {}),
          [Op.or]: [
            { transaction_reference: { [Op.like]: searchPattern } },
            ...(isNumeric ? [{ id: numericQ }] : []),
            ...(isNumeric ? [{ amount: numericQ }] : [])
          ]
        };
        const data = await Payment.findAll({ where: pmtWhere, limit: pagination.limit, order: pagination.order });
        if (isSingleScope && !nextCursor) nextCursor = getCursorPagingData(data, pagination.limit).meta.nextCursor;
        results['LEASE & FINANCE'].push(...data.map(p => ({
          id: p.id, type: 'PAYMENT', title: p.transaction_reference || `Payment #${p.id}`, subtitle: `Amount: $${p.amount}`, status: p.status, icon: 'payments_rounded'
        })));
      }
    }

    // Clean up empty results for faster transmission
    Object.keys(results).forEach(k => { if (results[k].length === 0) delete results[k]; });

    res.json({ 
      success: true, 
      message: "Search completed",
      data: { results },
      meta: { limit: pagination.limit, nextCursor }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

