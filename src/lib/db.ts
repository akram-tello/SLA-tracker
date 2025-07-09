import mysql from 'mysql2/promise';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

const masterDbConfig: DatabaseConfig = {
  host: process.env.MASTER_DB_HOST || 'localhost',
  port: parseInt(process.env.MASTER_DB_PORT || '3306'),
  user: process.env.MASTER_DB_USER || '',
  password: process.env.MASTER_DB_PASSWORD || '',
  database: process.env.MASTER_DB_NAME || 'ecom_orders_live',
};

const analyticsDbConfig: DatabaseConfig = {
  host: process.env.ANALYTICS_DB_HOST || 'localhost',
  port: parseInt(process.env.ANALYTICS_DB_PORT || '3306'),
  user: process.env.ANALYTICS_DB_USER || '',
  password: process.env.ANALYTICS_DB_PASSWORD || '',
  database: process.env.ANALYTICS_DB_NAME || 'sla_tracker',
};

let masterConnection: mysql.Connection | null = null;
let analyticsConnection: mysql.Connection | null = null;

export async function getMasterDb(): Promise<mysql.Connection> {
  if (!masterConnection) {
    masterConnection = await mysql.createConnection(masterDbConfig);
  }
  return masterConnection;
}

export async function getAnalyticsDb(): Promise<mysql.Connection> {
  if (!analyticsConnection) {
    analyticsConnection = await mysql.createConnection(analyticsDbConfig);
  }
  return analyticsConnection;
}

export async function closeDatabaseConnections(): Promise<void> {
  if (masterConnection) {
    await masterConnection.end();
    masterConnection = null;
  }
  if (analyticsConnection) {
    await analyticsConnection.end();
    analyticsConnection = null;
  }
} 