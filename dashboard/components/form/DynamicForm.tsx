'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Calendar as CalendarIcon, HelpCircle, Loader2, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '../ui/calendar';
import { ScrollArea } from '../ui/scroll-area';
import { DynamicFormProps, FieldType, FormModel, ModelSource, InputType } from './types';
import { format } from 'date-fns';
import { AnimatedCard, Card, CardHeader } from '../ui/animated-card';
import { toast } from 'sonner';

async function fetchModel(source: ModelSource): Promise<FormModel> {
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch model from ${source}`);
    }
    return response.json();
  } else if (typeof source === 'function') {
    return source();
  }
  return source;
}

// This function is kept for backward compatibility but should only be used on the client
// For server-side usage, use the function from '@/lib/utils/form-utils'
import { generateDefaultModel as serverGenerateDefaultModel } from '@/lib/utils/form-utils';

export function generateDefaultModel(data: Record<string, any>): FormModel {
  if (typeof window === 'undefined') {
    throw new Error('generateDefaultModel should not be called on the server. Import it from @/lib/utils/form-utils instead.');
  }
  return serverGenerateDefaultModel(data);
}

interface ApiConfig {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  transformResponse?: (data: any) => any;
}

export function DynamicForm({
  model: modelSource,
  operation,
  initialData = {},
  onSubmit,
  onCancel,
  submitButtonText = 'Submit',
  cancelButtonText = 'Cancel',
  onModelLoaded,
  onModelError,
  apiConfig,
  onApiError,
}: DynamicFormProps & {
  apiConfig?: ApiConfig | ((data: any) => ApiConfig);
  onApiError?: (error: Error) => void;
}) {
  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [formModel, setFormModel] = useState<FormModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiData, setApiData] = useState<any>(null);
  
  // Derived state
  const isReadOnly = operation === 'read';
  // Only use useWatch if control is defined (inside form context)
  let formValues: any = undefined;
  try {
    // @ts-ignore: useWatch must be called inside a form context
    formValues = control ? useWatch({ control }) : undefined;
  } catch {}

  // Load the form model
  useEffect(() => {
    let isMounted = true;
    
    const loadModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        let model: FormModel;
        
        // If we have initial data but no model, generate one automatically
        if ((!modelSource || (typeof modelSource === 'object' && !('fields' in modelSource) || (modelSource as any).fields?.length === 0)) && Object.keys(initialData).length > 0) {
          model = generateDefaultModel(initialData);
        } else {
          model = await fetchModel(modelSource || { name: 'Form', fields: [] });
        }
        
        if (isMounted) {
          setFormModel(model);
          onModelLoaded?.(model);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load form model');
        if (isMounted) {
          setError(error);
          onModelError?.(error);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadModel();
    
    return () => {
      isMounted = false;
    };
  }, [modelSource, initialData, onModelLoaded, onModelError]);

  // Fetch API data if apiConfig is provided
  useEffect(() => {
    if (!apiConfig) return;

    const fetchApiData = async () => {
      try {
        const config = typeof apiConfig === 'function' 
          ? apiConfig(initialData) 
          : apiConfig;

        const { endpoint, method = 'GET', headers = {}, params } = config;
        
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          ...(params && { body: JSON.stringify(params) }),
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const transformedData = config.transformResponse 
          ? config.transformResponse(data) 
          : data;

        setApiData(transformedData);
      } catch (error) {
        console.error('Error fetching API data:', error);
        onApiError?.(error as Error);
        toast.error('Failed to load data from API');
      }
    };

    fetchApiData();
  }, [apiConfig, initialData, onApiError]);

  const handleSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      
      // If we have API data, merge it with the form data
      const submitData = apiData ? { ...data, ...apiData } : data;
      
      await onSubmit(submitData);
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!apiConfig) return;

    const fetchApiData = async () => {
      try {
        const config = typeof apiConfig === 'function' 
          ? apiConfig(initialData) 
          : apiConfig;

        const { endpoint, method = 'GET', headers = {}, params } = config;
        
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          ...(params && { body: JSON.stringify(params) }),
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const transformedData = config.transformResponse 
          ? config.transformResponse(data) 
          : data;

        setApiData(transformedData);
      } catch (error) {
        console.error('Error fetching API data:', error);
        onApiError?.(error as Error);
        toast.error('Failed to load data from API');
      }
    };

    fetchApiData();
  }, [apiConfig, initialData, onApiError]);

  // Initialize form with default values
  const defaultValues = useMemo(() => {
    if (!formModel) return {};
    
    return formModel.fields.reduce((acc, field) => {
      // Get the value from initialData or field.defaultValue
      let value = initialData[field.name] ?? field.defaultValue;
      
      // Ensure we have a proper default value based on field type
      if (value === undefined || value === null) {
        switch (field.type) {
          case 'checkbox':
            value = false;
            break;
          case 'number':
            value = 0;
            break;
          case 'date':
            value = '';
            break;
          case 'select':
            value = field.options?.[0]?.value ?? '';
            break;
          default:
            value = '';
        }
      }
      
      return {
        ...acc,
        [field.name]: value
      };
    }, {} as Record<string, any>);
  }, [formModel, initialData]);

  type FormValues = Record<string, any>;
  
  const { control, handleSubmit: handleFormSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues,
  });

  // Reset form when formModel changes
  useEffect(() => {
    if (formModel && Object.keys(defaultValues).length > 0) {
      const valuesToSet = { ...defaultValues };
      
      // Ensure all fields have a value
      formModel.fields.forEach(field => {
        if (!(field.name in valuesToSet)) {
          valuesToSet[field.name] = field.type === 'checkbox' ? false : '';
        }
      });
      
      // Only reset if values have actually changed
      reset(valuesToSet, {
        keepErrors: true,
        keepDirty: true,
        keepIsSubmitted: true,
        keepTouched: true,
        keepIsValid: true,
        keepSubmitCount: true,
      });
    }
  }, [formModel, JSON.stringify(defaultValues)]); // Using JSON.stringify to get stable dependency

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading form...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        <p className="font-medium">Error loading form</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  if (!formModel) {
    return (
      <div className="p-4 bg-muted/50 rounded-md text-muted-foreground">
        No form model available. Please provide a model or initial data.
      </div>
    );
  }

  const renderField = (field: any, fieldName: string) => {
    const fieldConfig = formModel.fields.find(f => f.name === fieldName);
    if (!fieldConfig) return null;
    
    // Memoize the field config to prevent unnecessary re-renders
    const memoizedFieldConfig = useMemo(() => fieldConfig, [fieldConfig]);
    
    // Ensure the field has a value (for controlled inputs)
    const value = useMemo(() => {
      if (field.value !== undefined && field.value !== null) {
        return field.value;
      }
      switch (memoizedFieldConfig.type) {
        case 'checkbox': return false;
        case 'number': return 0;
        default: return '';
      }
    }, [field.value, memoizedFieldConfig.type]);

    const error = errors[field.name];
    const commonProps = {
      ...field,
      disabled: isReadOnly,
      className: cn('w-full', { 'opacity-70 cursor-not-allowed': isReadOnly }),
    };

    switch (fieldConfig.type) {
      case 'select': {
        const [showHelp, setShowHelp] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);
        const buttonRef = useRef<HTMLButtonElement>(null);
        
        const options = useMemo(() => 
          (memoizedFieldConfig.options || []).map(opt => ({
            label: String(opt.label || opt.value),
            value: String(opt.value)
          })),
          [memoizedFieldConfig.options]
        );

        return (
          <div className="relative" ref={containerRef}>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={field.value || ''}
                onChange={(e) => field.onChange(e.target.value)}
                disabled={isReadOnly}
                placeholder={`Enter ${memoizedFieldConfig.label}`}
                className="flex-1"
              />
              {options.length > 0 && (
                <>
                  <Button 
                    ref={buttonRef}
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 p-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setShowHelp(!showHelp);
                    }}
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="sr-only">Show options</span>
                  </Button>
                  
                  <AnimatedCard 
                    isOpen={showHelp} 
                    triggerRef={{ current: containerRef.current }}
                    side="bottom"
                    align="start"
                    sideOffset={4}
                    avoidCollisions={true}
                    collisionPadding={8}
                  >
                    <Card className="w-64 border bg-background shadow-lg">
                      <CardHeader className="p-3 border-b">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Available Options</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowHelp(false);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <ScrollArea className="max-h-60 overflow-y-auto">
                        <div className="p-2">
                          {options.map((option) => (
                            <div 
                              key={option.value} 
                              className="p-2 rounded hover:bg-accent cursor-pointer"
                              onClick={() => {
                                field.onChange(option.value);
                                setShowHelp(false);
                              }}
                            >
                              <div className="font-medium">{option.label}</div>
                              <div className="text-xs text-muted-foreground">{option.value}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  </AnimatedCard>
                </>
              )}
            </div>
            {error && (
              <p className="mt-1 text-sm text-destructive">{error.message as string}</p>
            )}
          </div>
        );
      }
      case 'checkbox':
        return (
          <Checkbox
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={isReadOnly}
            className={cn('self-start mt-2', { 'opacity-70 cursor-not-allowed': isReadOnly })}
          />
        );
      case 'date': {
        const [showDatePicker, setShowDatePicker] = useState(false);
        const containerRef = useRef<HTMLDivElement>(null);
        const buttonRef = useRef<HTMLButtonElement>(null);

        return (
          <div className="relative" ref={containerRef}>
            <Button
              ref={buttonRef}
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !field.value && 'text-muted-foreground',
                { 'opacity-70 cursor-not-allowed': isReadOnly }
              )}
              disabled={isReadOnly}
              type="button"
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {field.value ? format(new Date(field.value), 'PPP') : <span>Pick a date</span>}
            </Button>
            
            <AnimatedCard 
              isOpen={showDatePicker}
              triggerRef={{ current: containerRef.current }}
              side="bottom"
              align="start"
              sideOffset={4}
              avoidCollisions={true}
              collisionPadding={8}
            >
              <Card className="border bg-background shadow-lg">
                <CardHeader className="p-3 border-b">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Select Date</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDatePicker(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <Calendar
                  mode="single"
                  selected={field.value ? new Date(field.value) : undefined}
                  onSelect={(date) => {
                    field.onChange(date?.toISOString());
                    setShowDatePicker(false);
                  }}
                  initialFocus
                  className="p-3"
                />
              </Card>
            </AnimatedCard>
          </div>
        );
      }
      case 'textarea':
        return <Textarea {...commonProps} value={value} rows={4} />;
      case 'checkbox':
        return (
          <Input 
            type="checkbox"
            {...commonProps}
            checked={Boolean(value)}
            className={cn(commonProps.className, 'h-4 w-4')}
          />
        );
      default: {
        // Type guard to ensure we only pass valid input types to the Input component
        const inputType: InputType = 
          fieldConfig.type === 'number' || 
          fieldConfig.type === 'email' || 
          fieldConfig.type === 'password' || 
          fieldConfig.type === 'text' 
            ? fieldConfig.type 
            : 'text';
            
        return (
          <Input 
            type={inputType}
            {...commonProps}
            value={value}
          />
        );
      }
    }
  };

  return (
    <form onSubmit={handleFormSubmit(handleSubmit)} className="space-y-6">
      <div className="space-y-4">
        {formModel.fields.map((fieldConfig) => (
          <div key={fieldConfig.name} className="space-y-2">
            <Label htmlFor={fieldConfig.name}>
              {fieldConfig.label}
              {fieldConfig.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Controller
              name={fieldConfig.name as any} // Using 'as any' to work around react-hook-form's type limitations
              control={control}
              rules={{
                required: fieldConfig.required ? `${fieldConfig.label} is required` : false,
                ...(fieldConfig.validation?.pattern && {
                  pattern: {
                    value: new RegExp(fieldConfig.validation.pattern),
                    message: fieldConfig.validation.message || 'Invalid format',
                  },
                }),
                ...(fieldConfig.validation?.min && {
                  min: {
                    value: fieldConfig.validation.min,
                    message: `Minimum value is ${fieldConfig.validation.min}`,
                  },
                }),
                ...(fieldConfig.validation?.max && {
                  max: {
                    value: fieldConfig.validation.max,
                    message: `Maximum value is ${fieldConfig.validation.max}`,
                  },
                }),
                ...(fieldConfig.validation?.minLength && {
                  minLength: {
                    value: fieldConfig.validation.minLength,
                    message: `Minimum length is ${fieldConfig.validation.minLength} characters`,
                  },
                }),
                ...(fieldConfig.validation?.maxLength && {
                  maxLength: {
                    value: fieldConfig.validation.maxLength,
                    message: `Maximum length is ${fieldConfig.validation.maxLength} characters`,
                  },
                }),
              }}
              render={({ field }) => (
                <div className="space-y-1">
                  {renderField(field, fieldConfig.name)}
                  {errors[fieldConfig.name] && (
                    <p className="text-sm font-medium text-destructive">
                      {errors[fieldConfig.name]?.message as string}
                    </p>
                  )}
                </div>
              )}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelButtonText}
          </Button>
        )}
        <div className="flex items-center gap-2">
          {apiConfig && (
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={() => {
                // Trigger a refetch of the API data
                setApiData(null);
                // The effect will automatically refetch when apiData changes
              }}
              disabled={isSubmitting}
            >
              <RefreshCw className={`h-4 w-4 ${isSubmitting ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {!isReadOnly && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                submitButtonText
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
