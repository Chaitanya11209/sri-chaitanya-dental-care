import { supabase } from '../supabaseClient';

export const createAppointment = async (formData: any) => {

  // STEP 1
  // Check existing patient by phone

  const { data: existingPatient } = await supabase
    .from('patients')
    .select('*')
    .eq('phone', formData.phone)
    .single();

  let patientId = null;

  // STEP 2
  // Existing patient

  if (existingPatient) {

    patientId = existingPatient.id;

  } else {

    // STEP 3
    // Create new patient

    const patientCode =
      `SDC-${Date.now()}`;

    const { data: newPatient, error } =
      await supabase
        .from('patients')
        .insert([
          {
            patient_code: patientCode,
            name: formData.name,
            phone: formData.phone,
            email: formData.email,
            location: formData.location,
          },
        ])
        .select()
        .single();

    if (error) {
      throw error;
    }

    patientId = newPatient.id;
  }

  // STEP 4
  // Count visits

  const { count } = await supabase
    .from('appointments')
    .select('*', {
      count: 'exact',
      head: true,
    })
    .eq('patient_id', patientId);

  const visitCount = (count || 0) + 1;

  // STEP 5
  // Create appointment

  const { data, error } = await supabase
    .from('appointments')
    .insert([
      {
        patient_id: patientId,

        name: formData.name,

        phone: formData.phone,

        email: formData.email,

        treatment: formData.service,

        next_visit: formData.date,

        appointment_time: formData.time,

        location: formData.location,

        notes: formData.message,

        visit_count: visitCount,

        visit_type:
          visitCount > 1
            ? 'Returning'
            : 'New',

        status: 'Pending',
      },
    ]);

  if (error) {
    throw error;
  }

  return data;
};