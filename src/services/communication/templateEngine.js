/**
 * Replaces {{variables}} in a template string with actual data.
 * Validates against missing variables to prevent broken messages.
 */

class TemplateEngine {
  /**
   * Render a template string with data variables.
   * @param {string} template e.g., "Hello {{tenant_name}}, your rent is {{amount}}"
   * @param {Object} variables e.g., { tenant_name: 'John', amount: 'KES 45,000' }
   * @returns {string} The rendered string
   */
  static render(template, variables) {
    if (!template) return '';

    return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, variableName) => {
      if (variables[variableName] !== undefined && variables[variableName] !== null) {
        return variables[variableName];
      }
      
      // If a required variable is missing, throw an error to prevent sending a broken message
      throw new Error(`Template validation failed: Missing variable '{{${variableName}}}'`);
    });
  }

  /**
   * Helper to build common PMS variables from fetched models
   * @param {Object} data Raw entity data
   * @returns {Object} Flattened variables map
   */
  static buildVariables(data) {
    const vars = {};

    if (data.recipient) {
      vars.tenant_name = data.recipient.username || data.recipient.first_name || 'Tenant';
      vars.recipient_email = data.recipient.email;
      vars.recipient_phone = data.recipient.phone;
    }

    if (data.property) {
      vars.property_name = data.property.name;
    }

    if (data.unit) {
      vars.unit_number = data.unit.unit_number;
    }

    if (data.invoice) {
      vars.invoice_number = data.invoice.id; // Using ID as number unless changed
      vars.amount = data.invoice.amount;
      vars.due_date = data.invoice.due_date;
    }

    if (data.payment) {
      vars.payment_reference = data.payment.transaction_reference;
      vars.payment_amount = data.payment.amount;
    }

    if (data.maintenance) {
      vars.maintenance_id = data.maintenance.id;
      vars.maintenance_title = data.maintenance.title;
      vars.maintenance_status = data.maintenance.status;
    }

    // Merge any ad-hoc payload data passed directly into the event bus
    if (data.customVars) {
      Object.assign(vars, data.customVars);
    }

    return vars;
  }
}

module.exports = TemplateEngine;
