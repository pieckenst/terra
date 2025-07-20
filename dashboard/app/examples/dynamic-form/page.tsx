'use client';

import { useState, useEffect } from 'react';
import { DynamicForm, createFormModel, FormModel } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// Example model definitions
const userModel = createFormModel('User', [
  {
    name: 'name',
    label: 'Full Name',
    type: 'text',
    required: true,
    placeholder: 'John Doe',
    validation: {
      minLength: 3,
      message: 'Name must be at least 3 characters',
    },
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'john@example.com',
    validation: {
      pattern: '^[^\s@]+@[^\s@]+\.[^\s@]+$',
      message: 'Please enter a valid email',
    },
  },
  {
    name: 'role',
    label: 'Role',
    type: 'select',
    required: true,
    options: [
      { label: 'Admin', value: 'admin' },
      { label: 'Editor', value: 'editor' },
      { label: 'Viewer', value: 'viewer' },
    ],
  },
  {
    name: 'joinDate',
    label: 'Join Date',
    type: 'date',
    required: true,
  },
  {
    name: 'bio',
    label: 'Bio',
    type: 'textarea',
    placeholder: 'Tell us about yourself...',
  },
  {
    name: 'isActive',
    label: 'Active',
    type: 'checkbox',
    defaultValue: true,
  },
]);

const productModel = createFormModel('Product', [
  {
    name: 'name',
    label: 'Product Name',
    type: 'text',
    required: true,
  },
  {
    name: 'price',
    label: 'Price',
    type: 'number',
    required: true,
    validation: {
      min: 0,
      message: 'Price must be a positive number',
    },
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    options: [
      { label: 'Electronics', value: 'electronics' },
      { label: 'Clothing', value: 'clothing' },
      { label: 'Books', value: 'books' },
    ],
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
  },
  {
    name: 'inStock',
    label: 'In Stock',
    type: 'checkbox',
    defaultValue: true,
  },
]);

// Generic dynamic model generator from any API response
const generateDynamicModel = async (data: any): Promise<FormModel> => {
  // Use the existing generateDefaultModel utility for consistency
  // This will work for any shape of data (object/array)
  // If array, use the first item to infer the model
  const { generateDefaultModel } = await import('@/components/form/DynamicForm');
  if (Array.isArray(data) && data.length > 0) {
    return generateDefaultModel(data[0]);
  }
  return generateDefaultModel(data);
};

