import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'
import type {
  AppNotification,
  Attachment,
  CalendarEvent,
  Client,
  Member,
  PackDetails,
  Priority,
  Project,
  Settings,
  Status,
  Task,
  TimeEntry,
} from './types'
import { toISODate } from './utils'
import { emptyKld, emptyPack } from './handoff'

/** Deterministic RNG so the demo looks the same on every fresh load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

export const DEFAULT_STATUSES: Status[] = [
  { id: 'st_idea', name: 'Idea', color: '#a78bfa', kind: 'backlog' },
  { id: 'st_brief', name: 'Brief', color: '#60a5fa', kind: 'backlog' },
  { id: 'st_progress', name: 'In progress', color: '#b5d92a', kind: 'active' },
  { id: 'st_review', name: 'Review', color: '#f59e0b', kind: 'review' },
  { id: 'st_revision', name: 'Revision', color: '#f97316', kind: 'active' },
  { id: 'st_approved', name: 'Approved', color: '#14b8a6', kind: 'approved' },
  { id: 'st_completed', name: 'Completed', color: '#16a34a', kind: 'done' },
  { id: 'st_archived', name: 'Archived', color: '#9ca3af', kind: 'archived' },
]

export const PROJECT_TYPES = [
  'Branding',
  'Packaging',
  'Social Media',
  'UI/UX',
  'Web Design',
  'Illustration',
  'Motion',
  'Campaign',
  'Print',
  'Presentation',
  'Product Design',
]

export const SOFTWARE = ['Figma', 'Illustrator', 'Photoshop', 'InDesign', 'After Effects', 'Blender', 'Procreate', 'Cinema 4D', 'Framer']

export const INDUSTRIES = ['Food & Beverage', 'Hospitality', 'Beauty', 'Mobility', 'Health', 'Finance', 'Culture', 'Retail', 'Education', 'Technology']

const members: Member[] = [
  {
    id: 'm_me',
    name: 'Jaspal',
    role: 'Owner',
    title: 'Lead Designer',
    location: 'Remote',
    timezone: 'Asia/Kolkata',
    skills: ['Brand identity', 'Packaging', 'Art direction', 'Typography'],
    specializations: ['Food & beverage brands', 'Visual systems'],
    bio: 'I build brands that people want to pick up off the shelf. Currently obsessed with honest packaging and big, confident type.',
    hue: 262,
    weeklyCapacity: 40,
  },
  {
    id: 'm_sofia',
    name: 'Sofia Lindqvist',
    role: 'Admin',
    title: 'Creative Director',
    location: 'Stockholm, Sweden',
    timezone: 'Europe/Stockholm',
    skills: ['Art direction', 'Campaigns', 'Copy', 'Photography'],
    specializations: ['Campaign concepts', 'Brand voice'],
    bio: 'Fifteen years of campaigns across the Nordics. I care about the idea first and the pixels second.',
    hue: 20,
    weeklyCapacity: 32,
  },
  {
    id: 'm_kenji',
    name: 'Kenji Watanabe',
    role: 'Designer',
    title: 'Motion Designer',
    location: 'Tokyo, Japan',
    timezone: 'Asia/Tokyo',
    skills: ['After Effects', 'Cinema 4D', '3D', 'Sound design'],
    specializations: ['Product films', 'Logo animation'],
    bio: 'Making things move with purpose. Former anime background painter.',
    hue: 200,
    weeklyCapacity: 40,
  },
  {
    id: 'm_amara',
    name: 'Amara Okafor',
    role: 'Designer',
    title: 'UI/UX Designer',
    location: 'Lagos, Nigeria',
    timezone: 'Africa/Lagos',
    skills: ['Figma', 'Prototyping', 'Research', 'Design systems'],
    specializations: ['Fintech', 'Mobile apps'],
    bio: 'I design products for the next billion users, starting with the ones on slow networks.',
    hue: 150,
    weeklyCapacity: 40,
  },
  {
    id: 'm_lucas',
    name: 'Lucas Ferreira',
    role: 'Designer',
    title: 'Illustrator',
    location: 'São Paulo, Brazil',
    timezone: 'America/Sao_Paulo',
    skills: ['Procreate', 'Editorial illustration', 'Lettering'],
    specializations: ['Packaging illustration', 'Murals'],
    bio: 'Colour, texture and a little bit of chaos. Illustrating for brands and books.',
    hue: 90,
    weeklyCapacity: 30,
  },
  {
    id: 'm_mia',
    name: 'Mia Chen',
    role: 'Designer',
    title: 'Product Designer',
    location: 'Singapore',
    timezone: 'Asia/Singapore',
    skills: ['Figma', 'Framer', 'Interaction design'],
    specializations: ['Web experiences', 'E-commerce'],
    bio: 'Somewhere between design and code. Happiest when a prototype feels real.',
    hue: 330,
    weeklyCapacity: 40,
  },
  {
    id: 'm_omar',
    name: 'Omar Haddad',
    role: 'Reviewer',
    title: 'Account Lead',
    location: 'Dubai, UAE',
    timezone: 'Asia/Dubai',
    skills: ['Client relations', 'Strategy'],
    specializations: ['Approvals', 'Brand strategy'],
    bio: 'I keep clients happy and projects honest.',
    hue: 50,
    weeklyCapacity: 20,
  },
  {
    id: 'm_elena',
    name: 'Elena Rossi',
    role: 'Viewer',
    title: 'Studio Producer',
    location: 'Milan, Italy',
    timezone: 'Europe/Rome',
    skills: ['Production', 'Budgeting'],
    specializations: ['Print production'],
    bio: 'Making sure the ink hits the paper on time.',
    hue: 0,
    weeklyCapacity: 20,
  },
]

interface ClientSeed {
  id: string
  name: string
  contact: string
  industry: string
  location: string
  website: string
  hue: number
  notes: string
}

const clientSeeds: ClientSeed[] = [
  { id: 'c_idfresh', name: 'iD Fresh', contact: 'Priya Nair', industry: 'Food & Beverage', location: 'Bengaluru, India', website: 'idfreshfood.com', hue: 35, notes: 'Loves bold colour and real food photography. Approvals go through the brand team on Thursdays.' },
  { id: 'c_nordlys', name: 'Nordlys Coffee', contact: 'Henrik Aas', industry: 'Food & Beverage', location: 'Oslo, Norway', website: 'nordlys.coffee', hue: 230, notes: 'Minimal, Scandinavian. Prefers two strong options over five weak ones.' },
  { id: 'c_kobo', name: 'Kōbō Ceramics', contact: 'Yui Tanaka', industry: 'Retail', location: 'Kyoto, Japan', website: 'kobo-ceramics.jp', hue: 15, notes: 'Handmade ceramics studio. Everything should feel quiet and tactile.' },
  { id: 'c_verde', name: 'Verde Mobility', contact: 'Rafael Costa', industry: 'Mobility', location: 'Lisbon, Portugal', website: 'verde.bike', hue: 145, notes: 'E-bike sharing. Fast feedback, very data-driven.' },
  { id: 'c_sahara', name: 'Sahara Botanics', contact: 'Leila Benali', industry: 'Beauty', location: 'Marrakesh, Morocco', website: 'saharabotanics.ma', hue: 60, notes: 'Argan-based skincare. Wants premium but warm.' },
  { id: 'c_lumen', name: 'Lumen Health', contact: 'Dr. Grace Kim', industry: 'Health', location: 'Toronto, Canada', website: 'lumenhealth.ca', hue: 190, notes: 'Accessibility is non-negotiable. WCAG AA everywhere.' },
  { id: 'c_kora', name: 'Kora Pay', contact: 'Tunde Bello', industry: 'Finance', location: 'Nairobi, Kenya', website: 'korapay.africa', hue: 280, notes: 'Mobile money app. Design for low-end Android first.' },
  { id: 'c_museo', name: 'Museo del Color', contact: 'Valentina Ruiz', industry: 'Culture', location: 'Mexico City, Mexico', website: 'museodelcolor.mx', hue: 350, notes: 'Exhibition graphics and wayfinding. Bilingual Spanish/English.' },
]

const fileKinds: Attachment['kind'][] = ['image', 'pdf', 'figma', 'video', 'doc', 'archive']
const ext: Record<Attachment['kind'], string> = { image: 'png', pdf: 'pdf', figma: 'fig', video: 'mp4', doc: 'docx', archive: 'zip', other: 'file' }

interface ProjectSeed {
  id: string
  name: string
  client: string
  type: string
  status: string
  priority: Priority
  start: number
  due: number
  tags: string[]
  members: string[]
  software: string[]
  description: string
  brief: string
  tasks: [string, string, number, Priority, number][] // title, status, dueOffset, priority, estimate
  completedOffset?: number
}

const pack = (p: Partial<PackDetails>): PackDetails => ({ ...emptyPack(), ...p })

/** Pack and KLD details for the packaging demo projects. */
const packSeeds: Record<string, Partial<Project>> = {
  p_dosa: {
    pack: pack({ productName: 'Idli & Dosa Batter', category: 'Ready-to-cook batter', packType: 'Stand-up pouch', packSize: '1 kg', width: '200', height: '300', depth: '60', material: 'Laminated film (PET/PE)', variants: '3 regional variants', sku: 'IDF-DB-1KG', barcode: 'EAN-13 8906082910014', printing: 'Rotogravure', finishing: 'Matte with spot gloss', languages: 'English, Kannada, Tamil, Malayalam' }),
    kld: { ...emptyKld(), version: 'R2 from printer', dimensions: 'Open size 420 × 320 mm', vendor: 'Sai Flexi Packaging', colors: 'CMYK + 1 spot (brand blue)', bleed: '3 mm', safety: '6 mm from seals', specs: 'Reverse print, white underlay', instructions: 'Keep the zipper band and barcode zone clear.' },
  },
  p_sahara: {
    pack: pack({ productName: 'Sahara Glow Serum', category: 'Skin care', packType: 'Carton box', packSize: '30 ml', width: '40', height: '120', depth: '40', material: 'Paperboard', variants: '1', printing: 'Offset', finishing: 'Soft-touch with gold foil', languages: 'English, Arabic, French' }),
    kld: { ...emptyKld(), later: true },
  },
}

