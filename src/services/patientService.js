// API Base URL - Update this to match your backend API URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Patient Service
 * Handles all API calls related to patient management
 */

/**
 * Get all patients
 * @returns {Promise} Response data
 */
export const getPatients = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Provide more detailed error information
      const errorMessage = data.message || 
                          data.error || 
                          (data.errors && Array.isArray(data.errors) ? data.errors.join(', ') : null) ||
                          `Failed to fetch patients (Status: ${response.status})`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error.status) {
      throw error;
    }
    // Network or other errors
    throw new Error(`Network error: ${error.message}`);
  }
};

/**
 * Get a single patient by ID
 * @param {string} patientId - Patient ID
 * @returns {Promise} Response data
 */
export const getPatient = async (patientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch patient');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new patient
 * @param {Object} patientData - Patient data { first_name, last_name, gender, date_of_birth, phone, email, address }
 * @returns {Promise} Response data
 */
export const createPatient = async (patientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle validation errors from backend
      const errorMessage = data.message || 'Failed to create patient';
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data; // Include full error data (with errors array)
      throw error;
    }
    
    return data;
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error.status) {
      throw error;
    }
    // Network or other errors
    throw new Error(`Network error: ${error.message}`);
  }
};

/**
 * Update an existing patient
 * @param {string} patientId - Patient ID
 * @param {Object} patientData - Updated patient data { first_name, last_name, gender, date_of_birth, phone, email, address }
 * @returns {Promise} Response data
 */
export const updatePatient = async (patientId, patientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientData),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      // Handle validation errors from backend
      const errorMessage = data.message || 'Failed to update patient';
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data; // Include full error data (with errors array)
      throw error;
    }
    
    return data;
  } catch (error) {
    // If it's already our custom error, re-throw it
    if (error.status) {
      throw error;
    }
    // Network or other errors
    throw new Error(`Network error: ${error.message}`);
  }
};

/**
 * Delete a patient
 * @param {string} patientId - Patient ID
 * @returns {Promise} Response data
 */
export const deletePatient = async (patientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients/${patientId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete patient');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

/**
 * Search patients by query
 * @param {string} query - Search query (searches first_name, last_name, email, phone)
 * @returns {Promise} Response data
 */
export const searchPatients = async (query) => {
  try {
    const response = await fetch(`${API_BASE_URL}/patients/search/${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to search patients');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

