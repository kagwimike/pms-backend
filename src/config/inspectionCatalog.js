/**
 * Move-In / Move-Out Inspection Standard Pricing Catalog
 * Contains market-calibrated replacement and repair costs (in KSh)
 * for standard fixtures and items across rental properties.
 */

const DEFAULT_ITEM_CATALOG = [
  // Walls & Finishes
  {
    category: 'Walls & Paints',
    item_key: 'wall_repaint_room',
    name: 'Wall Paint (Per Room Touchup / Repaint)',
    default_price: 3500.00,
    unit_label: 'room',
    description: 'Scraping, primer, and topcoat emulsion paint'
  },
  {
    category: 'Walls & Paints',
    item_key: 'wall_hole_patching',
    name: 'Wall Hole Patching / Plaster Repair',
    default_price: 800.00,
    unit_label: 'patch',
    description: 'Filler plastering, sanding and primer for nail or anchor holes'
  },
  {
    category: 'Walls & Paints',
    item_key: 'skirting_board',
    name: 'Skirting Board / Tile Baseboard',
    default_price: 1200.00,
    unit_label: 'piece',
    description: 'Replacing chipped or broken floor skirting'
  },

  // Windows & Glazing
  {
    category: 'Windows & Glazing',
    item_key: 'window_pane_standard',
    name: 'Window Glass Pane (Standard Clear/Frosted)',
    default_price: 1500.00,
    unit_label: 'pane',
    description: '4mm clear/obscured glass cutting, putty and installation'
  },
  {
    category: 'Windows & Glazing',
    item_key: 'window_pane_large',
    name: 'Window Glass Pane (Large / Sliding)',
    default_price: 3000.00,
    unit_label: 'pane',
    description: '5mm-6mm toughened/sliding glass replacement'
  },
  {
    category: 'Windows & Glazing',
    item_key: 'window_stay_handle',
    name: 'Window Stay / Latch / Handle',
    default_price: 650.00,
    unit_label: 'piece',
    description: 'Brass or aluminum window peg stay and fastener'
  },

  // Doors & Woodwork
  {
    category: 'In-Doors & Woodwork',
    item_key: 'internal_door_panel',
    name: 'Internal Flush Door Panel',
    default_price: 4500.00,
    unit_label: 'door',
    description: 'Hollow core flush timber door and hanging'
  },
  {
    category: 'In-Doors & Woodwork',
    item_key: 'door_lock_cylinder',
    name: 'Door Lockset / Mortise Cylinder & Keys',
    default_price: 2200.00,
    unit_label: 'lockset',
    description: 'Heavy duty mortise 2-lever or 3-lever lock with 3 keys'
  },
  {
    category: 'In-Doors & Woodwork',
    item_key: 'door_handle_hinge',
    name: 'Door Handle / Hinges / Stopper',
    default_price: 850.00,
    unit_label: 'set',
    description: 'Stainless steel handles, butt hinges, or magnetic stopper'
  },

  // Plumbing, Taps & Shower
  {
    category: 'Plumbing & Taps',
    item_key: 'sink_basin_tap',
    name: 'Sink / Washbasin Tap (Chrome Plated)',
    default_price: 1800.00,
    unit_label: 'tap',
    description: 'Quarter-turn ceramic disc pillar tap'
  },
  {
    category: 'Plumbing & Taps',
    item_key: 'kitchen_mixer_tap',
    name: 'Kitchen Sink Swivel Mixer Tap',
    default_price: 3200.00,
    unit_label: 'tap',
    description: 'Flexible neck or goose-neck sink mixer tap'
  },
  {
    category: 'Plumbing & Taps',
    item_key: 'shower_instant_head',
    name: 'Instant Shower Head (Lorenzetti / Equivalent)',
    default_price: 2800.00,
    unit_label: 'unit',
    description: 'Instant electric shower heater unit and arm'
  },
  {
    category: 'Plumbing & Taps',
    item_key: 'shower_mixer_rose',
    name: 'Shower Rose / Handheld Shower Head & Hose',
    default_price: 1500.00,
    unit_label: 'piece',
    description: 'Flexible chrome hose and multi-spray shower rose'
  },

  // Washroom & Toilet Fixtures
  {
    category: 'Washroom & Sanitary',
    item_key: 'toilet_seat_cover',
    name: 'Toilet Seat & Lid Cover',
    default_price: 1600.00,
    unit_label: 'seat',
    description: 'Heavy duty PVC or soft-close toilet seat with hinges'
  },
  {
    category: 'Washroom & Sanitary',
    item_key: 'cistern_flush_mechanism',
    name: 'Toilet Cistern Flush Valve & Syphon Mechanism',
    default_price: 2000.00,
    unit_label: 'kit',
    description: 'Dual flush cistern mechanism and push button'
  },
  {
    category: 'Washroom & Sanitary',
    item_key: 'toilet_bowl_ceramic',
    name: 'Ceramic Toilet Bowl / Wash Hand Basin',
    default_price: 6500.00,
    unit_label: 'unit',
    description: 'Vitreous china ceramic sanitary bowl replacement'
  },
  {
    category: 'Washroom & Sanitary',
    item_key: 'mirror_towel_rail',
    name: 'Bathroom Mirror / Towel Rail / Soap Dish',
    default_price: 1200.00,
    unit_label: 'piece',
    description: 'Beveled mirror or stainless steel towel rack'
  },

  // Electricals & Lighting
  {
    category: 'Electricals & Lighting',
    item_key: 'led_bulb_fitting',
    name: 'LED Bulb / Batten Light Fitting',
    default_price: 450.00,
    unit_label: 'bulb',
    description: 'Energy saving LED bulb or linear tube fitting'
  },
  {
    category: 'Electricals & Lighting',
    item_key: 'socket_switch_plate',
    name: 'Wall Socket / Light Switch Plate',
    default_price: 750.00,
    unit_label: 'plate',
    description: '13A twin socket or 2-gang light switch replacement'
  },

  // Deep Cleaning
  {
    category: 'Cleaning & Handover',
    item_key: 'full_unit_deep_clean',
    name: 'Unit Deep Cleaning / Sanitization',
    default_price: 3000.00,
    unit_label: 'service',
    description: 'Full scrubbing of floors, tiles, kitchen counters, and sanitization'
  }
];

