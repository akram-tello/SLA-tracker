import { NextResponse } from 'next/server';
import { getAnalyticsDb } from '@/lib/db';

// Brand and country mappings (same as before)
const BRAND_MAPPING: Record<string, string> = {
  'vs': "Victoria's Secret",
  'bbw': 'Bath & Body Works',
  'rituals': 'Rituals'
};

const COUNTRY_MAPPING: Record<string, string> = {
  'my': 'Malaysia',
  'sg': 'Singapore',
  'th': 'Thailand',
  'id': 'Indonesia',
  'ph': 'Philippines'
};

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

export async function GET() {
  try {
    const db = await getAnalyticsDb();
    console.log('Filter API: Starting database query from orders tables...');
    
    // Get available order tables (same logic as dashboard summary API)
    const [tableRows] = await db.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'orders_%'
    `);

    const tables = (tableRows as { TABLE_NAME: string }[]).map(row => row.TABLE_NAME);
    console.log('Filter API: Found order tables:', tables);

    if (tables.length > 0) {
      // Extract brand codes and country codes from table names
      const brandCodes = new Set<string>();
      const countryCodes = new Set<string>();

      tables.forEach(tableName => {
        const parts = tableName.replace('orders_', '').split('_');
        if (parts.length >= 2) {
          const brandCode = parts.slice(0, -1).join('_');
          const countryCode = parts[parts.length - 1];
          
          brandCodes.add(brandCode);
          countryCodes.add(countryCode.toUpperCase());
        }
      });

      console.log('Filter API: Extracted brand codes:', Array.from(brandCodes));
      console.log('Filter API: Extracted country codes:', Array.from(countryCodes));

      // Map codes to names
      const brands = Array.from(brandCodes).map(code => ({
        code,
        name: BRAND_MAPPING[code] || code.charAt(0).toUpperCase() + code.slice(1)
      }));

      const countries = Array.from(countryCodes).map(code => ({
        code: code.toUpperCase(),
        name: COUNTRY_MAPPING[code.toLowerCase()] || code.toUpperCase()
      }));

      const result = {
        brands: brands.length > 0 ? brands : FALLBACK_DATA.brands,
        countries: countries.length > 0 ? countries : FALLBACK_DATA.countries,
        stages: FALLBACK_DATA.stages
      };

      console.log('Filter API: Final result:', result);
      return NextResponse.json(result);
    }

    // Fallback if no tables found
    console.log('Filter API: No order tables found, using fallback data');
    return NextResponse.json(FALLBACK_DATA);

  } catch (error) {
    console.error('Filter API error:', error);
    
    // Return fallback data on error
    console.log('Filter API: Error occurred, returning fallback data');
    return NextResponse.json(FALLBACK_DATA);
  }
} 