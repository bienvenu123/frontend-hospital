import React, { useState, useEffect, useCallback } from 'react';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getAppointmentsByPatient,
  getAppointmentsByDoctor
} from '../services/appointmentService';
import { getPatients, createPatient } from '../services/patientService';
import { getDoctors, getDoctor } from '../services/doctorService';
import { getDepartments } from '../services/departmentService';
import { createNotification } from '../services/notificationService';
import { getCurrentDoctorId, isDoctor } from '../utils/doctorUtils';
import ErrorDisplay from '../components/ErrorDisplay';
import ReportButton from '../components/ReportButton';
import './AppointmentsPage.css';

const AppointmentsPage = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Form state
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [patientType, setPatientType] = useState('existing'); // 'existing' or 'new'
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    department_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: '',
    status: 'scheduled'
  });
  const [newPatientData, setNewPatientData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    gender: '',
    address: ''
  });
  
  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    date: '',
    doctor_id: '',
    patient_id: ''
  });
  
  // Dropdown data
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      
      // If user is a doctor, only fetch their appointments
      if (isDoctor()) {
        const doctorId = await getCurrentDoctorId();
        if (doctorId) {
          response = await getAppointmentsByDoctor(doctorId);
        } else {
          setError('Doctor profile not found. Please contact administrator.');
          setAppointments([]);
          setLoading(false);
          return;
        }
      } else {
        // Admin can see all appointments or filtered appointments
        response = await getAppointments(filters);
      }
      
      setAppointments(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch appointments');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchPatients = useCallback(async () => {
    try {
      const response = await getPatients();
      setPatients(response.data || []);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      console.error('Error details:', err.data);
      // Don't show error to user in dropdown, just log it
      // The error will be visible in the console for debugging
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      const response = await getDoctors();
      let doctorsData = response.data || [];
      
      // If user is a doctor, only show themselves in the dropdown
      if (isDoctor()) {
        const doctorId = await getCurrentDoctorId();
        if (doctorId) {
          doctorsData = doctorsData.filter(d => d._id === doctorId);
        } else {
          doctorsData = [];
        }
      }
      
      setDoctors(doctorsData);
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await getDepartments();
      setDepartments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  }, []);

  // Fetch appointments on component mount and when filters change
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Fetch dropdown data on component mount
  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    fetchDepartments();
  }, [fetchPatients, fetchDoctors, fetchDepartments]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value || ''
    }));
  };

  const handleOpenModal = async (appointment = null) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setPatientType('existing'); // Always existing when editing
      const appointmentDate = appointment.appointment_date 
        ? new Date(appointment.appointment_date).toISOString().split('T')[0]
        : '';
      setFormData({
        patient_id: appointment.patient_id._id || appointment.patient_id || '',
        doctor_id: appointment.doctor_id._id || appointment.doctor_id || '',
        department_id: appointment.department_id._id || appointment.department_id || '',
        appointment_date: appointmentDate,
        appointment_time: appointment.appointment_time || '',
        reason: appointment.reason || '',
        status: appointment.status || 'scheduled'
      });
      setNewPatientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: ''
      });
    } else {
      setEditingAppointment(null);
      setPatientType('existing'); // Default to existing
      // If user is a doctor, auto-fill their doctor_id
      let doctorId = '';
      if (isDoctor()) {
        doctorId = await getCurrentDoctorId() || '';
      }
      setFormData({
        patient_id: '',
        doctor_id: doctorId,
        department_id: '',
        appointment_date: '',
        appointment_time: '',
        reason: '',
        status: 'scheduled'
      });
      setNewPatientData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        gender: '',
        address: ''
      });
    }
    setShowModal(true);
    setError(null);
    setSuccess(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
    setPatientType('existing');
    setFormData({
      patient_id: '',
      doctor_id: '',
      department_id: '',
      appointment_date: '',
      appointment_time: '',
      reason: '',
      status: 'scheduled'
    });
    setNewPatientData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      date_of_birth: '',
      gender: '',
      address: ''
    });
    setError(null);
    setSuccess(null);
  };

  const handleNewPatientChange = (e) => {
    const { name, value } = e.target;
    setNewPatientData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (formData.appointment_time && !timeRegex.test(formData.appointment_time)) {
      setError('Please provide valid time format (HH:MM)');
      return;
    }
    
    try {
      let patientId = formData.patient_id;
      
      // If creating new patient, create patient first
      if (!editingAppointment && patientType === 'new') {
        // Validate new patient data
        if (!newPatientData.first_name || !newPatientData.last_name || !newPatientData.email) {
          setError('Please fill in all required patient fields (First Name, Last Name, Email)');
          return;
        }
        
        const patientResponse = await createPatient(newPatientData);
        patientId = patientResponse.data._id;
        // Refresh patients list
        await fetchPatients();
      }
      
      const submitData = { ...formData, patient_id: patientId };
      // Convert date to ISO string
      if (submitData.appointment_date) {
        submitData.appointment_date = new Date(submitData.appointment_date).toISOString();
      }
      
      if (editingAppointment) {
        await updateAppointment(editingAppointment._id, submitData);
        setSuccess('Appointment updated successfully!');
      } else {
        const appointmentResponse = await createAppointment(submitData);
        const createdAppointment = appointmentResponse.data || appointmentResponse;
        
        // Notify the doctor about the new appointment
        try {
          await notifyDoctorAboutAppointment(submitData.doctor_id, createdAppointment, submitData);
        } catch (notifyErr) {
          // Don't fail the creation if notification fails, just log it
          console.warn('Failed to send notification to doctor:', notifyErr);
        }
        
        setSuccess(patientType === 'new' 
          ? 'Patient and appointment created successfully!' 
          : 'Appointment created successfully!');
      }
      
      handleCloseModal();
      fetchAppointments();
    } catch (err) {
      // Pass the full error object to show detailed validation errors
      setError(err);
    }
  };

  const handleDelete = async (appointmentId) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) {
      return;
    }
    
    setError(null);
    setSuccess(null);
    
    try {
      await deleteAppointment(appointmentId);
      setSuccess('Appointment deleted successfully!');
      fetchAppointments();
    } catch (err) {
      // Pass the full error object to show detailed validation errors
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

  const formatDateTime = (dateString, timeString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    return `${dateStr} at ${timeString || 'N/A'}`;
  };

  // Helper function to notify doctor about new appointment
  const notifyDoctorAboutAppointment = async (doctorId, appointment, submitData) => {
    try {
      // Get doctor details to find their user_id
      const doctorResponse = await getDoctor(doctorId);
      const doctor = doctorResponse.data || doctorResponse;
      
      // Extract user_id from doctor object (could be object or string)
      let doctorUserId = null;
      if (doctor.user_id) {
        doctorUserId = typeof doctor.user_id === 'object' 
          ? (doctor.user_id._id || doctor.user_id.id) 
          : doctor.user_id;
      }
      
      if (!doctorUserId) {
        console.warn('Doctor does not have a user_id, cannot send notification');
        return;
      }
      
      // Get patient name for notification message
      let patientName = 'A patient';
      if (submitData.patient_id) {
        const patient = patients.find(p => p._id === submitData.patient_id);
        if (patient) {
          patientName = `${patient.first_name} ${patient.last_name}`;
        }
      } else if (newPatientData.first_name) {
        patientName = `${newPatientData.first_name} ${newPatientData.last_name}`;
      }
      
      // Format appointment date and time
      const appointmentDate = submitData.appointment_date 
        ? new Date(submitData.appointment_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'TBD';
      const appointmentTime = submitData.appointment_time || 'TBD';
      
      // Create notification message
      const notificationMessage = `New appointment booked! ${patientName} has scheduled an appointment with you on ${appointmentDate} at ${appointmentTime}.${submitData.reason ? ` Reason: ${submitData.reason}` : ''}`;
      
      // Create notification for the doctor
      await createNotification({
        user_id: doctorUserId,
        message: notificationMessage,
        notification_type: 'appointment',
        is_read: false
      });
      
      console.log('✅ Notification sent to doctor:', doctorUserId);
    } catch (error) {
      console.error('Error notifying doctor:', error);
      throw error;
    }
  };

  const getPatientName = (patient) => {
    if (!patient) return 'N/A';
    if (typeof patient === 'object' && patient.first_name) {
      return `${patient.first_name} ${patient.last_name}`;
    }
    return 'N/A';
  };

  const getDoctorName = (doctor) => {
    if (!doctor) return 'N/A';
    if (typeof doctor === 'object' && doctor.first_name) {
      return `Dr. ${doctor.first_name} ${doctor.last_name}`;
    }
    return 'N/A';
  };

  const getStatusClass = (status) => {
    return `status-badge status-${status}`;
  };

  const appointmentStatuses = [
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no-show', label: 'No Show' }
  ];

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="appointments-page">
      <div className="appointments-header">
        <h1>Appointment Management</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {appointments.length > 0 && (
            <ReportButton
              data={appointments}
              entityType="appointments"
              title="Appointments Report"
              filters={filters}
            />
          )}
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            + Create Appointment
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="filter-status">Status:</label>
          <select
            id="filter-status"
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
          >
            <option value="">All</option>
            {appointmentStatuses.map(status => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="filter-date">Date:</label>
          <input
            type="date"
            id="filter-date"
            name="date"
            value={filters.date}
            onChange={handleFilterChange}
            className="filter-input"
          />
        </div>
        
        <div className="filter-group">
          <label htmlFor="filter-doctor">Doctor:</label>
          <select
            id="filter-doctor"
            name="doctor_id"
            value={filters.doctor_id}
            onChange={handleFilterChange}
          >
            <option value="">All Doctors</option>
            {doctors.map(doctor => (
              <option key={doctor._id} value={doctor._id}>
                Dr. {doctor.first_name} {doctor.last_name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label htmlFor="filter-patient">Patient:</label>
          <select
            id="filter-patient"
            name="patient_id"
            value={filters.patient_id}
            onChange={handleFilterChange}
          >
            <option value="">All Patients</option>
            {patients.map(patient => (
              <option key={patient._id} value={patient._id}>
                {patient.first_name} {patient.last_name}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className="btn btn-secondary" 
          onClick={() => setFilters({ status: '', date: '', doctor_id: '', patient_id: '' })}
        >
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

      {/* Appointments Table */}
      {loading ? (
        <div className="loading">Loading appointments...</div>
      ) : appointments.length === 0 ? (
        <div className="no-data">No appointments found</div>
      ) : (
        <div className="table-container">
          <table className="appointments-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Department</th>
                <th>Date & Time</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(appointment => (
                <tr key={appointment._id}>
                  <td className="patient-cell">
                    {getPatientName(appointment.patient_id)}
                    {appointment.patient_id && typeof appointment.patient_id === 'object' && (
                      <div className="patient-email">{appointment.patient_id.email}</div>
                    )}
                  </td>
                  <td className="doctor-cell">
                    {getDoctorName(appointment.doctor_id)}
                    {appointment.doctor_id && typeof appointment.doctor_id === 'object' && appointment.doctor_id.specialization && (
                      <div className="doctor-specialization">{appointment.doctor_id.specialization}</div>
                    )}
                  </td>
                  <td>
                    {appointment.department_id?.department_name || 'N/A'}
                  </td>
                  <td>
                    <div className="datetime-cell">
                      <div>{formatDate(appointment.appointment_date)}</div>
                      <div className="time">{appointment.appointment_time}</div>
                    </div>
                  </td>
                  <td className="reason-cell">
                    {appointment.reason || <span className="text-muted">No reason provided</span>}
                  </td>
                  <td>
                    <span className={getStatusClass(appointment.status)}>
                      {appointment.status}
                    </span>
                  </td>
                  <td>{formatDate(appointment.createdAt)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-edit"
                        onClick={() => handleOpenModal(appointment)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-sm btn-delete"
                        onClick={() => handleDelete(appointment._id)}
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
              <h2>{editingAppointment ? 'Edit Appointment' : 'Create New Appointment'}</h2>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              {/* Patient Type Selection - Only show when creating new appointment */}
              {!editingAppointment && (
                <div className="form-group">
                  <label>Patient Type *</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="patientType"
                        value="existing"
                        checked={patientType === 'existing'}
                        onChange={(e) => setPatientType(e.target.value)}
                      />
                      <span>Existing Patient</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="patientType"
                        value="new"
                        checked={patientType === 'new'}
                        onChange={(e) => setPatientType(e.target.value)}
                      />
                      <span>New Patient</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Patient Selection - Show for existing patients or when editing */}
              {patientType === 'existing' || editingAppointment ? (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="patient_id">Patient *</label>
                    <select
                      id="patient_id"
                      name="patient_id"
                      value={formData.patient_id}
                      onChange={handleInputChange}
                      required={patientType === 'existing' || editingAppointment}
                    >
                      <option value="">Select a patient</option>
                      {patients.map(patient => (
                        <option key={patient._id} value={patient._id}>
                          {patient.first_name} {patient.last_name} ({patient.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* New Patient Form Fields */
                <div className="new-patient-section">
                  <h3 className="section-title">Patient Information</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="first_name">First Name *</label>
                      <input
                        type="text"
                        id="first_name"
                        name="first_name"
                        value={newPatientData.first_name}
                        onChange={handleNewPatientChange}
                        required
                        minLength={2}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="last_name">Last Name *</label>
                      <input
                        type="text"
                        id="last_name"
                        name="last_name"
                        value={newPatientData.last_name}
                        onChange={handleNewPatientChange}
                        required
                        minLength={2}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email">Email *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={newPatientData.email}
                        onChange={handleNewPatientChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="phone">Phone</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={newPatientData.phone}
                        onChange={handleNewPatientChange}
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="date_of_birth">Date of Birth</label>
                      <input
                        type="date"
                        id="date_of_birth"
                        name="date_of_birth"
                        value={newPatientData.date_of_birth}
                        onChange={handleNewPatientChange}
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="gender">Gender</label>
                      <select
                        id="gender"
                        name="gender"
                        value={newPatientData.gender}
                        onChange={handleNewPatientChange}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="address">Address</label>
                    <textarea
                      id="address"
                      name="address"
                      value={newPatientData.address}
                      onChange={handleNewPatientChange}
                      rows="2"
                      placeholder="Enter patient address..."
                    />
                  </div>
                </div>
              )}

              <div className="form-row">

                <div className="form-group">
                  <label htmlFor="doctor_id">Doctor *</label>
                  {isDoctor() ? (
                    <input
                      type="text"
                      id="doctor_id"
                      value={doctors.find(d => d._id === formData.doctor_id) 
                        ? `Dr. ${doctors.find(d => d._id === formData.doctor_id).first_name} ${doctors.find(d => d._id === formData.doctor_id).last_name}`
                        : 'Loading...'}
                      disabled
                      className="disabled-input"
                      readOnly
                    />
                  ) : (
                  <select
                    id="doctor_id"
                    name="doctor_id"
                    value={formData.doctor_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a doctor</option>
                    {doctors.map(doctor => (
                      <option key={doctor._id} value={doctor._id}>
                        Dr. {doctor.first_name} {doctor.last_name} {doctor.specialization ? `(${doctor.specialization})` : ''}
                      </option>
                    ))}
                  </select>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="department_id">Department *</label>
                <select
                  id="department_id"
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select a department</option>
                  {departments.map(dept => (
                    <option key={dept._id} value={dept._id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="appointment_date">Appointment Date *</label>
                  <input
                    type="date"
                    id="appointment_date"
                    name="appointment_date"
                    value={formData.appointment_date}
                    onChange={handleInputChange}
                    required
                    min={today}
                  />
                  <small className="form-hint">Cannot be in the past</small>
                </div>

                <div className="form-group">
                  <label htmlFor="appointment_time">Appointment Time *</label>
                  <input
                    type="time"
                    id="appointment_time"
                    name="appointment_time"
                    value={formData.appointment_time}
                    onChange={handleInputChange}
                    required
                  />
                  <small className="form-hint">Format: HH:MM (24-hour)</small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reason">Reason</label>
                <textarea
                  id="reason"
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Enter appointment reason..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="status">Status *</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                >
                  {appointmentStatuses.map(status => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && <ErrorDisplay error={error} />}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAppointment ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;

