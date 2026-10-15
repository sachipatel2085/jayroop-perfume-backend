/**
 * Social profiles – stored as full https URLs. Admins may type a handle ("@jayrup.in"),
 * a bare domain path ("instagram.com/jayrup.in") or a full URL; all become a full link.
 */
export const SOCIAL = {
  instagram: { label: 'Instagram', base: 'https://www.instagram.com/' },
  facebook: { label: 'Facebook', base: 'https://www.facebook.com/' },
  youtube: { label: 'YouTube', base: 'https://www.youtube.com/@' },
  x: { label: 'X (Twitter)', base: 'https://x.com/' },
  linkedin: { label: 'LinkedIn', base: 'https://www.linkedin.com/company/' },
  pinterest: { label: 'Pinterest', base: 'https://www.pinterest.com/' },
  threads: { label: 'Threads', base: 'https://www.threads.net/@' },
};
export const SOCIAL_KEYS = Object.keys(SOCIAL);

export const normaliseSocial = (key, value) => {
  let v = String(value || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v.replace(/^http:\/\//i, 'https://').slice(0, 300);
  if (/^(www\.)?[a-z0-9-]+\.[a-z.]+\//i.test(v)) return `https://${v}`.slice(0, 300); // instagram.com/handle
  v = v.replace(/^@/, '').replace(/\s+/g, '');
  return `${SOCIAL[key]?.base || 'https://'}${v}`.slice(0, 300);
};

/** [{ key, label, url }] for every profile that is filled in – used by the footer, contact page and schema sameAs. */
export const socialLinks = (business = {}) =>
  SOCIAL_KEYS.filter((k) => business[k]).map((k) => ({ key: k, label: SOCIAL[k].label, url: normaliseSocial(k, business[k]) }));
