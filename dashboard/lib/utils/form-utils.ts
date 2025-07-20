import { FieldType, FormModel } from '@/components/form/types';

export function generateDefaultModel(data: Record<string, any>): FormModel {
  const fields = Object.entries(data).map(([key, value]) => {
    let type: FieldType = 'text';
    
    if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'boolean') {
      type = 'checkbox';
    } else if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
      type = 'date';
    } else if (typeof value === 'string') {
      if (value.includes('@')) {
        type = 'email';
      } else if (value.length > 100) {
        type = 'textarea';
      }
    }

    return {
      name: key,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
      type,
      defaultValue: value,
    };
  });

  return {
    name: 'Dynamic Form',
    fields,
  };
}
