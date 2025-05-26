```tsx
// app/dashboard/forms/[formId]/edit/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { Database } from '@/lib/database.types'; // Assuming you have this file

interface FormField {
  id: string; // For unique key in React lists
  label: string;
  type: 'text' | 'email' | 'phone' | 'id_number' | 'textarea';
  required: boolean;
}

type Premise = Database['public']['Tables']['premises']['Row'];

export default function EditFormPage() {
  const router = useRouter();
  const params = useParams();
  const formId = params.formId as string;

  const supabase = createClientComponentClient<Database>();
  const [user, setUser] = useState<User | null>(null);
  const [premiseId, setPremiseId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [qrIdentifier, setQrIdentifier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchFormAndAssociatedData = useCallback(async (currentUserId: string) => {
    setLoading(true);
    setError('');
    setMessage('');

    // 1. Get Premise ID
    const { data: premiseData, error: premiseError } = await supabase
      .from('premises')
      .select('id')
      .eq('owner_id', currentUserId)
      .single();

    if (premiseError || !premiseData) {
      setError('Could not verify premise ownership or premise not found.');
      setLoading(false);
      return;
    }
    setPremiseId(premiseData.id);

    // 2. Fetch Form Data
    const { data: formData, error: formError } = await supabase
      .from('forms')
      .select('*, premise_id')
      .eq('id', formId)
      .eq('owner_id', currentUserId) // Ensure the user owns this form
      .single();

    if (formError || !formData) {
      setError('Form not found or you do not have permission to edit it.');
      setLoading(false);
      return;
    }

    // Ensure the form belongs to the user's premise
    if (formData.premise_id !== premiseData.id) {
        setError('Form does not belong to your premise.');
        setLoading(false);
        return;
    }

    setFormName(formData.name || '');
    setFields(formData.definition ? (formData.definition as unknown as FormField[]).map((f, i) => ({ ...f, id: f.id || `field-${i}-${Date.now()}`})) : []);


    // 3. Fetch or Create QR Code
    try {
      const response = await fetch(`/api/forms/${formId}/ensure-qr-record`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to ensure QR code');
      }
      const qrData = await response.json();
      setQrIdentifier(qrData.qr_identifier);
    } catch (apiError: any) {
      setError(`Error fetching/creating QR code: ${apiError.message}`);
      // Decide if this is critical enough to stop loading. For now, we'll continue.
    }

    setLoading(false);
  }, [supabase, formId]);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUser(session.user);
      await fetchFormAndAssociatedData(session.user.id);
    };
    initialize();
  }, [supabase, router, fetchFormAndAssociatedData]);

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
    setSaving(true);
    setError('');
    setMessage('');

    if (!user || !premiseId || !formId) {
      setError('User, premise, or form information is missing. Cannot save form.');
      setSaving(false);
      return;
    }

    const formDefinitionForDb = fields.map(({ id, ...rest }) => rest);

    const { error: updateError } = await supabase
      .from('forms')
      .update({
        name: formName,
        definition: formDefinitionForDb,
        updated_at: new Date().toISOString(),
      })
      .eq('id', formId)
      .eq('owner_id', user.id); // Ensure only the owner can update

    if (updateError) {
      setError(`Error updating form: ${updateError.message}`);
      setSaving(false);
      return;
    }

    // Re-ensure QR code in case it wasn't created or needs updating (though current logic just fetches/creates once)
    try {
      const response = await fetch(`/api/forms/${formId}/ensure-qr-record`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to ensure QR code after update');
      }
      const qrData = await response.json();
      setQrIdentifier(qrData.qr_identifier);
      setMessage('Form updated successfully!');
    } catch (apiError: any) {
      setError(`Error updating QR code: ${apiError.message}`);
    }

    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading form data...</div>;
  }

  if (error && !formName) { // Show error if form data couldn't be loaded
    return <div className="text-red-500 text-center mt-10">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Edit Form: {formName}</h1>
      {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">{message}</div>}
      {error && !message && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">{error}</div>}
      
      {qrIdentifier && (
        <div className="mb-4 p-4 bg-blue-100 border border-blue-300 rounded-md">
          <p className="text-sm font-medium text-gray-700">QR Code Identifier:</p>
          <p className="text-lg font-semibold text-blue-700 break-all">{qrIdentifier}</p>
        </div>
      )}

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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
```