const projectSeeds: ProjectSeed[] = [
  {
    id: 'p_summer', name: 'Summer Campaign', client: 'c_idfresh', type: 'Campaign', status: 'st_progress', priority: 'high', start: -18, due: 9,
    tags: ['campaign', 'social', 'print'], members: ['m_me', 'm_sofia', 'm_lucas'], software: ['Photoshop', 'Illustrator', 'Figma'],
    description: 'A sunny, food-first summer campaign for the new ready-to-cook range across India and the Middle East.',
    brief: 'Launch the summer range with a warm, appetising campaign. Hero key visual, social cutdowns, in-store packaging wraps and a landing page. Tone: fresh, honest, a little playful. Must work in English, Hindi and Arabic.',
    tasks: [
      ['Key Visual', 'st_review', 0, 'urgent', 10],
      ['Social Media Posts', 'st_progress', 2, 'high', 8],
      ['Packaging', 'st_progress', 6, 'high', 14],
      ['Banner', 'st_brief', 5, 'medium', 4],
      ['Landing Page', 'st_idea', 9, 'medium', 12],
      ['Presentation', 'st_progress', 1, 'high', 5],
    ],
  },
  {
    id: 'p_dosa', name: 'Dosa Batter Pack Refresh', client: 'c_idfresh', type: 'Packaging', status: 'st_review', priority: 'urgent', start: -30, due: 1,
    tags: ['packaging', 'retail'], members: ['m_me', 'm_lucas'], software: ['Illustrator', 'Photoshop'],
    description: 'Refreshing the hero SKU packaging with clearer hierarchy and a new illustration style.',
    brief: 'Improve shelf standout for the 1kg dosa batter pouch. Keep brand blue. Introduce illustrated ingredients. Print-ready files for 3 regional variants.',
    tasks: [
      ['Illustrated ingredients', 'st_completed', -6, 'high', 12],
      ['Front of pack layout', 'st_review', 0, 'urgent', 8],
      ['Regional variants (3)', 'st_revision', 1, 'high', 6],
      ['Print-ready artwork', 'st_brief', 3, 'high', 5],
    ],
  },
  {
    id: 'p_nordlys', name: 'Nordlys Brand Identity', client: 'c_nordlys', type: 'Branding', status: 'st_revision', priority: 'high', start: -25, due: 12,
    tags: ['branding', 'logo', 'identity'], members: ['m_me', 'm_sofia'], software: ['Illustrator', 'Figma'],
    description: 'Full identity for a specialty roastery opening three cafés in Oslo.',
    brief: 'Wordmark, symbol, colour, type and a small set of applications (cups, bags, signage). Inspiration: northern light, but avoid the obvious aurora gradients.',
    tasks: [
      ['Moodboards', 'st_completed', -18, 'medium', 4],
      ['Logo exploration', 'st_completed', -10, 'high', 16],
      ['Logo refinement', 'st_revision', 3, 'high', 8],
      ['Colour & type system', 'st_progress', 6, 'medium', 6],
      ['Coffee bag mockups', 'st_idea', 10, 'medium', 6],
      ['Brand guidelines', 'st_idea', 12, 'medium', 10],
    ],
  },
  {
    id: 'p_kobo_web', name: 'Kōbō Online Store', client: 'c_kobo', type: 'Web Design', status: 'st_progress', priority: 'medium', start: -12, due: 20,
    tags: ['web', 'e-commerce'], members: ['m_mia', 'm_me'], software: ['Figma', 'Framer'],
    description: 'A calm, image-led online shop for handmade ceramics.',
    brief: 'Design a 6-page Shopify-ready store. Emphasis on photography and the maker stories. Japanese and English.',
    tasks: [
      ['Sitemap & wireframes', 'st_completed', -4, 'medium', 6],
      ['Homepage design', 'st_progress', 4, 'high', 10],
      ['Product page', 'st_brief', 9, 'medium', 8],
      ['Maker stories template', 'st_idea', 14, 'low', 6],
      ['Mobile layouts', 'st_idea', 18, 'medium', 8],
    ],
  },
  {
    id: 'p_verde_app', name: 'Verde Rider App 2.0', client: 'c_verde', type: 'UI/UX', status: 'st_progress', priority: 'high', start: -20, due: 15,
    tags: ['app', 'mobile', 'ux'], members: ['m_amara', 'm_mia'], software: ['Figma'],
    description: 'Redesign of the unlock-and-ride flow plus a new trip history.',
    brief: 'Reduce time-to-unlock by 30%. Rework map, scan, and payment. Accessibility AA. Deliver prototype for user testing in Lisbon.',
    tasks: [
      ['User interviews synthesis', 'st_completed', -8, 'high', 6],
      ['Unlock flow', 'st_review', 2, 'high', 10],
      ['Trip history', 'st_progress', 7, 'medium', 8],
      ['Prototype for testing', 'st_brief', 11, 'high', 6],
    ],
  },
  {
    id: 'p_sahara', name: 'Sahara Serum Launch', client: 'c_sahara', type: 'Packaging', status: 'st_brief', priority: 'medium', start: -3, due: 28,
    tags: ['packaging', 'beauty', 'launch'], members: ['m_me', 'm_lucas'], software: ['Illustrator', 'Blender'],
    description: 'Glass bottle, carton and launch visuals for a new argan serum.',
    brief: 'Premium but warm. Reference Moroccan zellige patterns without cliché. 3D renders for e-commerce.',
    tasks: [
      ['Pattern exploration', 'st_progress', 6, 'medium', 8],
      ['Carton dieline', 'st_brief', 12, 'medium', 4],
      ['3D bottle renders', 'st_idea', 20, 'low', 10],
    ],
  },
  {
    id: 'p_lumen', name: 'Lumen Patient Portal', client: 'c_lumen', type: 'UI/UX', status: 'st_approved', priority: 'medium', start: -40, due: 3,
    tags: ['health', 'accessibility', 'web'], members: ['m_amara'], software: ['Figma'],
    description: 'Accessible patient portal for booking and results.',
    brief: 'Design the booking and results flows with plain-language copy. WCAG AA. Hand off to engineering in Toronto.',
    tasks: [
      ['Booking flow', 'st_approved', -5, 'high', 12],
      ['Results view', 'st_approved', -2, 'high', 10],
      ['Dev handoff', 'st_progress', 3, 'medium', 4],
    ],
  },
  {
    id: 'p_kora', name: 'Kora Pay Onboarding Motion', client: 'c_kora', type: 'Motion', status: 'st_review', priority: 'high', start: -14, due: 4,
    tags: ['motion', 'app', 'onboarding'], members: ['m_kenji', 'm_amara'], software: ['After Effects', 'Figma'],
    description: 'Lottie animations for the onboarding and first payment moments.',
    brief: 'Five short, light Lottie files (<150kb each). Friendly and trustworthy. Must run smoothly on low-end Android.',
    tasks: [
      ['Storyboards', 'st_completed', -7, 'medium', 5],
      ['Welcome animation', 'st_review', 0, 'high', 6],
      ['First payment celebration', 'st_progress', 2, 'high', 6],
      ['Lottie optimisation', 'st_brief', 4, 'medium', 3],
    ],
  },
  {
    id: 'p_museo', name: 'Museo Exhibition Graphics', client: 'c_museo', type: 'Print', status: 'st_idea', priority: 'low', start: 3, due: 45,
    tags: ['exhibition', 'wayfinding', 'print'], members: ['m_me', 'm_elena'], software: ['InDesign', 'Illustrator'],
    description: 'Bilingual wall graphics and wayfinding for the autumn colour exhibition.',
    brief: 'Exhibition title wall, 24 wall labels, wayfinding signage and a printed guide. Spanish/English.',
    tasks: [['Concept directions', 'st_idea', 14, 'low', 6]],
  },
  {
    id: 'p_nordlys_social', name: 'Nordlys Opening Week Social', client: 'c_nordlys', type: 'Social Media', status: 'st_idea', priority: 'low', start: 10, due: 30,
    tags: ['social', 'launch'], members: ['m_sofia'], software: ['Photoshop', 'After Effects'],
    description: 'Teasers and opening week posts for the first café.',
    brief: 'Ten posts and six stories. Behind-the-scenes roasting, the new identity in the wild.',
    tasks: [],
  },
  // Completed work, feeds the archive and insights.
  {
    id: 'p_arch_1', name: 'Kōbō Spring Catalogue', client: 'c_kobo', type: 'Print', status: 'st_completed', priority: 'medium', start: -120, due: -95, completedOffset: -96,
    tags: ['print', 'editorial', 'catalogue'], members: ['m_me', 'm_elena'], software: ['InDesign', 'Photoshop'],
    description: 'A 48-page printed catalogue for the spring collection, shot on film.', brief: '', tasks: [
      ['Layout system', 'st_completed', -110, 'medium', 8], ['Photo retouching', 'st_completed', -104, 'medium', 10], ['Print production', 'st_completed', -97, 'high', 4],
    ],
  },
  {
    id: 'p_arch_2', name: 'iD Fresh Diwali Gift Box', client: 'c_idfresh', type: 'Packaging', status: 'st_completed', priority: 'high', start: -330, due: -300, completedOffset: -302,
    tags: ['packaging', 'festive', 'illustration'], members: ['m_me', 'm_lucas'], software: ['Illustrator', 'Procreate'],
    description: 'Limited-edition festive gift box with hand-drawn rangoli patterns.', brief: '', tasks: [
      ['Rangoli illustrations', 'st_completed', -320, 'high', 14], ['Box dieline', 'st_completed', -312, 'medium', 4], ['Print proofing', 'st_completed', -303, 'high', 3],
    ],
  },
  {
    id: 'p_arch_3', name: 'Verde Launch Film', client: 'c_verde', type: 'Motion', status: 'st_completed', priority: 'high', start: -80, due: -55, completedOffset: -57,
    tags: ['motion', 'launch', '3d'], members: ['m_kenji'], software: ['After Effects', 'Cinema 4D'],
    description: 'A 45-second launch film for the new e-bike fleet in Lisbon.', brief: '', tasks: [
      ['Styleframes', 'st_completed', -75, 'high', 8], ['3D bike model', 'st_completed', -68, 'medium', 12], ['Animation & edit', 'st_completed', -58, 'high', 20],
    ],
  },
  {
    id: 'p_arch_4', name: 'Kora Pay Brand Refresh', client: 'c_kora', type: 'Branding', status: 'st_completed', priority: 'medium', start: -200, due: -150, completedOffset: -152,
    tags: ['branding', 'fintech', 'identity'], members: ['m_me', 'm_amara', 'm_sofia'], software: ['Illustrator', 'Figma'],
    description: 'Refreshed logo, colours and app icon for a pan-African payments app.', brief: '', tasks: [
      ['Logo refresh', 'st_completed', -180, 'high', 14], ['App icon', 'st_completed', -165, 'medium', 4], ['Guidelines', 'st_completed', -153, 'medium', 10],
    ],
  },
  {
    id: 'p_arch_5', name: 'Sahara Botanics Website', client: 'c_sahara', type: 'Web Design', status: 'st_completed', priority: 'medium', start: -60, due: -30, completedOffset: -26,
    tags: ['web', 'e-commerce', 'beauty'], members: ['m_mia'], software: ['Figma', 'Framer'],
    description: 'Warm, ingredient-led storefront with an argan origin story.', brief: '', tasks: [
      ['Homepage', 'st_completed', -50, 'high', 10], ['PDP & cart', 'st_completed', -40, 'medium', 8], ['Framer build', 'st_completed', -28, 'medium', 12],
    ],
  },
  {
    id: 'p_arch_6', name: 'Lumen Health Illustration Set', client: 'c_lumen', type: 'Illustration', status: 'st_completed', priority: 'low', start: -45, due: -20, completedOffset: -12,
    tags: ['illustration', 'health', 'inclusive'], members: ['m_lucas'], software: ['Procreate', 'Illustrator'],
    description: '24 inclusive spot illustrations for the patient portal and brochures.', brief: '', tasks: [
      ['Character style', 'st_completed', -40, 'medium', 6], ['Spot illustrations', 'st_completed', -15, 'medium', 24],
    ],
  },
  {
    id: 'p_arch_7', name: 'Museo Summer Poster Series', client: 'c_museo', type: 'Print', status: 'st_completed', priority: 'medium', start: -150, due: -120, completedOffset: -121,
    tags: ['poster', 'typography', 'print'], members: ['m_me'], software: ['Illustrator', 'InDesign'],
    description: 'Six typographic posters for the summer late-night openings.', brief: '', tasks: [
      ['Poster concepts', 'st_completed', -140, 'medium', 8], ['Final posters', 'st_completed', -122, 'medium', 12],
    ],
  },
  {
    id: 'p_arch_8', name: 'Nordlys Pitch Deck', client: 'c_nordlys', type: 'Presentation', status: 'st_completed', priority: 'medium', start: -40, due: -32, completedOffset: -33,
    tags: ['presentation', 'pitch'], members: ['m_sofia', 'm_me'], software: ['Figma'],
    description: 'Investor deck for the café expansion.', brief: '', tasks: [['Deck design', 'st_completed', -34, 'medium', 10]],
  },
  {
    id: 'p_arch_9', name: 'Kōbō Instagram Relaunch', client: 'c_kobo', type: 'Social Media', status: 'st_completed', priority: 'low', start: -20, due: -6, completedOffset: -5,
    tags: ['social', 'photography'], members: ['m_me', 'm_mia'], software: ['Photoshop', 'Figma'],
    description: 'New grid system and templates for the studio’s Instagram.', brief: '', tasks: [
      ['Grid system', 'st_completed', -12, 'low', 4], ['Story templates', 'st_completed', -6, 'low', 4],
    ],
  },
  {
    id: 'p_arch_10', name: 'iD Fresh Ramadan Campaign', client: 'c_idfresh', type: 'Campaign', status: 'st_archived', priority: 'high', start: -230, due: -200, completedOffset: -201,
    tags: ['campaign', 'social', 'gcc'], members: ['m_me', 'm_sofia', 'm_kenji'], software: ['Photoshop', 'After Effects'],
    description: 'Iftar-time campaign across the GCC with animated social cutdowns.', brief: '', tasks: [
      ['Key visual', 'st_completed', -220, 'high', 10], ['Animated cutdowns', 'st_completed', -205, 'high', 12],
    ],
  },
]

