const Maintenance = require('../models/MaintenanceRequest');
const User = require('../models/User');
// const Property = require('../models/Property'); // Import when needed
const { Op } = require('sequelize');
const ApiError = require('../utils/ApiError');

exports.getCaretakerDashboard = async (req, res, next) => {
  try {
    const caretakerId = req.user.id;

    // TODO: Scope by assigned properties. For now, fetch overall stats.
    // Caretakers care about Maintenance (urgent, open) and basic KPIs.

    const [
      openMaintenance,
      urgentMaintenance,
      inProgressMaintenance,
      completedTodayMaintenance,
      priorities
    ] = await Promise.all([
      Maintenance.count({ where: { status: 'PENDING' } }),
      Maintenance.count({ where: { priority: 'URGENT', status: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } }),
      Maintenance.count({ where: { status: 'IN_PROGRESS' } }),
      Maintenance.count({ 
        where: { 
          status: 'COMPLETED',
          updated_at: {
            [Op.gte]: new Date(new Date().setHours(0,0,0,0))
          }
        } 
      }),
      Maintenance.findAll({
        where: {
          status: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'],
        },
        order: [
          // Order by urgency (custom case depending on MySQL)
          // For simplicity, just sort by updated_at DESC
          ['updated_at', 'DESC']
        ],
        limit: 5,
        include: [
          { model: require('../models/Property'), as: 'property', attributes: ['id', 'name'] },
          { model: require('../models/Unit'), as: 'unit', attributes: ['id', 'unit_number'] },
        ]
      })
    ]);

    const activeVendors = await User.count({ where: { role: 'VENDOR' } });

    res.json({
      success: true,
      message: 'Caretaker dashboard retrieved successfully',
      data: {
        maintenance: {
          open: openMaintenance,
          urgent: urgentMaintenance,
          inProgress: inProgressMaintenance,
          completedToday: completedTodayMaintenance,
        },
        vendors: {
          active: activeVendors,
        },
        priorities: priorities
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getVendorDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const vendor = await require('../models/Vendor').findOne({ where: { user_id: userId } });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor profile not found' });
    }

    const [
      assignedJobs,
      inProgressJobs,
      completedJobs
    ] = await Promise.all([
      Maintenance.count({ where: { status: 'ASSIGNED', assigned_vendor_id: vendor.id } }),
      Maintenance.count({ where: { status: 'IN_PROGRESS', assigned_vendor_id: vendor.id } }),
      Maintenance.count({ where: { status: 'COMPLETED', assigned_vendor_id: vendor.id } })
    ]);

    res.json({
      success: true,
      message: 'Vendor dashboard retrieved successfully',
      data: {
        jobs: {
          assigned: assignedJobs,
          inProgress: inProgressJobs,
          completed: completedJobs,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCaretakerReports = async (req, res, next) => {
  try {
    const Incident = require('../models/Incident');
    const Vendor = require('../models/Vendor');
    
    // 48 hours ago
    const overdueDate = new Date();
    overdueDate.setHours(overdueDate.getHours() - 48);

    const [
      openIncidents,
      resolvedIncidents,
      overdueIncidents,
      overdueMaintenance,
      vendorStats
    ] = await Promise.all([
      Incident.count({ where: { status: ['OPEN', 'IN_PROGRESS'] } }),
      Incident.count({ where: { status: 'RESOLVED' } }),
      Incident.count({ 
        where: { 
          status: ['OPEN', 'IN_PROGRESS'],
          createdAt: { [Op.lt]: overdueDate } 
        } 
      }),
      Maintenance.count({ 
        where: { 
          status: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'],
          created_at: { [Op.lt]: overdueDate } 
        } 
      }),
      Vendor.findAll({
        attributes: ['id', 'name'],
        include: [{
          model: Maintenance,
          as: 'assigned_requests',
          attributes: ['id', 'status'],
          required: false
        }]
      })
    ]);

    // Format Vendor Stats
    const formattedVendorStats = vendorStats.map(v => {
      const jobs = v.assigned_requests || [];
      const completed = jobs.filter(j => j.status === 'COMPLETED').length;
      const active = jobs.filter(j => ['ASSIGNED', 'IN_PROGRESS'].includes(j.status)).length;
      return {
        id: v.id,
        name: v.name,
        completed_jobs: completed,
        active_jobs: active
      };
    });

    res.json({
      success: true,
      message: 'Caretaker reports retrieved successfully',
      data: {
        incidents: {
          open: openIncidents,
          resolved: resolvedIncidents,
          overdue: overdueIncidents,
        },
        maintenance: {
          overdue: overdueMaintenance,
        },
        vendors: formattedVendorStats
      }
    });
  } catch (error) {
    next(error);
  }
};
