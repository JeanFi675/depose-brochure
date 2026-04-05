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

// Parse GPS coords from location object
// Priorité : champ dédié 'gps' ("lat;lng") > ancien format Comments [GPS:lat,lng]
export const parseGPS = (loc) => {
  if (!loc) return null;

  // Nouveau format : champ dédié gps ("lat;lng" ou "lat,lng")
  if (loc.gps) {
    const sep = loc.gps.includes(';') ? ';' : ',';
    const parts = loc.gps.split(sep);
    if (parts.length === 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }
  }

  // Rétrocompatibilité : ancien format Comments [GPS:lat,lng]
  if (loc.Comments) {
    const match = loc.Comments.match(/\[GPS:([-\d.]+),([-\d.]+)\]/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
  }

  return null;
};

// Strip GPS tag from Comments for display (rétrocompatibilité)
export const stripGPS = (comments) => {
  if (!comments) return '';
  return comments.replace(/\[GPS:[-\d.,]+\]\n?/, '').trim();
};

// Add a timestamped comment
export const addComment = (existingComments, newComment) => {
  const now = new Date();
  const timestamp = now.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Paris'
  });
  const stripped = stripGPS(existingComments);
  const commentLine = `[${timestamp}] ${newComment}`;
  return stripped ? `${stripped}\n${commentLine}` : commentLine;
};

// Reverse geocoding via Nominatim (OpenStreetMap)
export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    if (data && data.address) {
      const addr = data.address;
      const parts = [
        addr.house_number ? `${addr.house_number} ${addr.road || ''}` : (addr.road || ''),
        addr.postcode,
        addr.city || addr.town || addr.village || addr.municipality || ''
      ].filter(Boolean);
      return parts.join(', ');
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
  }
  return '';
};

// Lieux à proximité via Overpass API (OpenStreetMap)
export const fetchNearbyPlaces = async (lat, lng, radius = 50) => {
  try {
    const query = `
      [out:json];
      (
        node(around:${radius},${lat},${lng})["name"];
        way(around:${radius},${lat},${lng})["name"];
      );
      out center;
    `;
    const response = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    );
    const data = await response.json();
    return (data.elements || []).filter(el => {
      if (!el.tags || !el.tags.name) return false;
      const { amenity, shop, tourism, leisure, craft, office } = el.tags;
      if (!amenity && !shop && !tourism && !leisure && !craft && !office) return false;
      if (amenity === 'parking') return false;
      return true;
    });
  } catch (error) {
    console.error('Erreur fetchNearbyPlaces:', error);
    return [];
  }
};
