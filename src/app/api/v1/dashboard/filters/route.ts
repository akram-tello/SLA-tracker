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
  'ph': 'Philippines',
  'hk': 'Hong Kong',
  'au': 'Australia',
  'nz': 'New Zealand',
  'vn': 'Vietnam'
};

const FALLBACK_DATA = {
  brands: [
    { code: 'vs', name: "Victoria's Secret" },
    { code: 'bbw', name: 'Bath & Body Works' }
  ],
  brandCountries: {
    'vs': [
      { code: 'MY', name: 'Malaysia' },
      { code: 'SG', name: 'Singapore' }
    ],
    'bbw': [
      { code: 'MY', name: 'Malaysia' },
      { code: 'SG', name: 'Singapore' }
    ]
  },
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
      // Extract brand codes and create brand-specific country mappings
      const brandCodes = new Set<string>();
      const brandCountries: Record<string, Set<string>> = {};

      tables.forEach(tableName => {
        const parts = tableName.replace('orders_', '').split('_');
        if (parts.length >= 2) {
          const brandCode = parts.slice(0, -1).join('_');
          const countryCode = parts[parts.length - 1].toUpperCase();
          
          brandCodes.add(brandCode);
          
          // Initialize brand countries mapping if not exists
          if (!brandCountries[brandCode]) {
            brandCountries[brandCode] = new Set<string>();
          }
          
          brandCountries[brandCode].add(countryCode);
        }
      });

      console.log('Filter API: Extracted brand codes:', Array.from(brandCodes));
      console.log('Filter API: Brand-specific countries:', brandCountries);

      // Filter out specific brand-country combinations (rituals au and bbw nz)
      const excludedCombinations = ['rituals_au', 'bbw_nz'];

      excludedCombinations.forEach(combination => {
        const [brandCode, countryCode] = combination.split('_');
        if (brandCountries[brandCode]) {
          brandCountries[brandCode].delete(countryCode.toUpperCase());
          if (brandCountries[brandCode].size === 0) {
            delete brandCountries[brandCode];
            brandCodes.delete(brandCode);
          }
        }
      });

      // Map codes to names
      const brands = Array.from(brandCodes).map(code => ({
        code,
        name: BRAND_MAPPING[code] || code.charAt(0).toUpperCase() + code.slice(1)
      }));

      // Create brand-specific country mappings
      const brandCountriesResult: Record<string, Array<{code: string, name: string}>> = {};
      
      Object.entries(brandCountries).forEach(([brandCode, countryCodes]) => {
        brandCountriesResult[brandCode] = Array.from(countryCodes).map(code => ({
          code: code.toUpperCase(),
          name: COUNTRY_MAPPING[code.toLowerCase()] || code.toUpperCase()
        }));
      });

      const result = {
        brands: brands.length > 0 ? brands : FALLBACK_DATA.brands,
        brandCountries: Object.keys(brandCountriesResult).length > 0 ? brandCountriesResult : FALLBACK_DATA.brandCountries,
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