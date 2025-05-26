```tsx
// app/dashboard/forms/new/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types'; // Assuming you have this file
import { v4 as uuidv4 } from 'uuid';

interface FormField {
  id: string; // For unique key in React lists
  label: string;
  type: 'text' | 'email' | 'phone' | 'id_number' | 'textarea';
  required: boolean;
}

export default function NewFormPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [premiseId, setPremiseId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [qrIdentifier, setQrIdentifier] = useState<string | null>(null); // State for QR identifier

  useEffect(() => {
    const fetchUserAndPremise = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        router.push('/login');
        return;
      }
      setUser(session.user);

      const { data: premiseData, error: premiseError } = await supabase
        .from('premises')
        .select('id')
        .eq('owner_id', session.user.id)
        .single();

      if (premiseError || !premiseData) {
        setError('Could not retrieve premise information. Please ensure your profile is complete.');
        setLoading(false);
        return;
      }
      setPremiseId(premiseData.id);
      setLoading(false);
    };

    fetchUserAndPremise();
  }, [supabase, router]);

  const addField = () => {
    setFields([...fields, { id: uuidv4(), label: '', type: 'text', required: false }]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(field => field.id !== id));
  };

  const handleFieldChange = (id: string, property: keyof FormField, value: string | boolean) => {
    setFields(prevFields =>
      prevFields.map(field =>
        field.id === id ? { ...field, [property]: value } : field
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!premiseId || !user) {
      setError("User or premise information is missing. Cannot save form.");
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');

    const formDefinitionForDb = fields.map(({ id, ...rest }) => rest);

    const { data: newForm, error: insertError } = await supabase
      .from('forms')
      .insert([{
        name: formName,
        definition: formDefinitionForDb,
        premise_id: premiseId,
        owner_id: user.id 
      }])
      .select()
      .single();

    if (insertError) {
      setError(`Error creating form: ${insertError.message}`);
      setSaving(false);
      return;
    }

    if (newForm) {
      setMessage('Form created successfully! Generating QR Code...');
      // Call the API to ensure QR code is generated/retrieved
      try {
        const response = await fetch(`/api/forms/${newForm.id}/ensure-qr-record`, {
          method: 'POST',
        });
        const qrData = await response.json();
        if (response.ok) {
          setQrIdentifier(qrData.qr_identifier);
          setMessage(prev => `${prev} QR Code Identifier: ${qrData.qr_identifier}`);
          // Optionally redirect to the edit page or forms list after a delay
          setTimeout(() => router.push(`/dashboard/forms/${newForm.id}/edit`), 2000);
        } else {
          setError(`Error generating QR code: ${qrData.error || 'Unknown error'}`);
        }
      } catch (apiError: any) {
        setError(`Error calling QR code API: ${apiError.message}`);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div>;
  }

  if (error && !premiseId) {
    return <div className="text-red-500 text-center mt-10">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Create New Form</h1>
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">{message}</div>}
      {error && !message && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">{error}</div>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Editor Section */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
          <div>
            <label htmlFor="formName" className="block text-sm font-medium text-gray-700">
              Form Name
            </label>
            <input
              id="formName"
              name="formName"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Form Fields</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="mt-4 p-4 border border-gray-200 rounded-md">
                <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label htmlFor={`field-label-${field.id}`} className="block text-sm font-medium text-gray-700">
                      Label
                    </label>
                    <input
                      type="text"
                      id={`field-label-${field.id}`}
                      value={field.label}
                      onChange={(e) => handleFieldChange(field.id, 'label', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor={`field-type-${field.id}`} className="block text-sm font-medium text-gray-700">
                      Type
                    </label>
                    <select
                      id={`field-type-${field.id}`}
                      value={field.type}
                      onChange={(e) => handleFieldChange(field.id, 'type', e.target.value as FormField['type'])}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="id_number">ID Number</option>
                      <option value="textarea">Text Area</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1 flex items-center">
                    <input
                      id={`field-required-${field.id}`}
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => handleFieldChange(field.id, 'required', e.target.checked)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <label htmlFor={`field-required-${field.id}`} className="ml-2 block text-sm text-gray-900">
                      Required
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeField(field.id)}
                  className="mt-2 text-red-600 hover:text-red-800 text-sm"
                >
                  Remove Field
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addField}
              className="mt-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Field
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || saving}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Form'}
            </button>
          </div>
        </form>

        {/* Form Preview Section */}
        <div className="bg-gray-50 p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4 text-center">Form Preview</h2>
          {formName && <h3 className="text-lg font-semibold mb-4">{formName}</h3>}
          {fields.length === 0 && <p className="text-gray-500">Add fields to see a preview.</p>}
          {fields.map((field, index) => (
            <div key={`preview-${field.id}`} className="mb-4">
              <label htmlFor={`preview-field-${field.id}`} className="block text-sm font-medium text-gray-700">
                {field.label || `Field ${index + 1}`}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  id={`preview-field-${field.id}`}
                  disabled
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                  rows={3}
                ></textarea>
              ) : (
                <input
                  id={`preview-field-${field.id}`}
                  type={field.type === 'id_number' ? 'text' : field.type} // Keep as text for ID number for now
                  disabled
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 cursor-not-allowed"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```