// Standard Move-in/Move-out checklist sections
const STANDARD_CHECKLIST_SECTIONS = [
  {
    category: 'Walls & Paints',
    items: [
      { name: 'Living Room Walls & Paint', condition: 'GOOD', notes: '' },
      { name: 'Bedroom(s) Walls & Paint', condition: 'GOOD', notes: '' },
      { name: 'Kitchen Walls & Tiles', condition: 'GOOD', notes: '' },
      { name: 'Washroom Walls & Grouting', condition: 'GOOD', notes: '' },
      { name: 'Ceiling Condition & Water Stains', condition: 'GOOD', notes: '' }
    ]
  },
  {
    category: 'Windows & Glazing',
    items: [
      { name: 'Window Panes & Glass (All Rooms)', condition: 'GOOD', notes: '' },
      { name: 'Window Latches, Stays & Handles', condition: 'GOOD', notes: '' },
      { name: 'Curtain Rods / Brackets', condition: 'GOOD', notes: '' }
    ]
  },
  {
    category: 'In-Doors & Woodwork',
    items: [
      { name: 'Main Entrance Door & Mortise Lock', condition: 'GOOD', notes: '' },
      { name: 'Bedroom Doors & Locks', condition: 'GOOD', notes: '' },
      { name: 'Washroom Door & Latch', condition: 'GOOD', notes: '' },
      { name: 'Wardrobes & Cupboard Hinges/Handles', condition: 'GOOD', notes: '' },
      { name: 'Kitchen Cabinets & Drawers', condition: 'GOOD', notes: '' }
    ]
  },
  {
    category: 'Plumbing, Taps & Shower',
    items: [
      { name: 'Kitchen Sink & Swivel Tap', condition: 'GOOD', notes: '' },
      { name: 'Washroom Basin & Tap', condition: 'GOOD', notes: '' },
      { name: 'Shower Head / Instant Shower Heater', condition: 'GOOD', notes: '' },
      { name: 'Drainage & Waste Pipes (No Clogs/Leaks)', condition: 'GOOD', notes: '' }
    ]
  },
  {
    category: 'Washroom & Sanitary',
    items: [
      { name: 'Toilet Bowl & Ceramic Condition', condition: 'GOOD', notes: '' },
      { name: 'Toilet Seat & Lid Cover', condition: 'GOOD', notes: '' },
      { name: 'Cistern Flush Mechanism & Valve', condition: 'GOOD', notes: '' },
      { name: 'Bathroom Mirror & Accessories', condition: 'GOOD', notes: '' }
    ]
  },
  {
    category: 'Electricals & Lighting',
    items: [
      { name: 'All Light Bulbs & Holders Functional', condition: 'GOOD', notes: '' },
      { name: 'Wall Sockets & Switches Firm & Intact', condition: 'GOOD', notes: '' },
      { name: 'Main Circuit Breaker / Consumer Unit', condition: 'GOOD', notes: '' }
    ]
  },
  {
    category: 'Cleaning & General Key Handover',
    items: [
      { name: 'Cleanliness of Entire Unit', condition: 'GOOD', notes: '' },
      { name: 'Full Set of Keys Handed Over', condition: 'GOOD', notes: '' }
    ]
  }
];

module.exports = {
  DEFAULT_ITEM_CATALOG,
  STANDARD_CHECKLIST_SECTIONS
};
