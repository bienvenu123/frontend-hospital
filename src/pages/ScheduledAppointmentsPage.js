import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getDoctorSchedules
} from '../services/doctorScheduleService';
import {
  createAppointment,
  getAppointments
} from '../services/appointmentService';
import { getPatients, createPatient } from '../services/patientService';
import { getDoctors, getDoctor } from '../services/doctorService';
import { getDepartments } from '../services/departmentService';
import { createNotification } from '../services/notificationService';
import { isAuthenticated } from '../services/authService';
import ErrorDisplay from '../components/ErrorDisplay';
import HospitalLogo from '../components/HospitalLogo';
import './ScheduledAppointmentsPage.css';

const ScheduledAppointmentsPage = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [scheduleBookings, setScheduleBookings] = useState({}); // Track bookings per schedule
  
  // Form state for booking
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [patientType, setPatientType] = useState('existing'); // 'existing' or 'new'
  const [formData, setFormData] = useState({
    patient_id: '',
    doctor_id: '',
    department_id: '',
    appointment_date: '',
    appointment_time: '',
    reason: '',
    status: 'scheduled',
    schedule_start_time: '',
    schedule_end_time: ''
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
  
  // Dropdown data
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Helper function to convert day of week to next occurrence date
  const getNextDateForDay = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayIndex = days.indexOf(dayOfWeek);
    if (dayIndex === -1) return null;
    
    const today = new Date();
    const currentDay = today.getDay();
    let daysUntilTarget = dayIndex - currentDay;
    
    // If the day has passed this week, get next week's occurrence
    if (daysUntilTarget < 0) {
      daysUntilTarget += 7;
    }
    // If today is the target day, we'll use next week to give user time
    if (daysUntilTarget === 0) {
      daysUntilTarget = 7;
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);
    
    // Format as YYYY-MM-DD for date input
    return targetDate.toISOString().split('T')[0];
  };

  const fetchSchedules = useCallback(async () => {
    // Helper function to get appointments count for a schedule (moved inside to avoid dependency issues)
    const getAppointmentsCountForSchedule = async (schedule) => {
      try {
        const doctorId = typeof schedule.doctor_id === 'object' 
          ? schedule.doctor_id._id 
          : schedule.doctor_id;
        
        if (!doctorId) return 0;
        
        // Get next occurrence date for this schedule's day
        const appointmentDate = getNextDateForDay(schedule.day_of_week);
        if (!appointmentDate) return 0;
        
        // Format date for API (YYYY-MM-DD)
        const dateForAPI = appointmentDate;
        
        // Fetch appointments for this doctor and date
        const response = await getAppointments({
          doctor_id: doctorId,
          date: dateForAPI,
          status: 'scheduled' // Only count scheduled appointments
        });
        
        const appointments = response.data || [];
        
        // Count appointments within the schedule's time range
        const [startHour, startMin] = schedule.start_time.split(':').map(Number);
        const [endHour, endMin] = schedule.end_time.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        const appointmentsInRange = appointments.filter(apt => {
          if (!apt.appointment_time) return false;
          const [aptHour, aptMin] = apt.appointment_time.split(':').map(Number);
          const aptMinutes = aptHour * 60 + aptMin;
          return aptMinutes >= startMinutes && aptMinutes <= endMinutes;
        });
        
        return appointmentsInRange.length;
      } catch (err) {
        console.error('Error fetching appointments count:', err);
        return 0;
      }
    };

    setLoading(true);
    setError(null);
    try {
      const response = await getDoctorSchedules();
      const schedulesData = response.data || [];
      setSchedules(schedulesData);
      
      // Fetch booking counts for each schedule
      const bookingCounts = {};
      for (const schedule of schedulesData) {
        const count = await getAppointmentsCountForSchedule(schedule);
        bookingCounts[schedule._id] = count;
      }
      setScheduleBookings(bookingCounts);
    } catch (err) {
      const errorMessage = err.message || 
                          (err.data && err.data.message) ||
                          (err.data && err.data.errors && Array.isArray(err.data.errors) 
                            ? err.data.errors.join(', ') 
                            : null) ||
                          'Failed to fetch doctor schedules';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    try {
      const response = await getPatients();
      setPatients(response.data || []);
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      const response = await getDoctors();
      setDoctors(response.data || []);
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

  // Fetch schedules on component mount
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Fetch dropdown data on component mount
  useEffect(() => {
    fetchPatients();
    fetchDoctors();
    fetchDepartments();
  }, [fetchPatients, fetchDoctors, fetchDepartments]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-fill department when doctor is selected
    if (name === 'doctor_id' && value) {
      const selectedDoctor = doctors.find(d => d._id === value);
      if (selectedDoctor && selectedDoctor.department_id) {
        // Get department ID from doctor object
        const departmentId = typeof selectedDoctor.department_id === 'object'
          ? (selectedDoctor.department_id._id || '')
          : selectedDoctor.department_id;
        
        setFormData(prev => ({
          ...prev,
          [name]: value,
          department_id: departmentId || prev.department_id
        }));
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNewPatientChange = (e) => {
    const { name, value } = e.target;
    setNewPatientData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleOpenBookingModal = (schedule = null) => {
    setShowBookingModal(true);
    setPatientType('existing');
    
    if (schedule) {
      // Auto-fill from selected schedule
      const doctorId = typeof schedule.doctor_id === 'object' 
        ? schedule.doctor_id._id 
        : schedule.doctor_id;
      
      // Get department from doctor object - handle different data structures
      let departmentId = '';
      
      // First, try to get department from schedule's doctor object
      if (schedule.doctor_id && typeof schedule.doctor_id === 'object') {
        if (schedule.doctor_id.department_id) {
          // department_id could be an object with _id or just an ID string
          departmentId = typeof schedule.doctor_id.department_id === 'object'
            ? (schedule.doctor_id.department_id._id || '')
            : schedule.doctor_id.department_id;
        }
      }
      
      // If department not found in schedule, look up from doctors array
      if (!departmentId && doctorId) {
        const doctor = doctors.find(d => d._id === doctorId);
        if (doctor && doctor.department_id) {
          // department_id could be an object with _id or just an ID string
          departmentId = typeof doctor.department_id === 'object'
            ? (doctor.department_id._id || '')
            : doctor.department_id;
        }
      }
      
      // Convert day of week to actual date
      const appointmentDate = getNextDateForDay(schedule.day_of_week);
      
      // Set time to start_time, but user can change it to any time within the schedule range
      // The schedule shows the doctor is available from start_time to end_time
      setFormData({
        patient_id: '',
        doctor_id: doctorId || '',
        department_id: departmentId || '',
        appointment_date: appointmentDate || '',
        appointment_time: schedule.start_time || '',
        reason: '',
        status: 'scheduled',
        // Store schedule info for reference
        schedule_start_time: schedule.start_time,
        schedule_end_time: schedule.end_time,
        schedule_id: schedule._id // Store schedule ID for validation
      });
    } else {
      // Empty form for manual booking
      setFormData({
        patient_id: '',
        doctor_id: '',
        department_id: '',
        appointment_date: '',
        appointment_time: '',
        reason: '',
        status: 'scheduled',
        schedule_start_time: '',
        schedule_end_time: ''
      });
    }
    
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

  const handleCloseBookingModal = () => {
    setShowBookingModal(false);
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

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    // Validate required fields
    if (!formData.patient_id && patientType === 'existing') {
      setError('Please select a patient');
      return;
    }
    
    if (!formData.doctor_id) {
      setError('Please select a doctor');
      return;
    }
    
    if (!formData.department_id) {
      setError('Please select a department');
      return;
    }
    
    if (!formData.appointment_date) {
      setError('Please select an appointment date');
      return;
    }
    
    if (!formData.appointment_time) {
      setError('Please select an appointment time');
      return;
    }
    
    // Validate time format
    const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(formData.appointment_time)) {
      setError('Please provide valid time format (HH:MM)');
      return;
    }
    
    // Validate max patients limit
    if (formData.schedule_id) {
      const schedule = schedules.find(s => s._id === formData.schedule_id);
      if (schedule && schedule.max_patients) {
        const currentBookings = scheduleBookings[schedule._id] || 0;
        if (currentBookings >= schedule.max_patients) {
          setError(`This time slot is fully booked. Maximum ${schedule.max_patients} patient(s) allowed, and all slots are already taken. Please choose another schedule.`);
          return;
        }
      }
    }
    
    // Check if the specific time is already booked (before submitting to backend)
    try {
      const existingAppointmentsResponse = await getAppointments({
        doctor_id: formData.doctor_id,
        date: formData.appointment_date,
        status: 'scheduled'
      });
      
      const existingAppointments = existingAppointmentsResponse.data || [];
      const timeAlreadyBooked = existingAppointments.some(apt => {
        return apt.appointment_time === formData.appointment_time;
      });
      
      if (timeAlreadyBooked) {
        const formattedDate = new Date(formData.appointment_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        const timeRange = formData.schedule_start_time && formData.schedule_end_time 
          ? ` (Available times: ${formData.schedule_start_time} - ${formData.schedule_end_time})`
          : '';
        setError(`⚠️ This time has already been taken by another patient. The doctor already has an appointment on ${formattedDate} at ${formData.appointment_time}. Please choose another time${timeRange}.`);
        return;
      }
    } catch (checkErr) {
      // If we can't check, continue with booking and let backend validate
      console.warn('Could not check existing appointments, proceeding with booking:', checkErr);
    }
    
    try {
      let patientId = formData.patient_id;
      
      // If creating new patient, create patient first
      if (patientType === 'new') {
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
      
      // Prepare submit data - only include required fields and non-empty optional fields
      const submitData = {
        patient_id: patientId,
        doctor_id: formData.doctor_id,
        department_id: formData.department_id,
        appointment_date: new Date(formData.appointment_date).toISOString(),
        appointment_time: formData.appointment_time,
        status: formData.status || 'scheduled'
      };
      
      // Only include reason if it's provided
      if (formData.reason && formData.reason.trim()) {
        submitData.reason = formData.reason.trim();
      }
      
      console.log('Submitting appointment data:', submitData);
      
      const appointmentResponse = await createAppointment(submitData);
      const createdAppointment = appointmentResponse.data || appointmentResponse;
      
      // Notify the doctor about the new appointment
      try {
        await notifyDoctorAboutAppointment(formData.doctor_id, createdAppointment, formData, patientType === 'new' ? newPatientData : null);
      } catch (notifyErr) {
        // Don't fail the booking if notification fails, just log it
        console.warn('Failed to send notification to doctor:', notifyErr);
      }
      
      setSuccess(patientType === 'new' 
        ? 'Patient and appointment booked successfully!' 
        : 'Appointment booked successfully!');
      
      // Refresh the schedules list
      await fetchSchedules();
      
      // Close modal immediately to show success message
        handleCloseBookingModal();
      
      // Auto-dismiss success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Error booking appointment:', err);
      // Extract detailed error message
      let errorMessage = err.message || 
                          (err.data && err.data.message) ||
                          (err.data && err.data.errors && Array.isArray(err.data.errors) 
                            ? err.data.errors.join(', ') 
                            : null) ||
                          'Failed to book appointment. Please check all fields and try again.';
      
      // Provide user-friendly message for common errors
      if (errorMessage.includes('already has an appointment') || 
          errorMessage.includes('already booked') ||
          errorMessage.includes('time slot is taken') ||
          errorMessage.includes('appointment already exists')) {
        const formattedDate = new Date(formData.appointment_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        errorMessage = `⚠️ This time slot has already been taken by another patient. The selected doctor already has an appointment on ${formattedDate} at ${formData.appointment_time}. Please choose another time within the available schedule range.`;
      } else if (errorMessage.includes('Doctor not found')) {
        errorMessage = 'The selected doctor could not be found. Please refresh the page and try again.';
      } else if (errorMessage.includes('Patient not found')) {
        errorMessage = 'The selected patient could not be found. Please refresh the page and try again.';
      } else if (errorMessage.includes('Department not found')) {
        errorMessage = 'The selected department could not be found. Please refresh the page and try again.';
      }
      
      setError(errorMessage);
    }
  };

  const getDoctorName = (doctor) => {
    if (!doctor) return 'N/A';
    if (typeof doctor === 'object' && doctor.first_name) {
      return `Dr. ${doctor.first_name} ${doctor.last_name}`;
    }
    return 'N/A';
  };

  // Helper function to notify doctor about new appointment
  const notifyDoctorAboutAppointment = async (doctorId, appointment, formData, newPatientInfo = null) => {
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
      if (formData.patient_id) {
        const patient = patients.find(p => p._id === formData.patient_id);
        if (patient) {
          patientName = `${patient.first_name} ${patient.last_name}`;
        }
      } else if (newPatientInfo && newPatientInfo.first_name) {
        patientName = `${newPatientInfo.first_name} ${newPatientInfo.last_name}`;
      }
      
      // Format appointment date and time
      const appointmentDate = formData.appointment_date 
        ? new Date(formData.appointment_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'TBD';
      const appointmentTime = formData.appointment_time || 'TBD';
      
      // Create notification message
      const notificationMessage = `New appointment booked! ${patientName} has scheduled an appointment with you on ${appointmentDate} at ${appointmentTime}.${formData.reason ? ` Reason: ${formData.reason}` : ''}`;
      
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

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];
  const authenticated = isAuthenticated();

  return (
    <div className="scheduled-appointments-page">
      {/* Public Header */}
      <header className="public-header">
        <div className="public-header-content">
            <Link to="/" className="public-header-logo">
            <HospitalLogo size="small" shape="circle" />
            <h2>Kigali Specialized Orthopaedic Hospital</h2>
          </Link>
          <nav className="public-header-nav">
            <Link to="/" className="public-nav-link">
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z" fill="currentColor"/>
              </svg>
              <span>Home</span>
            </Link>
            {authenticated && (
              <Link to="/dashboard" className="public-nav-link">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z" fill="currentColor"/>
                </svg>
                <span>Dashboard</span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      <div className="scheduled-appointments-content">
        <div className="scheduled-appointments-header">
          <div>
            <h1>Doctor Schedules</h1>
            <p className="page-subtitle">View available doctor schedules and book appointments - No login required</p>
          </div>
          <button className="btn btn-primary btn-book" onClick={handleOpenBookingModal}>
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V8H19V19ZM17 10H7V12H17V10ZM15 14H7V16H15V14Z" fill="currentColor"/>
            </svg>
            <span>Book Appointment</span>
          </button>
        </div>

        {/* Success Message - Fixed at Top */}
        {success && (
          <div className="alert alert-success alert-success-fixed">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z" fill="currentColor"/>
            </svg>
            <span>{success}</span>
            <button 
              className="alert-close" 
              onClick={() => setSuccess(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}

        {/* Error Message */}
        {error && <ErrorDisplay error={error} />}

        {/* Doctor Schedules Display */}
        {loading ? (
          <div className="loading">Loading doctor schedules...</div>
        ) : (() => {
          // Filter out fully booked schedules - only show schedules with available slots
          const availableSchedules = schedules.filter(schedule => {
            // If no max_patients is set, always show the schedule
            if (!schedule.max_patients || schedule.max_patients === 0) {
              return true;
            }
            // If max_patients is set, only show if there are available slots
            const currentBookings = scheduleBookings[schedule._id] || 0;
            return currentBookings < schedule.max_patients;
          });
          
          return availableSchedules.length === 0 ? (
            <div className="no-appointments">
              <div className="no-appointments-icon">📅</div>
              <h3>No Available Schedules</h3>
              <p>All appointment slots are currently fully booked. Please check back later for available schedules.</p>
              <button className="btn btn-primary" onClick={handleOpenBookingModal}>
                Book Appointment
              </button>
            </div>
          ) : (
            <div className="appointments-grid">
              {availableSchedules.map(schedule => (
              <div key={schedule._id} className="appointment-card">
                <div className="appointment-card-header">
                  <div className="appointment-date-time">
                    <div className="date-display">
                      {schedule.day_of_week}
                    </div>
                    <div className="time-display">
                      ⏰ {schedule.start_time} - {schedule.end_time}
                    </div>
                  </div>
                  <span className="status-badge status-scheduled">
                    Available
                  </span>
                </div>
                
                <div className="appointment-card-body">
                  <div className="appointment-info-row">
                    <span className="info-label">👨‍⚕️ Doctor:</span>
                    <span className="info-value">
                      {getDoctorName(schedule.doctor_id)}
                      {schedule.doctor_id && typeof schedule.doctor_id === 'object' && schedule.doctor_id.specialization && (
                        <span className="info-specialization">({schedule.doctor_id.specialization})</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="appointment-info-row">
                    <span className="info-label">📅 Day:</span>
                    <span className="info-value">
                      {schedule.day_of_week}
                    </span>
                  </div>
                  
                  <div className="appointment-info-row">
                    <span className="info-label">⏰ Time Slot:</span>
                    <span className="info-value">
                      {schedule.start_time} - {schedule.end_time}
                    </span>
                  </div>
                  
                  <div className="appointment-info-row">
                    <span className="info-label">👥 Max Patients:</span>
                    <span className="info-value">
                      {schedule.max_patients || 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="appointment-card-footer">
                  {(() => {
                    const currentBookings = scheduleBookings[schedule._id] || 0;
                    const maxPatients = schedule.max_patients || 0;
                    const isFull = maxPatients > 0 && currentBookings >= maxPatients;
                    const availableSlots = maxPatients > 0 ? maxPatients - currentBookings : 'Unlimited';
                    
                    return (
                      <>
                        {maxPatients > 0 && (
                          <div className="booking-status" style={{ 
                            marginBottom: '0.75rem', 
                            padding: '0.5rem', 
                            backgroundColor: isFull ? '#fff3cd' : '#d1e7dd',
                            borderRadius: '4px',
                            fontSize: '0.875rem',
                            color: isFull ? '#856404' : '#0f5132',
                            textAlign: 'center'
                          }}>
                            {isFull ? (
                              <strong>⚠️ Fully Booked ({currentBookings}/{maxPatients})</strong>
                            ) : (
                              <strong>✅ Available: {availableSlots} of {maxPatients} slots</strong>
                            )}
                          </div>
                        )}
                        <button 
                          className={`btn btn-sm ${isFull ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => handleOpenBookingModal(schedule)}
                          disabled={isFull}
                          style={{ width: '100%', opacity: isFull ? 0.6 : 1, cursor: isFull ? 'not-allowed' : 'pointer' }}
                          title={isFull ? 'This time slot is fully booked' : 'Click to book this slot'}
                        >
                          {isFull ? 'Fully Booked' : 'Book This Slot'}
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="modal-overlay" onClick={handleCloseBookingModal}>
          <div className="modal-content booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📅 Book New Appointment</h2>
              <button className="modal-close" onClick={handleCloseBookingModal}>×</button>
            </div>
            
            <form onSubmit={handleBookAppointment}>
              {/* Error Display at top of form */}
              {error && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <ErrorDisplay error={error} />
                </div>
              )}

              {/* Patient Type Selection */}
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

              {/* Patient Selection */}
              {patientType === 'existing' ? (
                <div className="form-group">
                  <label htmlFor="patient_id">Patient *</label>
                  <select
                    id="patient_id"
                    name="patient_id"
                    value={formData.patient_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a patient</option>
                    {patients.map(patient => (
                      <option key={patient._id} value={patient._id}>
                        {patient.first_name} {patient.last_name} ({patient.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
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

              <div className="form-group">
                <label htmlFor="doctor_id">Doctor *</label>
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
                    min={formData.schedule_start_time || undefined}
                    max={formData.schedule_end_time || undefined}
                  />
                  <small className="form-hint">
                    {formData.schedule_start_time && formData.schedule_end_time 
                      ? `Select time between ${formData.schedule_start_time} and ${formData.schedule_end_time}`
                      : 'Format: HH:MM (24-hour)'}
                  </small>
                  {formData.schedule_start_time && formData.schedule_end_time && (
                    <small className="form-hint" style={{ display: 'block', marginTop: '0.25rem', color: '#dc3545' }}>
                      ⚠️ Note: If this time is already booked, try selecting a different time within this range.
                    </small>
                  )}
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

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseBookingModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Book Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduledAppointmentsPage;