export default function DynamicFormExample() {
  const [activeTab, setActiveTab] = useState('user');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [operation, setOperation] = useState<'create' | 'read' | 'update' | 'delete'>('create');
  const [dynamicModel, setDynamicModel] = useState<FormModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState('');
  const [apiData, setApiData] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [crudLoading, setCrudLoading] = useState(false);

  // Load dynamic model from API URL
  const loadModelFromApi = async () => {
    if (!apiUrl) {
      setError('Please enter an API URL.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`Failed to fetch data: ${resp.status}`);
      const data = await resp.json();
      setApiData(data);
      const model = await generateDynamicModel(data);
      setDynamicModel(model);
      // Pre-fill formData for read/update if single object
      if (!Array.isArray(data)) setFormData(data);
      else if (Array.isArray(data) && data.length > 0) setFormData(data[0]);
      setSelectedIndex(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load data from API');
      setApiData(null);
      setDynamicModel(null);
    } finally {
      setIsLoading(false);
    }
  };

  // CRUD handlers for dynamic API
  const handleDynamicSubmit = async (data: any) => {
    if (!apiUrl || !dynamicModel) return;
    setCrudLoading(true);
    try {
      let method = 'POST';
      let url = apiUrl;
      if (operation === 'update' || operation === 'delete') {
        // Try to append ID if present
        const idField = dynamicModel.fields.find(f => /id$/i.test(f.name));
        if (idField && data[idField.name] !== undefined) {
          url = apiUrl.replace(/\/$/, '') + '/' + encodeURIComponent(data[idField.name]);
        }
        method = operation === 'update' ? 'PUT' : 'DELETE';
      }
      const reqOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        ...(operation !== 'delete' && { body: JSON.stringify(data) })
      };
      const resp = await fetch(url, reqOptions);
      if (!resp.ok) throw new Error(`${method} failed: ${resp.status}`);
      let respData: any = null;
      try { respData = await resp.json(); } catch {}
      toast.success(`${dynamicModel.name} ${operation}d successfully!`);
      // For create, switch to read mode with new data
      if (operation === 'create' && respData) {
        setFormData(respData);
        setOperation('read');
      } else if (operation === 'update' && respData) {
        setFormData(respData);
      } else if (operation === 'delete') {
        setFormData({});
        setOperation('create');
      }
      // Optionally reload list
      if (Array.isArray(apiData)) await loadModelFromApi();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${operation}`);
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDynamicDelete = async () => {
    await handleDynamicSubmit(formData);
  };

  
  // Sample data for read/update operations
  const sampleUserData = {
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
    joinDate: '2023-01-15T00:00:00.000Z',
    bio: 'Software developer with 5+ years of experience.',
    isActive: true,
  };

  const sampleProductData = {
    name: 'Wireless Headphones',
    price: 99.99,
    category: 'electronics',
    description: 'High-quality wireless headphones with noise cancellation.',
    inStock: true,
  };

  const currentModel = activeTab === 'user' 
    ? userModel 
    : activeTab === 'product' 
      ? productModel 
      : dynamicModel || { name: 'Dynamic', fields: [] };
      
  const sampleData = activeTab === 'user' 
    ? sampleUserData 
    : activeTab === 'product' 
      ? sampleProductData 
      : formData;

  const handleOperationChange = (op: 'create' | 'read' | 'update' | 'delete') => {
    setOperation(op);
    if (op === 'create') {
      setFormData({});
    } else {
      setFormData(sampleData);
    }
  };

  const handleSubmit = async (data: any) => {
    try {
      // In a real app, you would make an API call here
      console.log(`${operation} form submitted:`, data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Show success message
      toast.success(`${currentModel.name} ${operation === 'create' ? 'created' : 'updated'} successfully!`, {
        description: JSON.stringify(data, null, 2),
      });
      
      // For create operations, switch to read mode with the new data
      // For update operations, update the form data to reflect changes
      if (operation === 'create') {
        setFormData(data);
        setOperation('read');
      } else {
        setFormData(data);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error(`Failed to ${operation} ${currentModel.name.toLowerCase()}`);
    }
  };

  const handleDelete = async () => {
    try {
      // In a real app, you would make an API call here
      console.log('Deleting:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`${currentModel.name} deleted successfully!`);
      
      // Reset form and switch to create mode
      setFormData({});
      setOperation('create');
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error('Failed to delete item');
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Dynamic Form Generator</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="user">User Example</TabsTrigger>
            <TabsTrigger value="product">Product Example</TabsTrigger>
            <TabsTrigger value="dynamic">
              {isLoading ? 'Loading...' : 'Dynamic Example'}
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'dynamic' && (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                className="input input-bordered px-2 py-1 rounded border"
                placeholder="Enter API URL (e.g. http://localhost:5000/api/Buses)"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
                style={{ minWidth: 320 }}
                disabled={isLoading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadModelFromApi}
                disabled={isLoading || !apiUrl}
              >
                {isLoading ? 'Loading...' : 'Load'}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
                disabled={isLoading}
              >
                Regenerate Model
              </Button>
            </div>
          )}
        </div>
        
        <div className="space-y-4">
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {(['create', 'read', 'update', 'delete'] as const).map((op) => (
              <Button
                key={op}
                variant={operation === op ? 'default' : 'outline'}
                onClick={() => handleOperationChange(op)}
                className="capitalize"
              >
                {op}
              </Button>
            ))}
          </div>
                    <Card>
            <CardHeader>
              <CardTitle className="capitalize">{operation} {currentModel.name}</CardTitle>
              <CardDescription>
                {operation === 'create' && `Create a new ${currentModel.name.toLowerCase()}`}
                {operation === 'read' && `View ${currentModel.name.toLowerCase()} details`}
                {operation === 'update' && `Update ${currentModel.name.toLowerCase()}`}
                {operation === 'delete' && `Delete ${currentModel.name.toLowerCase()}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeTab === 'dynamic' && !dynamicModel ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="mb-4">Enter an API URL above and click <b>Load</b> to generate a dynamic form from any API response.</p>
                  <p>You can use any public API that returns a JSON object or array.</p>
                </div>
              ) : activeTab === 'dynamic' && dynamicModel ? (
                operation === 'delete' ? (
                  <div className="space-y-4">
                    <p className="text-destructive">
                      Are you sure you want to delete this {currentModel.name.toLowerCase()}? This action cannot be undone.
                    </p>
                    <div className="bg-muted p-4 rounded-md">
                      <pre className="text-sm overflow-auto">
                        {JSON.stringify(formData, null, 2)}
                      </pre>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => handleOperationChange('read')}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDynamicDelete} disabled={crudLoading}>
                        {crudLoading ? 'Deleting...' : 'Confirm Delete'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <DynamicForm
                    key={currentModel.name + operation}
                    model={currentModel}
                    operation={operation}
                    initialData={formData}
                    onSubmit={handleDynamicSubmit}
                    onCancel={operation === 'read' ? () => handleOperationChange('update') : undefined}
                    submitButtonText={
                      operation === 'create' ? 'Create' : 
                      operation === 'update' ? 'Update' : 'Save Changes'
                    }
                    cancelButtonText={operation === 'read' ? 'Edit' : 'Cancel'}
                  />
                )
              ) : (
                operation === 'delete' ? (
                  <div className="space-y-4">
                    <p className="text-destructive">
                      Are you sure you want to delete this {currentModel.name.toLowerCase()}? This action cannot be undone.
                    </p>
                    <div className="bg-muted p-4 rounded-md">
                      <pre className="text-sm overflow-auto">
                        {JSON.stringify(formData, null, 2)}
                      </pre>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => handleOperationChange('read')}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleDelete}>
                        Confirm Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <DynamicForm
                    key={currentModel.name + operation}
                    model={currentModel}
                    operation={operation}
                    initialData={formData}
                    onSubmit={handleSubmit}
                    onCancel={operation === 'read' ? () => handleOperationChange('update') : undefined}
                    submitButtonText={
                      operation === 'create' ? 'Create' : 
                      operation === 'update' ? 'Update' : 'Save Changes'
                    }
                    cancelButtonText={operation === 'read' ? 'Edit' : 'Cancel'}
                  />
                )
              )}
            </CardContent>
          </Card>
                    <Card className="bg-muted/50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Form Data</CardTitle>
                  <CardDescription>Current form state</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({})}
                  disabled={Object.keys(formData).length === 0}
                >
                  Clear Data
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-background p-4 rounded-md text-sm overflow-auto max-h-60">
                {Object.keys(formData).length > 0 
                  ? JSON.stringify(formData, null, 2)
                  : 'No form data yet. Fill out the form to see data here.'}
              </pre>
              {activeTab === 'dynamic' && Array.isArray(apiData) && apiData.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">API Data (select to edit):</h4>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {apiData.map((item: any, idx: number) => (
                      <Button
                        key={idx}
                        size="sm"
                        variant={selectedIndex === idx ? 'default' : 'outline'}
                        onClick={() => {
                          setFormData(item);
                          setSelectedIndex(idx);
                        }}
                      >
                        {item.id || item.name || item.email || `Item ${idx+1}`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'dynamic' && dynamicModel && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Generated Model:</h4>
                  <pre className="bg-background p-4 rounded-md text-xs overflow-auto max-h-60">
                    {JSON.stringify(dynamicModel, null, 2)}
                  </pre>
                </div>
              )}
              {error && <div className="text-destructive mt-2">{error}</div>}
            </CardContent>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
