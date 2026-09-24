import type { DatasetSpecification, DomainType, ColumnDefinition, EdgeCaseConfig } from '../types';

export interface PrebuiltTemplate {
  title: string;
  domain: DomainType;
  prompt: string;
  tag: string;
  description: string;
}

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  {
    title: 'E-commerce Fraud & Weekend Peaks',
    domain: 'ecommerce',
    tag: 'Fraud Detection',
    prompt: 'Generate 10,000 e-commerce transactions with 2% fraud, 30% higher weekend sales, 1% extreme-value transactions and 2% missing customer information.',
    description: 'High-volume transaction ledger with deliberate fraud clusters, weekend cyclicality, and nullable billing metadata.'
  },
  {
    title: 'Banking Wire Transfers & AML Risk',
    domain: 'fintech',
    tag: 'AML Compliance',
    prompt: 'Generate 8,000 banking wire transfers with 1.5% AML flagged transactions, 25% international routing, 1.2% missing swift codes and 0.8% duplicate reference IDs.',
    description: 'Interbank settlement stream with AML tripwires, high-value transfer anomalies, and currency pair distributions.'
  },
  {
    title: 'IoT Industrial Sensor Telemetry',
    domain: 'iot',
    tag: 'Predictive Maintenance',
    prompt: 'Generate 12,000 IoT temperature and vibration sensor telemetry records with 2.5% machine anomaly drift, 1.8% sensor dropout (nulls), and 0.6% extreme thermal spikes.',
    description: 'High-frequency telemetry time-series with equipment thermal spikes, sensor dropout drop-offs, and vibration degradation.'
  },
  {
    title: 'SaaS Customer Subscription Churn',
    domain: 'saas_churn',
    tag: 'Retention Analytics',
    prompt: 'Generate 6,000 customer subscription churn events with 4.2% churn rate, 12% plan downgrades, 2.5% missing tenure metrics and 1.0% extreme usage anomalies.',
    description: 'B2B subscription lifecycle dataset with engagement drop-offs, ticket escalation spikes, and churn labels.'
  }
];

