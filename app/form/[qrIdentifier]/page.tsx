```tsx
// app/form/[qrIdentifier]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types'; // Assuming you have this file

interface FormField {
  label: string;
  type: 'text' | 'email' | 'phone' | 'id_number' | 'textarea';
  required: boolean;
  name?: string; // For form submission, derived from label
}

interface FormDataFromServer {
  name: string;
  definition: FormField[];
  formId: string;
  premiseId: string;
  qrCodeId: string;
}

export default function VisitorFormPage() {
  const params = useParams();
  const router = useRouter(); // Added useRouter
  const qrIdentifier = params.qrIdentifier as string;

  const supabase = createClientComponentClient<Database>();
  const [formData, setFormData] = useState<FormDataFromServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    if (!qrIdentifier) {
      setError('QR Code identifier is missing.');
      setLoading(false);
      return;
    }

    const fetchFormData = async () => {
      setLoading(true);
      setError(null);
      setMessage('');

      const { data: qrCodeData, error: qrError } = await supabase
        .from('qrcodes')
        .select('id, form_id, premise_id, is_active')
        .eq('qr_identifier', qrIdentifier)
        .single();

      if (qrError || !qrCodeData) {
        console.error('Error fetching QR code or QR code not found:', qrError?.message);
        setError('Invalid or expired QR code.');
        setLoading(false);
        return;
      }

      if (!qrCodeData.is_active) {
        setError('This QR code is no longer active.');
        setLoading(false);
        return;
      }

      const { data: formDetails, error: formError } = await supabase
        .from('forms')
        .select('id, name, definition, is_active, premise_id')
        .eq('id', qrCodeData.form_id)
        .single();

      if (formError || !formDetails) {
        console.error('Error fetching form details:', formError?.message);
        setError('Form not found or error fetching form details.');
        setLoading(false);
        return;
      }

      if (!formDetails.is_active) {
        setError('This form is no longer active.');
        setLoading(false);
        return;
      }

      // Ensure premise_id from QR code matches the form's premise_id for consistency
      if (formDetails.premise_id !== qrCodeData.premise_id) {
        console.error('Mismatch in premise ID between QR code and form.');
        setError('Form configuration error.'); // Generic error for user
        setLoading(false);
        return;
      }

      setFormData({
        name: formDetails.name || 'Visitor Form',
        definition: (formDetails.definition as FormField[] || []).map((field, index) => ({
          ...field,
          name: field.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || `field_${index}`
        })),
        formId: formDetails.id,
        premiseId: formDetails.premise_id,
        qrCodeId: qrCodeData.id,
      });
      setLoading(false);
    };

    fetchFormData();
  }, [supabase, qrIdentifier, router]);

  const handleInputChange = (fieldName: string, value: string) => {
    setFormValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreedToTerms) {
      setError('You must agree to the terms and conditions.');
      return;
    }
    if (!formData) {
        setError('Form data is not loaded yet.');
        return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const submissionData: { [key: string]: any } = {};
    formData.definition.forEach(field => {
      submissionData[field.label] = formValues[field.name || field.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')];
    });
    
    const { data: visitData, error: insertError } = await supabase
      .from('visits')
      .insert([{
        premise_id: formData.premiseId,
        form_id: formData.formId,
        qrcode_id: formData.qrCodeId,
        form_data: submissionData,
        status: 'checked_in', // Or any other initial status
      }])
      .select()
      .single();

    setSaving(false);

    if (insertError) {
      console.error('Error submitting form:', insertError);
      setError(`Error submitting form: ${insertError.message}`);
      setMessage('');
    } else {
      setMessage('Check-in successful! Thank you.');
      setFormValues({}); // Reset form fields
      setAgreedToTerms(false);
      // Optionally, you might want to redirect or show a more permanent success message
      // router.push('/thank-you'); // Example redirect
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading form...</p></div>;
  }

  if (error) {
    return <div className="text-red-500 text-center mt-10 p-4">{error}</div>;
  }

  if (!formData) {
    // This case should ideally be handled by the redirection in useEffect
    return <div className="text-center mt-10 p-4">Form not found or not active.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-lg">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">{formData.name}</h1>
        
        {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">{message}</div>}
        {error && !message && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="form_id" value={formData.formId} />
          <input type="hidden" name="premise_id" value={formData.premiseId} />
          <input type="hidden" name="qrcode_id" value={formData.qrCodeId} />
          {formData.definition.map((field, index) => {
            const fieldName = field.name || `field_${index}`; // Fallback if name isn't generated
            return (
              <div key={field.id || index} className="mb-4">
                <label htmlFor={fieldName} className="block text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={fieldName}
                    name={fieldName}
                    rows={3}
                    required={field.required}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formValues[fieldName] || ''}
                    onChange={(e) => handleInputChange(fieldName, e.target.value)}
                  />
                ) : (
                  <input
                    type={field.type === 'id_number' ? 'text' : field.type} // HTML5 doesn't have 'id_number' type, use 'text'
                    id={fieldName}
                    name={fieldName}
                    required={field.required}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formValues[fieldName] || ''}
                    onChange={(e) => handleInputChange(fieldName, e.target.value)}
                  />
                )}
              </div>
            );
          })}

          <div className="mt-6">
            <label htmlFor="terms" className="flex items-center">
              <input
                id="terms"
                name="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">I agree to the terms and conditions.</span>
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={saving || !agreedToTerms}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```
