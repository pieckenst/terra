import { FieldType, FormModel } from '@/components/form/types';

export function generateDefaultModel(data: Record<string, any>): FormModel {
  // Recursive helper
  function walk(obj: any, parentKey = ''): any[] {
    if (obj === null || obj === undefined) return [];
    if (Array.isArray(obj)) {
      // If array of primitives or objects
      if (obj.length === 0) return [];
      // If array of objects, use first item for model
      return walk(obj[0], parentKey);
    }
    if (typeof obj !== 'object') return [];
    // .NET $values array
    if ('$values' in obj && Array.isArray(obj['$values'])) {
      return walk(obj['$values'][0], parentKey);
    }
    const fields: any[] = [];
    for (const [key, value] of Object.entries(obj)) {
      let type: FieldType = 'text';
      let subModel: FormModel | undefined = undefined;
      // Special handling for id fields
      if ((/^(id|Id|ID|\$id)$/i.test(key)) && typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'number') {
        type = 'number';
      } else if (typeof value === 'boolean') {
        type = 'checkbox';
      } else if (
        !( /^(id|Id|ID|\$id)$/i.test(key) ) &&
        (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value))))
      ) {
        type = 'date';
      } else if (typeof value === 'string') {
        if (value.includes('@')) {
          type = 'email';
        } else if (value.length > 100) {
          type = 'textarea';
        }
      } else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        // Nested array or object
        if (Array.isArray(value)) {
          type = 'array';
          if (value.length > 0) {
            subModel = { name: key, fields: walk(value[0], key) };
          }
        } else if ('$values' in value && Array.isArray(value['$values'])) {
          type = 'array';
          if (value['$values'].length > 0) {
            subModel = { name: key, fields: walk(value['$values'][0], key) };
          }
        } else if ('$ref' in value) {
          // Reference to another object; just show $ref as text
          type = 'text';
        } else {
          type = 'object';
          subModel = { name: key, fields: walk(value, key) };
        }
      }
      fields.push({
        name: key,
        label: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        type,
        defaultValue: value,
        subModel,
      });
    }
    return fields;
  }

  return {
    name: 'Dynamic Form',
    fields: walk(data),
  };
}

