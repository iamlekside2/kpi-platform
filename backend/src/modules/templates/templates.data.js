const templates = [
  {
    key: 'tech',
    name: 'Tech / Engineering',
    description: 'Track software delivery performance, code quality, and system reliability.',
    kpis: [
      { name: 'Sprint Velocity', unit: 'points', target: 40, category: 'Delivery', description: 'Story points completed per sprint' },
      { name: 'Deployment Frequency', unit: 'deploys/week', target: 5, category: 'Delivery', description: 'Number of production deployments per week' },
      { name: 'Bug Count', unit: 'bugs', target: 10, category: 'Quality', description: 'Open bug count in current sprint' },
      { name: 'Cycle Time', unit: 'days', target: 3, category: 'Delivery', description: 'Average time from start to deployment' },
      { name: 'Code Coverage', unit: '%', target: 80, category: 'Quality', description: 'Percentage of code covered by tests' },
      { name: 'Uptime', unit: '%', target: 99.9, category: 'Reliability', description: 'System availability percentage' },
    ],
  },
  {
    key: 'sales',
    name: 'Sales & Revenue',
    description: 'Monitor pipeline health, revenue growth, and customer acquisition.',
    kpis: [
      { name: 'Pipeline Value', unit: '$', target: 500000, category: 'Pipeline', description: 'Total value of active deals' },
      { name: 'Conversion Rate', unit: '%', target: 25, category: 'Performance', description: 'Percentage of leads converted to customers' },
      { name: 'Deals Closed', unit: 'deals', target: 20, category: 'Performance', description: 'Number of deals closed this period' },
      { name: 'Churn Rate', unit: '%', target: 5, category: 'Retention', description: 'Percentage of customers lost per period' },
      { name: 'Customer Acquisition Cost', unit: '$', target: 200, category: 'Efficiency', description: 'Average cost to acquire a new customer' },
      { name: 'Monthly Recurring Revenue', unit: '$', target: 100000, category: 'Revenue', description: 'Predictable monthly revenue' },
    ],
  },
  {
    key: 'hr',
    name: 'HR & People Ops',
    description: 'Track workforce health, hiring efficiency, and employee engagement.',
    kpis: [
      { name: 'Headcount', unit: 'people', target: 100, category: 'Workforce', description: 'Total number of employees' },
      { name: 'Attrition Rate', unit: '%', target: 10, category: 'Retention', description: 'Percentage of employees leaving per year' },
      { name: 'Time to Hire', unit: 'days', target: 30, category: 'Recruiting', description: 'Average days from job posting to offer acceptance' },
      { name: 'Engagement Score', unit: 'score', target: 8, category: 'Culture', description: 'Employee satisfaction score (1-10)' },
      { name: 'Absenteeism', unit: '%', target: 3, category: 'Workforce', description: 'Percentage of work days missed' },
    ],
  },
  {
    key: 'marketing',
    name: 'Marketing',
    description: 'Measure campaign effectiveness, lead generation, and ROI.',
    kpis: [
      { name: 'Leads Generated', unit: 'leads', target: 500, category: 'Lead Gen', description: 'Number of new leads per period' },
      { name: 'Customer Acquisition Cost', unit: '$', target: 150, category: 'Efficiency', description: 'Cost per acquired customer' },
      { name: 'Campaign ROI', unit: '%', target: 300, category: 'Performance', description: 'Return on investment for marketing campaigns' },
      { name: 'Website Traffic', unit: 'visits', target: 50000, category: 'Awareness', description: 'Monthly unique website visitors' },
      { name: 'Email Open Rate', unit: '%', target: 25, category: 'Engagement', description: 'Percentage of emails opened by recipients' },
    ],
  },
  {
    key: 'operations',
    name: 'Operations',
    description: 'Monitor operational efficiency, SLA compliance, and delivery performance.',
    kpis: [
      { name: 'SLA Compliance', unit: '%', target: 95, category: 'Service', description: 'Percentage of SLAs met' },
      { name: 'Cost Per Unit', unit: '$', target: 10, category: 'Efficiency', description: 'Average cost to produce/deliver one unit' },
      { name: 'Efficiency Rate', unit: '%', target: 85, category: 'Performance', description: 'Output vs capacity ratio' },
      { name: 'On-Time Delivery', unit: '%', target: 95, category: 'Delivery', description: 'Percentage of deliveries made on time' },
    ],
  },
  {
    key: 'custom',
    name: 'Custom',
    description: 'Start from scratch — define your own KPIs.',
    kpis: [],
  },
];

module.exports = templates;
