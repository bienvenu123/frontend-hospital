import React, { useState, useEffect } from 'react';
import {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  searchPatients
} from '../services/patientService';
import { getAppointmentsByDoctor } from '../services/appointmentService';
import { getCurrentDoctorId, isDoctor } from '../utils/doctorUtils';
import { getCurrentUser } from '../services/authService';
import ErrorDisplay from '../components/ErrorDisplay';
import ReportButton from '../components/ReportButton';
import './PatientsPage.css';

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    gender: 'male',
    date_of_birth: '',
    phone: '',
    email: '',
    address: ''
  });
  
  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Fetch patients on component mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Search patients when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      const timeoutId = setTimeout(() => {
        handleSearch(searchQuery);
      }, 500); // Debounce search by 500ms
      return () => clearTimeout(timeoutId);
    } else {
      fetchPatients();
    }
  }, [searchQuery]);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      let patientsData = [];
      
      // If user is a doctor, only fetch patients they have appointments with
      if (isDoctor()) {
        const doctorId = await getCurrentDoctorId();
        if (!doctorId) {
          // If doctor profile not found, show all patients with a warning message
          const currentUser = getCurrentUser();
          console.warn('Doctor profile not found for user:', currentUser);
          // Set a warning (not error) - we'll show it differently
          const warningMsg = `Note: Doctor profile not found for ${currentUser?.email || currentUser?.name || 'your account'}. Showing all patients. Please contact administrator to create a doctor profile linked to your account (${currentUser?.email || 'N/A'}) for better access control.`;
          // Use a success-style alert for warnings (less alarming)
          setError({ message: warningMsg, type: 'warning' });
          // Still show all patients instead of blocking access
          const response = await getPatients();
          patientsData = response.data || [];
        } else {
          try {
            const appointmentsRes = await getAppointmentsByDoctor(doctorId);
            const appointments = appointmentsRes.data || [];
            // Get unique patient IDs from appointments
            const patientIds = new Set(
              appointments.map(apt => {
                const patientId = typeof apt.patient_id === 'object' ? apt.patient_id._id : apt.patient_id;
                return patientId;
              }).filter(Boolean)
            );
            // Fetch all patients and filter by those with appointments
            const allPatientsRes = await getPatients();
            const allPatients = allPatientsRes.data || [];
            patientsData = allPatients.filter(patient => patientIds.has(patient._id));
          } catch (apptError) {
            console.error('Error fetching doctor appointments:', apptError);
            // If we can't fetch appointments, still try to show patients (fallback)
            const response = await getPatients();
            patientsData = response.data || [];
          }
        }
      } else {
        // Admin can see all patients
      const response = await getPatients();
        patientsData = response.data || [];
      }
      
      // Apply gender filter if set
      if (genderFilter) {
        patientsData = patientsData.filter(patient => patient.gender === genderFilter);
      }
      
      setPatients(patientsData);
    } catch (err) {
      // Pass the full error object to ErrorDisplay component
      setError(err);
      console.error('Error fetching patients:', err);
      console.error('Error details:', err.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      fetchPatients();
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      let patientsData = [];
      
      // If user is a doctor, search only among their patients
      if (isDoctor()) {
        const doctorId = await getCurrentDoctorId();
        if (doctorId) {
          const appointmentsRes = await getAppointmentsByDoctor(doctorId);
          const appointments = appointmentsRes.data || [];
          const patientIds = new Set(
            appointments.map(apt => {
              const patientId = typeof apt.patient_id === 'object' ? apt.patient_id._id : apt.patient_id;
              return patientId;
            }).filter(Boolean)
          );
          const searchRes = await searchPatients(query);
          const allSearchResults = searchRes.data || [];
          patientsData = allSearchResults.filter(patient => patientIds.has(patient._id));
        } else {
          setPatients([]);
          setLoading(false);
          return;
        }
      } else {
        // Admin can search all patients
      const response = await searchPatients(query);
        patientsData = response.data || [];
      }
      
      // Apply gender filter if set
      if (genderFilter) {
        patientsData = patientsData.filter(patient => patient.gender === genderFilter);
      }
      
      setPatients(patientsData);
    } catch (err) {
      // Pass the full error object to ErrorDisplay component
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterChange = (e) => {
    setGenderFilter(e.target.value);
  };

  const handleOpenModal = (patient = null) => {
    if (patient) {
      setEditingPatient(patient);
      // Format date for input field (YYYY-MM-DD)
      const dob = patient.date_of_birth 
        ? new Date(patient.date_of_birth).toISOString().split('T')[0]
        : '';
      setFormData({
        first_name: patient.first_name || '',
        last_name: patient.last_name || '',
        gender: patient.gender || 'male',
        date_of_birth: dob,
        phone: patient.phone || '',
        email: patient.email || '',
        address: patient.address || ''
      });
    } else {
      setEditingPatient(null);
      setFormData({
        first_name: '',
        last_name: '',
        gender: 'male',
        date_of_birth: '',
        phone: '',
        email: '',
        address: ''
      });
    }
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPatient(null);
    setFormData({
      first_name: '',
      last_name: '',
      gender: 'male',
      date_of_birth: '',
      phone: '',
      email: '',
      address: ''
    });
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    try {
      if (editingPatient) {
        await updatePatient(editingPatient._id, formData);
        setSuccess('Patient updated successfully!');
      } else {
        await createPatient(formData);
        setSuccess('Patient created successfully!');
      }
      
      handleCloseModal();
      fetchPatients();
    } catch (err) {
      // Pass the full error object to ErrorDisplay component
      setError(err);
    }
  };

  const handleDelete = async (patientId) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    
    try {
      await deletePatient(patientId);
      setSuccess('Patient deleted successfully!');
      fetchPatients();
    } catch (err) {
      // Pass the full error object to ErrorDisplay component
      setError(err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Apply gender filter to displayed patients
  const filteredPatients = genderFilter
    ? patients.filter(patient => patient.gender === genderFilter)
    : patients;

  return (
    <div className="patients-page">
      <div className="patients-header">
        <h1>Patient Management</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {filteredPatients.length > 0 && (
            <ReportButton
              data={filteredPatients}
              entityType="patients"
              title="Patients Report"
              filters={{ gender: genderFilter }}
            />
          )}
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Add New Patient
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="search-filters-section">
        <div className="search-group">
          <label htmlFor="search">Search:</label>
          <input
            type="text"
            id="search"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="btn-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ×
            </button>
          )}
        </div>
        
        <div className="filter-group">
          <label htmlFor="filter-gender">Gender:</label>
          <select
            id="filter-gender"
            value={genderFilter}
            onChange={handleFilterChange}
          >
            <option value="">All</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        
        <button className="btn btn-secondary" onClick={() => {
          setSearchQuery('');
          setGenderFilter('');
          fetchPatients();
        }}>
          Clear Filters
        </button>
      </div>

      {/* Messages */}
      {error && <ErrorDisplay error={error} />}
      
      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Patients Table */}
      {loading ? (
        <div className="loading">Loading patients...</div>
      ) : filteredPatients.length === 0 ? (
        <div className="no-data">
          {searchQuery ? 'No patients found matching your search' : 'No patients found'}
        </div>
      ) : (
        <div className="table-container">
          <table className="patients-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Date of Birth</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Address</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map(patient => (
                <tr key={patient._id}>
                  <td className="patient-name">
                    {patient.first_name} {patient.last_name}
                  </td>
                  <td>
                    <span className={`gender-badge gender-${patient.gender}`}>
                      {patient.gender}
                    </span>
                  </td>
                  <td>{patient.age || calculateAge(patient.date_of_birth)} years</td>
                  <td>{formatDate(patient.date_of_birth)}</td>
                  <td>{patient.phone}</td>
                  <td>{patient.email}</td>
                  <td className="address-cell">
                    {patient.address || <span className="text-muted">N/A</span>}
                  </td>
                  <td>{formatDate(patient.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-edit"
                        onClick={() => handleOpenModal(patient)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-delete"
                        onClick={() => handleDelete(patient._id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPatient ? 'Edit Patient' : 'Create New Patient'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="first_name">First Name *</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="last_name">Last Name *</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="gender">Gender *</label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="date_of_birth">Date of Birth *</label>
                  <input
                    type="date"
                    id="date_of_birth"
                    name="date_of_birth"
                    value={formData.date_of_birth}
                    onChange={handleInputChange}
                    required
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., +1234567890"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="patient@example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Enter patient address..."
                />
              </div>

              {error && <ErrorDisplay error={error} />}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPatient ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;

