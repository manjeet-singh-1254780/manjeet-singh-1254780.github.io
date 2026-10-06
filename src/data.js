// Default labour categories, preloaded Indian workforce data, and localized strings

export const LABOUR_CATEGORIES = [
  { id: 'all', nameEn: 'All Work', nameHi: 'सभी काम', icon: 'fa-solid fa-border-all' },
  { id: 'mason', nameEn: 'Mason', nameHi: 'राजमिस्त्री', icon: 'fa-solid fa-trowel-bricks' },
  { id: 'helper', nameEn: 'Helper / Beldar', nameHi: 'मज़दूर / बेलदार', icon: 'fa-solid fa-person-digging' },
  { id: 'carpenter', nameEn: 'Carpenter', nameHi: 'बढ़ई / कारपेंटर', icon: 'fa-solid fa-hammer' },
  { id: 'painter', nameEn: 'Painter', nameHi: 'पेंटर / रंगसाज', icon: 'fa-solid fa-paint-roller' },
  { id: 'electrician', nameEn: 'Electrician', nameHi: 'इलेक्ट्रीशियन', icon: 'fa-solid fa-bolt' },
  { id: 'plumber', nameEn: 'Plumber', nameHi: 'प्लंबर / नलसाज', icon: 'fa-solid fa-wrench' },
  { id: 'welder', nameEn: 'Welder', nameHi: 'वेल्डर / फैब्रिकेटर', icon: 'fa-solid fa-fire' },
  { id: 'farm_labour', nameEn: 'Farm Labour', nameHi: 'खेती मज़दूर', icon: 'fa-solid fa-wheat-awn' },
  { id: 'driver', nameEn: 'Driver / Tractor', nameHi: 'ड्राइवर / ट्रैक्टर', icon: 'fa-solid fa-truck-pickup' },
  { id: 'other', nameEn: 'Other', nameHi: 'अन्य कारीगर', icon: 'fa-solid fa-screwdriver-wrench' }
];

export const INITIAL_LABOURS = [
  {
    labourId: 'lab-101',
    ownerUserId: 'system',
    name: 'Ramu Mistri (रामू मिस्त्री)',
    mobile: '9876543210',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=faces',
    skill: 'Mason',
    category: 'mason',
    dailyPayment: 750,
    address: 'Near Old Bus Stand',
    city: 'Jaipur',
    village: 'Amer',
    availability: 'available', // available | busy | na
    experience: '12 Years',
    speciality: 'House construction, Tile fitting & Plaster work',
    createdAt: new Date().toISOString()
  },
  {
    labourId: 'lab-102',
    ownerUserId: 'system',
    name: 'Suresh Kumar (सुरेश कुमार)',
    mobile: '9823456781',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
    skill: 'Helper / Beldar',
    category: 'helper',
    dailyPayment: 500,
    address: 'Chungi Naka Road',
    city: 'Jaipur',
    village: 'Sanganer',
    availability: 'available',
    experience: '6 Years',
    speciality: 'Concrete mixing, loading, digging & heavy shifting',
    createdAt: new Date().toISOString()
  },
  {
    labourId: 'lab-103',
    ownerUserId: 'system',
    name: 'Dinesh Sharma (दिनेश बढ़ई)',
    mobile: '9711223344',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=faces',
    skill: 'Carpenter',
    category: 'carpenter',
    dailyPayment: 850,
    address: 'Kisan Market',
    city: 'Ajmer',
    village: 'Kishangarh',
    availability: 'busy',
    experience: '15 Years',
    speciality: 'Modular kitchen, doors, wooden roofing & furniture repair',
    createdAt: new Date().toISOString()
  },
  {
    labourId: 'lab-104',
    ownerUserId: 'system',
    name: 'Manoj Painter (मनोज पेंटर)',
    mobile: '9655443322',
    photo: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&h=200&fit=crop&crop=faces',
    skill: 'Painter',
    category: 'painter',
    dailyPayment: 700,
    address: 'Main Chowk',
    city: 'Jodhpur',
    village: 'Mandore',
    availability: 'available',
    experience: '8 Years',
    speciality: 'Wall putty, Asian paints, texture & water-proofing',
    createdAt: new Date().toISOString()
  },
  {
    labourId: 'lab-105',
    ownerUserId: 'system',
    name: 'Vinod Verma (विनोद बिजली)',
    mobile: '9544332211',
    photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&h=200&fit=crop&crop=faces',
    skill: 'Electrician',
    category: 'electrician',
    dailyPayment: 800,
    address: 'Industrial Area Phase 1',
    city: 'Alwar',
    village: 'Bhiwadi',
    availability: 'na',
    experience: '10 Years',
    speciality: 'House wiring, motor rewinding, inverter setup & MCB installation',
    createdAt: new Date().toISOString()
  },
  {
    labourId: 'lab-106',
    ownerUserId: 'system',
    name: 'Radheshyam (राधेश्याम खेती)',
    mobile: '9433221100',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=faces',
    skill: 'Farm Labour',
    category: 'farm_labour',
    dailyPayment: 450,
    address: 'Gaon Ka Rasta',
    city: 'Kota',
    village: 'Bundi',
    availability: 'available',
    experience: '14 Years',
    speciality: 'Harvesting, tractor tilling, crop spraying & tube-well handling',
    createdAt: new Date().toISOString()
  }
];

export const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_HI = [
  'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
  'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
];

export const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAYS_HI = ['रवि', 'सोम', 'मंगल', 'बुध', 'गुरु', 'शुक्र', 'शनि'];

export function formatINR(amount) {
  const num = Number(amount) || 0;
  return '₹' + num.toLocaleString('en-IN');
}