const commentBank = [
  'Love the direction. Can we push the colour a bit warmer?',
  'Client asked to try the logo 10% larger on the front.',
  'Uploaded v3, changes are in the second artboard.',
  'This is looking really strong. Approved from my side.',
  'Could we see one version without the pattern?',
  'Typo in the Arabic headline, flagged in the PDF.',
]

export interface DemoData {
  statuses: Status[]
  members: Member[]
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  events: CalendarEvent[]
  entries: TimeEntry[]
  notifications: AppNotification[]
  settings: Settings
}

export function buildDemo(now = new Date()): DemoData {
  const r = rng(42)
  const day = (offset: number) => toISODate(addDays(now, offset))
  const stamp = (offset: number, hour = 10) => setMinutes(setHours(addDays(startOfDay(now), offset), hour), Math.floor(r() * 60)).toISOString()
  let n = 0
  const id = (p: string) => `${p}_${(n++).toString(36)}`

  const makeFiles = (count: number, base: string, offset: number, final = false): Attachment[] =>
    Array.from({ length: count }, (_, i) => {
      const kind = fileKinds[Math.floor(r() * fileKinds.length)]!
      return {
        id: id('f'),
        name: `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${['v1', 'v2', 'final', 'draft', 'export'][i % 5]}.${ext[kind]}`,
        kind,
        size: `${(r() * 40 + 0.4).toFixed(1)} MB`,
        addedAt: stamp(offset + i),
        final: final || i === count - 1,
      }
    })

  const clients: Client[] = clientSeeds.map((c, i) => ({
    id: c.id,
    name: c.name,
    contact: c.contact,
    email: `${c.contact.split(' ').slice(-1)[0]!.toLowerCase()}@${c.website}`,
    phone: ['+91 80 4000 1200', '+47 22 00 45 10', '+81 75 000 3321', '+351 21 000 8800', '+212 524 00 11 22', '+1 416 000 2211', '+254 20 000 7788', '+52 55 0000 1100'][i]!,
    website: c.website,
    location: c.location,
    industry: c.industry,
    notes: c.notes,
    hue: c.hue,
    files: makeFiles(2, `${c.name} brand assets`, -60),
    createdAt: stamp(-400 + i * 30),
  }))

  const projects: Project[] = []
  const tasks: Task[] = []

  for (const s of projectSeeds) {
    const done = s.completedOffset !== undefined
    projects.push({
      id: s.id,
      name: s.name,
      clientId: s.client,
      type: s.type,
      description: s.description,
      brief: s.brief || s.description,
      startDate: day(s.start),
      deadline: day(s.due),
      priority: s.priority,
      statusId: s.status,
      tags: s.tags,
      memberIds: s.members,
      software: s.software,
      attachments: makeFiles(done ? 4 : 2 + Math.floor(r() * 3), s.name, s.start + 2, done),
      links: [
        { id: id('l'), label: 'Figma file', url: `https://figma.com/file/${s.id}` },
        ...(r() > 0.5 ? [{ id: id('l'), label: 'Moodboard', url: `https://are.na/designflow/${s.id}` }] : []),
      ],
      notes: done ? 'Wrapped on time. Client reused the system for two follow-up jobs.' : 'Next check-in with the client is on Thursday. Keep file names consistent: project-asset-version.',
      cover: { hue: (clientSeeds.find((c) => c.id === s.client)?.hue ?? 200) + Math.floor(r() * 40 - 20), shape: Math.floor(r() * 4) },
      createdAt: stamp(s.start - 2),
      completedAt: done ? stamp(s.completedOffset!, 17) : undefined,
      leadId: s.members[1] ?? s.members[0] ?? null,
      ...packSeeds[s.id],
    })

    for (const [title, status, dueOffset, priority, estimate] of s.tasks) {
      const isDone = status === 'st_completed' || status === 'st_approved'
      const assignee = s.members[Math.floor(r() * s.members.length)] ?? null
      const commentCount = Math.floor(r() * 3)
      tasks.push({
        id: id('t'),
        projectId: s.id,
        title,
        statusId: status,
        deadline: day(dueOffset),
        priority,
        estimate,
        assigneeId: assignee,
        notes: r() > 0.5 ? 'Reference the latest brand guidelines. Export at 2x for social.' : '',
        attachments: r() > 0.4 ? makeFiles(1 + Math.floor(r() * 2), title, dueOffset - 4) : [],
        comments: Array.from({ length: commentCount }, (_, k) => ({
          id: id('cm'),
          authorId: members[Math.floor(r() * members.length)]!.id,
          body: commentBank[Math.floor(r() * commentBank.length)]!,
          at: stamp(Math.min(-1, dueOffset - 3 + k), 11 + k),
        })),
        createdAt: stamp(s.start),
        completedAt: isDone ? stamp(Math.min(dueOffset, -1), 16) : undefined,
      })
    }
  }

  // A few loose, personal tasks due today so the dashboard feels alive.
  tasks.push(
    { id: id('t'), projectId: 'p_summer', title: 'Send moodboard to Priya', statusId: 'st_progress', deadline: day(0), priority: 'medium', estimate: 1, assigneeId: 'm_me', notes: '', attachments: [], comments: [], createdAt: stamp(-1) },
    { id: id('t'), projectId: 'p_nordlys', title: 'Prep logo presentation', statusId: 'st_brief', deadline: day(0), priority: 'high', estimate: 2, assigneeId: 'm_me', notes: 'Show three routes, recommend route B.', attachments: [], comments: [], createdAt: stamp(-2) },
  )

  // Time entries: working sessions over the last year, on whatever was live at the time.
  const entries: TimeEntry[] = []
  const active = projects.filter((p) => !p.completedAt)
  const liveOn = (d: number) => {
    const iso = day(d)
    return projects.filter((p) => p.startDate <= iso && (p.completedAt ? p.completedAt.slice(0, 10) : p.deadline) >= iso)
  }
  for (let d = -330; d <= 0; d++) {
    const date = addDays(now, d)
    const dow = date.getDay()
    if (dow === 0 || (dow === 6 && r() > 0.25)) continue
    const sessions = d === 0 ? 2 : 1 + Math.floor(r() * 3)
    let hour = 9 + Math.floor(r() * 2)
    for (let k = 0; k < sessions; k++) {
      const live = liveOn(d)
      const pool = live.length ? live : d > -25 ? active : []
      if (!pool.length) continue
      const p = pool[Math.floor(r() * pool.length)]!
      const ptasks = tasks.filter((t) => t.projectId === p.id)
      const t = ptasks.length ? ptasks[Math.floor(r() * ptasks.length)]! : null
      const minutes = 45 + Math.floor(r() * 150)
      const start = setMinutes(setHours(startOfDay(date), hour), Math.floor(r() * 30)).getTime()
      const end = Math.min(start + minutes * 60000, d === 0 ? now.getTime() - 15 * 60000 : Infinity)
      if (end > start) entries.push({ id: id('te'), projectId: p.id, taskId: t?.id ?? null, memberId: 'm_me', start, end, note: '' })
      hour += Math.ceil(minutes / 60) + 1
    }
  }

  const events: CalendarEvent[] = [
    { id: id('ev'), title: 'Key visual review with iD Fresh', date: day(0), kind: 'review', projectId: 'p_summer' },
    { id: id('ev'), title: 'Dosa pack sign-off', date: day(1), kind: 'approval', projectId: 'p_dosa' },
    { id: id('ev'), title: 'Nordlys logo presentation', date: day(3), kind: 'review', projectId: 'p_nordlys' },
    { id: id('ev'), title: 'Verde usability test in Lisbon', date: day(11), kind: 'milestone', projectId: 'p_verde_app' },
    { id: id('ev'), title: 'Lumen handoff approval', date: day(3), kind: 'approval', projectId: 'p_lumen' },
    { id: id('ev'), title: 'Summer campaign goes live', date: day(14), kind: 'milestone', projectId: 'p_summer' },
    { id: id('ev'), title: 'Kora motion review', date: day(2), kind: 'review', projectId: 'p_kora' },
    { id: id('ev'), title: 'Kōbō homepage review', date: day(5), kind: 'review', projectId: 'p_kobo_web' },
    { id: id('ev'), title: 'Museo exhibition opens', date: day(52), kind: 'milestone', projectId: 'p_museo' },
  ]

  const notifications: AppNotification[] = [
    { id: id('n'), kind: 'review', title: 'Review requested', body: 'Sofia asked you to review “Key Visual” for Summer Campaign.', at: stamp(0, 8), projectId: 'p_summer' },
    { id: id('n'), kind: 'approval', title: 'Waiting for approval', body: 'Omar needs your sign-off on “Front of pack layout”.', at: stamp(-1, 16), projectId: 'p_dosa' },
    { id: id('n'), kind: 'comment', title: 'New comment', body: 'Henrik: “Could we see one version without the pattern?”', at: stamp(-1, 11), projectId: 'p_nordlys' },
    { id: id('n'), kind: 'assignment', title: 'You were assigned', body: 'Amara assigned you “Homepage design” in Kōbō Online Store.', at: stamp(-2, 14), projectId: 'p_kobo_web' },
    { id: id('n'), kind: 'comment', title: 'New comment', body: 'Kenji uploaded a new version of the welcome animation.', at: stamp(-3, 10), projectId: 'p_kora' },
  ]

  return {
    statuses: DEFAULT_STATUSES,
    members,
    clients,
    projects,
    tasks,
    events,
    entries,
    notifications,
    settings: { theme: 'dark', currentUserId: 'm_me', workspaceName: 'Studio North', weekStartsOn: 1, mode: 'team' },
  }
}

