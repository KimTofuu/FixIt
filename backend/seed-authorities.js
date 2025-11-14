const mongoose = require('mongoose');
require('dotenv').config();
const Authority = require('./models/Authority');

const authorities = [
    // Infrastructure
  { authorityName: 'City Engineering Office (CEO)', department: 'Public Works & Infrastructure', contactEmail: 'ceo@city.gmail.com', class: 'Infrastructure' },
  { authorityName: 'Office of the City Building Official (OCBO)', department: 'Building Permits & Structural Safety', contactEmail: 'ocbo@city.gmail.com', class: 'Infrastructure' },
  { authorityName: 'City Planning & Development Office (CPDO)', department: 'Planning, Zoning & Urban Development', contactEmail: 'cpdo@city.gmail.com', class: 'Infrastructure' },
  { authorityName: 'DPWH Zambales 2nd District Engineering Office', department: 'National Roads & Bridges within Olongapo', contactEmail: 'dpwh.zambales2@dpwh.gov.ph', class: 'Infrastructure' },
  
    // Utilities
  { authorityName: 'Subic Water and Sewerage Company, Inc. (SUBICWATER)', department: 'Water & Sewerage Utility', contactEmail: 'subicwater@subicwater.com', class: 'Utilities' },
  { authorityName: 'Olongapo Electricity Distribution Company (OEDC)', department: 'Electric Distribution Utility', contactEmail: 'oedc@oedc.com', class: 'Utilities' },
  { authorityName: 'PLDT Olongapo', department: 'Telecommunications / Landline / Fiber', contactEmail: 'pldt@pldt.com', class: 'Utilities' },
  { authorityName: 'Globe Telecom – Olongapo', department: 'Telecommunications / Mobile / Broadband', contactEmail: 'globe@globe.com', class: 'Utilities' },
  { authorityName: 'Converge ICT – Olongapo', department: 'Telecommunications / Fiber', contactEmail: 'converge@converge.com', class: 'Utilities' },

    // Sanitation and Waste
  { authorityName: 'Environmental Sanitation & Management Office (ESMO)', department: 'Solid Waste Management Division', contactEmail: 'esmo@esmo.com', class: 'Sanitation and Waste' },
  { authorityName: 'City Environment & Natural Resources Office (CENRO)', department: 'Environmental Management & Sanitation', contactEmail: 'cenro@cenro.com', class: 'Sanitation and Waste' },

    // Environment and Public Spaces
  { authorityName: 'Parks & Plaza Management Office (PPMO)', department: 'City Parks, Plazas & Beautification', contactEmail: 'ppmo@ppmo.com', class: 'Environment and Public Spaces' },
  { authorityName: 'City Environment & Natural Resources Office (CENRO)', department: 'Urban Forestry, Environment & Compliance', contactEmail: 'cenro@cenro.com', class: 'Environment and Public Spaces' },
    // Community and Safety
  { authorityName: 'Olongapo Electricity Distribution Company (OEDC)', department: 'Electric Distribution Utility', contactEmail: 'oedc@oedc.com', class: 'Community and Safety' },
  { authorityName: 'Olongapo City Police Office (OCPO)', department: 'Law Enforcement', contactEmail: 'ocpo@ocpo.com', class: 'Community and Safety' },
  { authorityName: 'Bureau of Fire Protection – Olongapo City', department: 'Fire Safety & Emergency Response', contactEmail: 'bfp@bfp.com', class: 'Community and Safety' },
  { authorityName: 'City Disaster Risk Reduction & Management Office (CDRRMO)', department: 'Disaster Preparedness & Response', contactEmail: 'cdrrmo@cdrrmo.com', class: 'Community and Safety' },
  { authorityName: 'Office of Traffic Management & Public Safety (OTMPS)', department: 'Traffic & Road Safety', contactEmail: 'otmps@otmps.com', class: 'Community and Safety' },

    // Government / Administrative
  { authorityName: 'Office of the City Administrator', department: 'City Government Administration', contactEmail: 'oca@oca.com', class: 'Government / Administrative' },
  { authorityName: 'Office of the Mayor', department: 'Executive Leadership', contactEmail: 'oma@oma.com', class: 'Government / Administrative' },
  { authorityName: 'City Legal Office', department: 'Legal Affairs & Compliance', contactEmail: 'clo@clo.com', class: 'Government / Administrative' },
  { authorityName: 'Sangguniang Panlungsod (City Council) Secretariat', department: 'Legislative Support', contactEmail: 'sps@citycouncil.com', class: 'Government / Administrative' },

    // Others
  { authorityName: 'Subic Bay Metropolitan Authority (SBMA)', department: 'Freeport Zone Jurisdiction', contactEmail: 'sbma@sbma.com', class: 'Others' },
  { authorityName: 'DSWD – Olongapo City Field Office', department: 'Social Welfare & Community Support', contactEmail: 'dswd@dswd.com', class: 'Others' },
  { authorityName: 'DepEd – Olongapo City Schools Division Office', department: 'Public Schools & Facilities', contactEmail: 'deped@deped.com', class: 'Others' },

    // Default
  { authorityName: 'Office of the Mayor', department: 'General Fallback', contactEmail: 'oma@oma.com', class: 'Default' },
];

async function seedAuthorities() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fixitph');
    console.log('Connected to MongoDB');

    // Drop the unique index if it exists
    try {
      await Authority.collection.dropIndex('contactEmail_1');
      console.log('Dropped contactEmail unique index');
    } catch (err) {
      console.log('No contactEmail index to drop (or already dropped)');
    }
    
    // Clear existing data (optional)
    await Authority.deleteMany({});
    console.log('Cleared existing authorities');
    
    // Insert new data
    await Authority.insertMany(authorities);
    console.log('Authorities seeded successfully');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding authorities:', error);
    process.exit(1);
  }
}

seedAuthorities();