export function parseNaturalLanguageRequirement(prompt: string, seed: number = 582941): DatasetSpecification {
  const lower = prompt.toLowerCase();

  // 1. Detect Domain
  let domain: DomainType = 'ecommerce';
  if (lower.includes('bank') || lower.includes('wire') || lower.includes('aml') || lower.includes('transfer') || lower.includes('fintech')) {
    domain = 'fintech';
  } else if (lower.includes('sensor') || lower.includes('iot') || lower.includes('telemetry') || lower.includes('vibration') || lower.includes('temperature')) {
    domain = 'iot';
  } else if (lower.includes('churn') || lower.includes('subscription') || lower.includes('saas') || lower.includes('customer')) {
    domain = 'saas_churn';
  } else if (lower.includes('health') || lower.includes('patient') || lower.includes('clinical')) {
    domain = 'healthcare';
  }

  // 2. Detect Row Count
  let totalRows = 10000;
  const rowMatch = prompt.match(/(\d+[\d,]*)\s*(?:rows|records|transactions|events|transfers|samples|readings)/i)
    || prompt.match(/generate\s+(\d+[\d,]*)/i);
  if (rowMatch && rowMatch[1]) {
    const parsed = parseInt(rowMatch[1].replace(/,/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) {
      totalRows = Math.min(Math.max(parsed, 100), 50000); // capped reasonably for client generation
    }
  }

  // 3. Extract Edge Case Percentages
  const edgeCases: EdgeCaseConfig = {
    fraudRate: 2.0,
    weekendSalesIncrease: 30.0,
    extremeValuesRate: 1.0,
    missingValuesRate: 2.0,
    duplicateRate: 0.2,
    invalidDatesRate: 0.1,
    rareCategoriesRate: 0.5,
  };

  // Fraud / AML / Anomaly Rate
  const fraudMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:fraud|aml|anomaly|anomalies|churn)/i);
  if (fraudMatch) edgeCases.fraudRate = parseFloat(fraudMatch[1]);

  // Weekend Sales Increase
  const weekendMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:higher\s+)?weekend(?:\s+sales)?/i);
  if (weekendMatch) edgeCases.weekendSalesIncrease = parseFloat(weekendMatch[1]);

  // Extreme Values Rate
  const extremeMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:extreme(?:-value)?|outlier|spikes)/i);
  if (extremeMatch) edgeCases.extremeValuesRate = parseFloat(extremeMatch[1]);

  // Missing Values Rate
  const missingMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:missing|null|dropout)/i);
  if (missingMatch) edgeCases.missingValuesRate = parseFloat(missingMatch[1]);

  // Duplicates Rate
  const duplicateMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:duplicate|dups)/i);
  if (duplicateMatch) edgeCases.duplicateRate = parseFloat(duplicateMatch[1]);

  // Invalid Dates Rate
  const invalidDateMatch = prompt.match(/(\d+(?:\.\d+)?)\s*%\s*(?:invalid\s*date|corrupt\s*timestamp)/i);
  if (invalidDateMatch) edgeCases.invalidDatesRate = parseFloat(invalidDateMatch[1]);

  // 4. Build Schema based on Domain
  const schema = getDomainSchema(domain);

  // 5. Generate descriptive name
  const name = `${domain}_dataset_${totalRows >= 1000 ? `${Math.round(totalRows / 1000)}k` : totalRows}`;

  return {
    id: `spec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    name,
    domain,
    prompt,
    totalRows,
    seed,
    createdAt: new Date().toISOString(),
    schema,
    edgeCases
  };
}

function getDomainSchema(domain: DomainType): ColumnDefinition[] {
  switch (domain) {
    case 'ecommerce':
      return [
        { name: 'transaction_id', type: 'uuid', nullable: false, isIdentifier: true, description: 'Unique transaction identifier' },
        { name: 'customer_id', type: 'uuid', nullable: false, description: 'Customer account reference' },
        { name: 'timestamp', type: 'timestamp', nullable: false, description: 'ISO 8601 transaction timestamp' },
        { name: 'amount', type: 'decimal', nullable: false, min: 2.50, max: 2500.00, precision: 2, description: 'Gross transaction amount in USD' },
        { name: 'payment_method', type: 'categorical', nullable: false, enumOptions: ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'wire_transfer'], description: 'Payment processing gateway' },
        { name: 'product_category', type: 'categorical', nullable: false, enumOptions: ['electronics', 'apparel', 'home_goods', 'digital_software', 'luxury_jewelry'], description: 'Primary inventory category' },
        { name: 'device_type', type: 'categorical', nullable: false, enumOptions: ['desktop_chrome', 'desktop_safari', 'mobile_ios', 'mobile_android'], description: 'Client browser or device' },
        { name: 'billing_country', type: 'categorical', nullable: false, enumOptions: ['US', 'CA', 'GB', 'DE', 'FR', 'JP', 'AU'], description: 'Cardholder billing territory' },
        { name: 'customer_email', type: 'varchar', nullable: true, description: 'Customer contact email address' },
        { name: 'is_fraud', type: 'boolean', nullable: false, description: 'Binary fraud classifier ground truth' }
      ];

    case 'fintech':
      return [
        { name: 'transfer_id', type: 'uuid', nullable: false, isIdentifier: true, description: 'Settlement transaction reference' },
        { name: 'originating_account', type: 'varchar', nullable: false, description: 'Sender account number' },
        { name: 'beneficiary_account', type: 'varchar', nullable: false, description: 'Recipient account number' },
        { name: 'timestamp', type: 'timestamp', nullable: false, description: 'Settlement timestamp' },
        { name: 'amount', type: 'decimal', nullable: false, min: 50.00, max: 125000.00, precision: 2, description: 'Wire transfer value' },
        { name: 'currency', type: 'categorical', nullable: false, enumOptions: ['USD', 'EUR', 'GBP', 'CHF', 'JPY', 'SGD'], description: 'ISO currency code' },
        { name: 'transfer_rail', type: 'categorical', nullable: false, enumOptions: ['fedwire', 'swift_gpi', 'sepa_instant', 'chips'], description: 'Clearing mechanism' },
        { name: 'swift_bic', type: 'varchar', nullable: true, description: 'Beneficiary bank identifier code' },
        { name: 'origin_country', type: 'categorical', nullable: false, enumOptions: ['US', 'GB', 'DE', 'CH', 'SG', 'HK'], description: 'Originating banking jurisdiction' },
        { name: 'is_aml_flagged', type: 'boolean', nullable: false, description: 'Anti-Money Laundering tripwire flag' }
      ];

    case 'iot':
      return [
        { name: 'reading_id', type: 'uuid', nullable: false, isIdentifier: true, description: 'Unique telemetry sample UUID' },
        { name: 'device_id', type: 'varchar', nullable: false, description: 'Sensor asset tag identifier' },
        { name: 'timestamp', type: 'timestamp', nullable: false, description: 'UTC timestamp of sample' },
        { name: 'temperature_c', type: 'decimal', nullable: false, min: 18.0, max: 95.0, precision: 2, description: 'Chassis temperature in Celsius' },
        { name: 'vibration_hz', type: 'decimal', nullable: false, min: 12.0, max: 240.0, precision: 2, description: 'Harmonic vibration frequency' },
        { name: 'pressure_bar', type: 'decimal', nullable: false, min: 1.0, max: 8.5, precision: 2, description: 'Cooling line hydraulic pressure' },
        { name: 'battery_level_pct', type: 'integer', nullable: true, min: 5, max: 100, description: 'Internal cell charge status' },
        { name: 'firmware_version', type: 'categorical', nullable: false, enumOptions: ['v2.1.0', 'v2.2.4', 'v2.3.0-rc1'], description: 'Embedded firmware build' },
        { name: 'is_anomaly', type: 'boolean', nullable: false, description: 'Sensor mechanical deviation status' }
      ];

    case 'saas_churn':
      return [
        { name: 'event_id', type: 'uuid', nullable: false, isIdentifier: true, description: 'Lifecycle event UUID' },
        { name: 'account_id', type: 'uuid', nullable: false, description: 'Customer workspace reference' },
        { name: 'timestamp', type: 'timestamp', nullable: false, description: 'Observation snapshot timestamp' },
        { name: 'plan_tier', type: 'categorical', nullable: false, enumOptions: ['starter', 'growth', 'enterprise_scale', 'custom'], description: 'Active subscription tier' },
        { name: 'mrr_amount', type: 'decimal', nullable: false, min: 49.00, max: 4800.00, precision: 2, description: 'Monthly recurring revenue USD' },
        { name: 'tenure_months', type: 'integer', nullable: true, min: 1, max: 48, description: 'Account tenure length' },
        { name: 'weekly_active_users', type: 'integer', nullable: false, min: 1, max: 85, description: 'Active seats in trailing 7 days' },
        { name: 'support_tickets_30d', type: 'integer', nullable: false, min: 0, max: 14, description: 'Support escalation count' },
        { name: 'is_churned', type: 'boolean', nullable: false, description: 'Subscription termination outcome' }
      ];

    default:
      return [
        { name: 'record_id', type: 'uuid', nullable: false, isIdentifier: true },
        { name: 'timestamp', type: 'timestamp', nullable: false },
        { name: 'value', type: 'decimal', nullable: false, min: 0, max: 1000 },
        { name: 'category', type: 'categorical', nullable: false, enumOptions: ['A', 'B', 'C'] },
        { name: 'is_flagged', type: 'boolean', nullable: false }
      ];
  }
}
