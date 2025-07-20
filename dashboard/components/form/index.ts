export * from './DynamicForm';
export * from './types';

export function createFormModel(
  name: string, 
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'date' | 'textarea';
    required?: boolean;
    placeholder?: string;
    options?: Array<{ label: string; value: string | number }>;
    defaultValue?: any;
    validation?: {
      pattern?: string;
      min?: number;
      max?: number;
      minLength?: number;
      maxLength?: number;
      message?: string;
    };
  }>
) {
  return {
    name,
    fields: fields.map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: field.required || false,
      placeholder: field.placeholder,
      options: field.options,
      defaultValue: field.defaultValue,
      validation: field.validation,
    })),
  };
}
