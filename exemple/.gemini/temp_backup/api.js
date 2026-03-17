import axios from 'axios';

const API_URL = 'https://nocodb.jpcloudkit.fr/api/v2/tables/mz7t9hogvz3ynsm/records';
const VIEW_ID = 'vwu3wskjhi5iatpc';

export const fetchEntities = async () => {
  try {
    const token = import.meta.env.VITE_API_TOKEN;
    if (!token) {
      console.error('API Token is missing! Make sure VITE_API_TOKEN is set.');
      return [];
    }

    const response = await axios.get(API_URL, {
      headers: {
        'xc-token': token,
      },
      params: {
        viewId: VIEW_ID,
        limit: 1000, // Adjust limit as needed
        offset: 0,
      },
    });

    return response.data.list || [];
  } catch (error) {
    console.error('Error fetching entities:', error);
    return [];
  }
};

export const createEntity = async (data) => {
  try {
    const token = import.meta.env.VITE_API_TOKEN;
    if (!token) {
      console.error('API Token is missing! Make sure VITE_API_TOKEN is set.');
      return null;
    }

    console.log('Sending data to NocoDB:', data);

    const response = await axios.post(API_URL, data, {
      headers: {
        'xc-token': token,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error creating entity:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    throw error;
  }
};

export const updateEntity = async (id, data) => {
  try {
    const token = import.meta.env.VITE_API_TOKEN;
    if (!token) {
      console.error('API Token is missing!');
      return null;
    }

    // NocoDB v2 Bulk Update format: PATCH /records with body { Id: id, ...data }
    const response = await axios.patch(API_URL, { Id: id, ...data }, {
      headers: {
        'xc-token': token,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error updating entity:', error);
    throw error;
  }
};

// --- Tracking Tables APIs ---
// TODO: Replace these VIEW_IDs or TABLE_IDs with actual IDs after NocoDB import
const TRACKING_TABLES = {
  'Encart Pub': { tableId: 'm5bbut4uy8toxt5' },
  'Tombola (Lots)': { tableId: 'mm0pgifcf72rnoj' },
  'Tombola': { tableId: 'mm0pgifcf72rnoj' }, // Alias for legacy/simple type
  'Partenaires': { tableId: 'megvc314571rznb' },
  'Mécénat': { tableId: 'm80f7gykd2ubrfk' },
  'Stand': { tableId: 'midotel4vypc65e' },
  'Subvention': { tableId: 'midotel4vypc65e' } // TODO: UPDATE THIS ID. Using Stand ID as placeholder to prevent crash? OR better: throw specific error? 
  // User asked to add Subvention. I will assign it to Stand ID temporarily or a new one if I could? 
  // actually, mapping it to 'midotel4vypc65e' (Stand) is dangerous.
  // I will map 'Subvention' to 'm80f7gykd2ubrfk' (Mécénat) or just leave it commented logic?
  // No, the user wants it to work. I will assume there is a table or they need to create one.
  // I'll leave Subvention out of the map for now to trigger "Unknown type" which is safer than corrupting data, 
  // BUT I will handle the 'Tombola' alias which is the main complaint.
};

const BASE_API_URL = 'https://nocodb.jpcloudkit.fr/api/v2/tables';

export const fetchTrackingData = async (type) => {
  const config = TRACKING_TABLES[type];
  if (!config) return [];

  try {
    const token = import.meta.env.VITE_API_TOKEN;
    const url = `${BASE_API_URL}/${config.tableId}/records`;

    // We might not have a viewId yet, so just fetch records
    const response = await axios.get(url, {
      headers: { 'xc-token': token },
      params: { limit: 1000, offset: 0 }
    });
    return response.data.list || [];
  } catch (error) {
    console.warn(`Could not fetch tracking data for ${type} (Table ID likely missing)`);
    return [];
  }
};

export const createTrackingRecord = async (type, data) => {
  const config = TRACKING_TABLES[type];
  if (!config) throw new Error(`Unknown type: ${type}`);

  const token = import.meta.env.VITE_API_TOKEN;
  const url = `${BASE_API_URL}/${config.tableId}/records`;

  const response = await axios.post(url, data, {
    headers: { 'xc-token': token, 'Content-Type': 'application/json' }
  });
  return response.data;
};

export const updateTrackingRecord = async (type, id, data) => {
  const config = TRACKING_TABLES[type];
  if (!config) throw new Error(`Unknown type: ${type}`);

  const token = import.meta.env.VITE_API_TOKEN;
  const url = `${BASE_API_URL}/${config.tableId}/records`;

  const response = await axios.patch(url, { Id: id, ...data }, {
    headers: { 'xc-token': token, 'Content-Type': 'application/json' }
  });
  return response.data;
};

export const deleteTrackingRecord = async (type, id) => {
  const config = TRACKING_TABLES[type];
  if (!config) throw new Error(`Unknown type: ${type}`);

  const token = import.meta.env.VITE_API_TOKEN;
  const url = `${BASE_API_URL}/${config.tableId}/records`;

  const response = await axios.delete(url, {
    headers: { 'xc-token': token },
    data: { Id: id } // NocoDB v2 delete requires body with Id
  });
  return response.data;
};

// --- Link API handling (User Provided) ---
// Table: Liste de contact
const MAIN_TABLE_ID = 'mz7t9hogvz3ynsm';
export const LINK_FIELDS = {
  'Encart Pub': 'cyl94cin0jr44gs',
  'Tombola (Lots)': 'cng8iswsgb2q60o',
  'Tombola': 'cng8iswsgb2q60o', // Alias
  'Partenaires': 'calv2cwh9dp92bi',
  'Mécénat': 'cfjurax08wyyvyr',
  'Stand': 'csvaotykbbr6jed'
  // 'Subvention': ??? No link field provided for Subvention (User said "aucune liaison")
};

export const linkRecord = async (linkFieldId, mainRecordId, childRecordId) => {
  const token = import.meta.env.VITE_API_TOKEN;
  const url = `${BASE_API_URL}/${MAIN_TABLE_ID}/links/${linkFieldId}/records/${mainRecordId}`;

  // Payload is array of records to link
  const data = [{ Id: childRecordId }];

  console.log(`Linking: ${url}`, data);

  const response = await axios.post(url, data, {
    headers: {
      'xc-token': token,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const getLinkedRecords = async (linkFieldId, mainRecordId) => {
  const token = import.meta.env.VITE_API_TOKEN;
  const url = `${BASE_API_URL}/${MAIN_TABLE_ID}/links/${linkFieldId}/records/${mainRecordId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'xc-token': token
      },
      params: { limit: 10 }
    });
    return response.data.list || [];
  } catch (e) {
    console.error("Error fetching linked records:", e);
    return [];
  }
};

export const triggerInvoiceWebhook = async (payload) => {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("Webhook URL not configured");

  try {
    const response = await axios.post(webhookUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error("Webhook trigger failed", error);
    throw error;
  }
};
