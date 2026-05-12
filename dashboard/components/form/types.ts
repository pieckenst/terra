export type InputType = 'text' | 'number' | 'email' | 'password';
export type FieldType = InputType | 'select' | 'checkbox' | 'date' | 'textarea' | 'array' | 'object';

export interface FieldOption {
  label: string;
  value: string | number;
}

export interface FieldConfig {
  name: string;
  label?: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    message?: string;
  };
  // For nested objects/arrays
  subModel?: FormModel;
}

export interface FormModel {
  name: string;
  fields: FieldConfig[];
  endpoint?: string;
}

export type CrudOperation = 'create' | 'read' | 'update' | 'delete';

export type ModelSource = FormModel | string | (() => Promise<FormModel>);

export interface DynamicFormProps {
  model: ModelSource;
  operation: CrudOperation;
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void> | void;
  onCancel?: () => void;
  submitButtonText?: string;
  cancelButtonText?: string;
  onModelLoaded?: (model: FormModel) => void;
  onModelError?: (error: Error) => void;
}
