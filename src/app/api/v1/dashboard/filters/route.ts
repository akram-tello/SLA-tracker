import { NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';

// Fallback data in case database queries fail
const FALLBACK_DATA = {
  brands: [
    { code: 'vs', name: "Victoria's Secret" },
    { code: 'bbw', name: 'Bath & Body Works' }
  ],
  countries: [
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapore' }
  ],
  stages: [
    { code: 'Processed', name: 'Processed' },
    { code: 'Shipped', name: 'Shipped' },
    { code: 'Delivered', name: 'Delivered' }
  ]
};

// Brand code to name mapping
const BRAND_MAPPING: Record<string, string> = {
  'vs': "Victoria's Secret",
  'bbw': 'Bath & Body Works',
  'rituals': 'Rituals'
};

// Country code to name mapping  
const COUNTRY_MAPPING: Record<string, string> = {
  'my': 'Malaysia',
  'sg': 'Singapore',
  'th': 'Thailand',
  'id': 'Indonesia',
  'ph': 'Philippines',
  'vn': 'Vietnam',
  'au': 'Australia',
  'nz': 'New Zealand',
  'hk': 'Hong Kong',
  'tw': 'Taiwan'
};

export async function GET() {
  try {
    const db = await getAnalyticsDb();
    console.log('Filter API: Starting database query...');
    
    // Try to get brands and countries from sla_daily_summary table
    const [summaryRows] = await db.execute(`
      SELECT DISTINCT brand_code, country_code 
      FROM sla_daily_summary 
      WHERE brand_code IS NOT NULL 
      AND country_code IS NOT NULL
      LIMIT 50
    `);

    console.log('Filter API: Summary query result:', summaryRows);

    const summaryData = summaryRows as { brand_code: string; country_code: string }[];
    
    if (summaryData.length > 0) {
      // Extract unique brands and countries from summary data
      const brandCodes = [...new Set(summaryData.map(row => row.brand_code))];
      const countryCodes = [...new Set(summaryData.map(row => row.country_code))];

      const brands = brandCodes.map(code => ({
        code,
        name: BRAND_MAPPING[code] || code.charAt(0).toUpperCase() + code.slice(1)
      }));

      const countries = countryCodes.map(code => ({
        code: code.toUpperCase(),
        name: COUNTRY_MAPPING[code.toLowerCase()] || code.toUpperCase()
      }));

      console.log('Filter API: Extracted brands:', brands);
      console.log('Filter API: Extracted countries:', countries);

      const result = {
        brands: brands.length > 0 ? brands : FALLBACK_DATA.brands,
        countries: countries.length > 0 ? countries : FALLBACK_DATA.countries,
        stages: FALLBACK_DATA.stages
      };

      return NextResponse.json(result);
    }

    // If sla_daily_summary doesn't have data, try to get tables
    console.log('Filter API: No summary data found, checking tables...');
    
    const [tableRows] = await db.execute(`
      SHOW TABLES LIKE 'orders_%'
    `);

    console.log('Filter API: Table query result:', tableRows);

    const tables = (tableRows as Record<string, string>[]).map(row => Object.values(row)[0]);
    
    if (tables.length === 0) {
      console.log('Filter API: No order tables found, returning fallback data');
      return NextResponse.json(FALLBACK_DATA);
    }

    // Extract brands and countries from table names
    const brands = new Map();
    const countries = new Map();

    tables.forEach(tableName => {
      if (!tableName) return;
      console.log('Filter API: Processing table:', tableName);
      
      // Parse table name pattern: orders_brand_country
      const match = tableName.match(/^orders_([a-zA-Z]+)_([a-z]{2})$/);
      if (match) {
        const [, brandCode, countryCode] = match;
        console.log('Filter API: Found brand/country:', brandCode, countryCode);
        
        const brandName = BRAND_MAPPING[brandCode] || 
          brandCode.charAt(0).toUpperCase() + brandCode.slice(1);
        
        brands.set(brandCode, brandName);
        
        const countryName = COUNTRY_MAPPING[countryCode] || countryCode.toUpperCase();
        countries.set(countryCode.toUpperCase(), countryName);
      }
    });

    // Convert maps to arrays
    const brandsArray = Array.from(brands.entries()).map(([code, name]) => ({
      code,
      name
    }));

    const countriesArray = Array.from(countries.entries()).map(([code, name]) => ({
      code,
      name
    }));

    console.log('Filter API: Final brands:', brandsArray);
    console.log('Filter API: Final countries:', countriesArray);

    const result = {
      brands: brandsArray.length > 0 ? brandsArray : FALLBACK_DATA.brands,
      countries: countriesArray.length > 0 ? countriesArray : FALLBACK_DATA.countries,
      stages: FALLBACK_DATA.stages
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Filter options API error:', error);
    
    // Return fallback data instead of error
    return NextResponse.json(FALLBACK_DATA);
  }
} 