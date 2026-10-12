// Indian States / UTs with official GST state codes (used for place of supply & GSTR-1 reports)
export const INDIA_STATES = [
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '18', name: 'Assam' },
  { code: '10', name: 'Bihar' },
  { code: '04', name: 'Chandigarh' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '07', name: 'Delhi' },
  { code: '30', name: 'Goa' },
  { code: '24', name: 'Gujarat' },
  { code: '06', name: 'Haryana' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '20', name: 'Jharkhand' },
  { code: '29', name: 'Karnataka' },
  { code: '32', name: 'Kerala' },
  { code: '38', name: 'Ladakh' },
  { code: '31', name: 'Lakshadweep' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '27', name: 'Maharashtra' },
  { code: '14', name: 'Manipur' },
  { code: '17', name: 'Meghalaya' },
  { code: '15', name: 'Mizoram' },
  { code: '13', name: 'Nagaland' },
  { code: '21', name: 'Odisha' },
  { code: '34', name: 'Puducherry' },
  { code: '03', name: 'Punjab' },
  { code: '08', name: 'Rajasthan' },
  { code: '11', name: 'Sikkim' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '16', name: 'Tripura' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '19', name: 'West Bengal' },
];

const normalise = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z]/g, '');

const ALIASES = {
  orissa: 'Odisha',
  pondicherry: 'Puducherry',
  newdelhi: 'Delhi',
  nctofdelhi: 'Delhi',
  uttaranchal: 'Uttarakhand',
  jandk: 'Jammu and Kashmir',
  jammukashmir: 'Jammu and Kashmir',
  daman: 'Dadra and Nagar Haveli and Daman and Diu',
  damananddiu: 'Dadra and Nagar Haveli and Daman and Diu',
  dadraandnagarhaveli: 'Dadra and Nagar Haveli and Daman and Diu',
  andaman: 'Andaman and Nicobar Islands',
  up: 'Uttar Pradesh',
  mp: 'Madhya Pradesh',
  ap: 'Andhra Pradesh',
  tn: 'Tamil Nadu',
  wb: 'West Bengal',
};

export const findState = (input) => {
  const key = normalise(input);
  if (!key) return null;
  const direct = INDIA_STATES.find((s) => normalise(s.name) === key);
  if (direct) return direct;
  if (ALIASES[key]) return INDIA_STATES.find((s) => s.name === ALIASES[key]) || null;
  return INDIA_STATES.find((s) => normalise(s.name).startsWith(key) || key.startsWith(normalise(s.name))) || null;
};

export const stateCodeOf = (input) => findState(input)?.code || '';
export const canonicalStateName = (input) => findState(input)?.name || String(input || '').trim();
