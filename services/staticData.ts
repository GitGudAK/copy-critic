import { Persona } from '../types';

const FIRST_NAMES = [
  "James", "Aisha", "Robert", "Maria", "David", "Wei", "Michael", "Sarah", "William", "Priya",
  "Richard", "Elena", "Joseph", "Yasmin", "Thomas", "Fatima", "Charles", "Sofia", "Christopher", "Liam",
  "Daniel", "Olivia", "Matthew", "Emma", "Anthony", "Ava", "Mark", "Isabella", "Donald", "Mia",
  "Steven", "Charlotte", "Paul", "Amelia", "Andrew", "Harper", "Joshua", "Evelyn", "Kenneth", "Abigail",
  "Kevin", "Emily", "Brian", "Elizabeth", "George", "Mila", "Edward", "Ella", "Ronald", "Avery",
  "Timothy", "Sofia", "Jason", "Camila", "Jeffrey", "Aria", "Ryan", "Scarlett", "Jacob", "Victoria",
  "Gary", "Madison", "Nicholas", "Luna", "Eric", "Grace", "Jonathan", "Chloe", "Stephen", "Penelope",
  "Larry", "Layla", "Justin", "Riley", "Scott", "Zoey", "Brandon", "Nora", "Benjamin", "Lily",
  "Samuel", "Eleanor", "Gregory", "Hannah", "Frank", "Lillian", "Alexander", "Addison", "Patrick", "Aubrey"
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  "Patel", "Kim", "Chen", "Singh", "Wang", "Liu", "Tanaka", "Sato", "Silva", "Santos"
];

const LOCATIONS = [
  { city: "New York, USA", culture: "Fast-paced, cynical, high-status focused." },
  { city: "London, UK", culture: "Witty, reserved, hates overselling." },
  { city: "Austin, TX", culture: "Direct, casual, conversion-oriented." },
  { city: "San Francisco, CA", culture: "Tech-savvy, early adopter, disruption-focused." },
  { city: "Berlin, Germany", culture: "Precise, data-driven, skeptical of fluff." },
  { city: "Singapore", culture: "Efficiency-loving, mobile-first, luxury-conscious." },
  { city: "Toronto, Canada", culture: "Polite, community-focused, value-driven." },
  { city: "Mumbai, India", culture: "High-energy, aspirational, mobile-centric." },
  { city: "Sydney, Australia", culture: "No-nonsense, humorous, relaxed." },
  { city: "Lagos, Nigeria", culture: "Entrepreneurial, bold, story-driven." }
];

const GENERATIONS = [
  { name: "Gen Z", traits: "Short attention span, craves authenticity, meme-fluent." },
  { name: "Millennial", traits: "Values experiences, cynical of ads, sustainability-minded." },
  { name: "Gen X", traits: "Skeptical, research-heavy, straight-shooter." },
  { name: "Boomer", traits: "Brand loyal, detailed reader, trusts authority." }
];

const ROLES: Persona['role'][] = ['Copywriter', 'Marketer', 'Creative Director', 'Growth Hacker'];

export const getStaticPersonas = (): Persona[] => {
  const personas: Persona[] = [];
  
  for (let i = 0; i < 100; i++) {
    // Deterministic selection
    const role = ROLES[i % ROLES.length];
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i * 3 + 7) % LAST_NAMES.length];
    
    const loc = LOCATIONS[i % LOCATIONS.length];
    const gen = GENERATIONS[i % GENERATIONS.length];
    
    // Mix specialties based on role
    let specialty = "General Marketing";
    if (role === 'Copywriter') specialty = ["Direct Response", "Brand Storytelling", "UX Microcopy", "Technical Writing", "SEO Content"][i % 5];
    if (role === 'Marketer') specialty = ["Product Marketing", "Brand Strategy", "Content Marketing", "Retention/CRM", "Social Media"][i % 5];
    if (role === 'Creative Director') specialty = ["Campaign Strategy", "Visual Identity", "Brand Narrative", "Art Direction"][i % 4];
    if (role === 'Growth Hacker') specialty = ["CRO (Conversion Rate)", "Paid Acquisition", "Viral Loops", "Email Automation"][i % 4];

    // Create a rich bias string combining demographics and psychographics
    const bias = `${gen.name} from ${loc.city}. ${gen.traits} ${loc.culture} Specialty: ${specialty}.`;

    personas.push({
      id: `static-persona-${i}`,
      name: `${firstName} ${lastName}`,
      role: role,
      specialty: specialty,
      yearsExperience: (i % 25) + 2, // 2 to 27 years
      bias: bias,
      avatarId: (i % 20) + 1
    });
  }
  
  return personas;
};