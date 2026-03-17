import axios from 'axios';

const TABLE_ID = 'moe8i4skffv3orv';
const API_URL = `https://nocodb.jpcloudkit.fr/api/v2/tables/${TABLE_ID}/records`;

const getHeaders = () => {
  const token = import.meta.env.VITE_API_TOKEN;
  if (!token) {
    console.error('VITE_API_TOKEN manquant dans .env');
  }
  return { 'xc-token': token };
};

export const fetchLocations = async () => {
  try {
    const response = await axios.get(API_URL, {
      headers: getHeaders(),
      params: { limit: 1000, offset: 0 }
    });
    return response.data.list || [];
  } catch (err) {
    console.error('Erreur fetchLocations:', err);
    return [];
  }
};

export const createLocation = async (data) => {
  try {
    const response = await axios.post(API_URL, data, {
      headers: getHeaders()
    });
    return response.data;
  } catch (err) {
    console.error('Erreur createLocation:', err);
    throw err;
  }
};

export const updateLocation = async (id, data) => {
  try {
    const response = await axios.patch(API_URL, [{ Id: id, ...data }], {
      headers: getHeaders()
    });
    return response.data;
  } catch (err) {
    console.error('Erreur updateLocation:', err);
    throw err;
  }
};

export const deleteLocation = async (id) => {
  try {
    await axios.delete(API_URL, {
      headers: getHeaders(),
      data: [{ Id: id }]
    });
  } catch (err) {
    console.error('Erreur deleteLocation:', err);
    throw err;
  }
};

// Parse GPS coords from Comments field: [GPS:lat,lng]
export const parseGPS = (comments) => {
  if (!comments) return null;
  const match = comments.match(/\[GPS:([-\d.]+),([-\d.]+)\]/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
};

// Strip GPS tag from Comments for display
export const stripGPS = (comments) => {
  if (!comments) return '';
  return comments.replace(/\[GPS:[-\d.,]+\]\n?/, '').trim();
};

// Build Comments with GPS tag
export const buildComments = (gps, existingComments) => {
  const base = `[GPS:${gps.lat.toFixed(6)},${gps.lng.toFixed(6)}]`;
  const existing = existingComments ? stripGPS(existingComments) : '';
  return existing ? `${base}\n${existing}` : base;
};

// Add a timestamped comment
export const addComment = (existingComments, newComment) => {
  const now = new Date();
  const timestamp = now.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const gpsMatch = existingComments ? existingComments.match(/\[GPS:[-\d.,]+\]/) : null;
  const gpsTag = gpsMatch ? gpsMatch[0] : '';
  const stripped = stripGPS(existingComments);
  const commentLine = `[${timestamp}] ${newComment}`;
  const parts = [stripped, commentLine].filter(Boolean).join('\n');
  return gpsTag ? `${gpsTag}\n${parts}` : parts;
};
