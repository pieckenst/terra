import { toast } from 'sonner';

interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

interface ApiError {
  message: string;
  details?: string;
  code?: string | number;
  status?: number;
}

/**
 * API client with automatic error handling and toast notifications
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  private async handleError(response: Response, endpoint: string): Promise<never> {
    let error: ApiError = {
      message: `HTTP ${response.status}: ${response.statusText}`,
      status: response.status,
    };

    try {
      const data = await response.json();
      error = {
        ...error,
        message: data.message || data.error || error.message,
        details: data.details,
        code: data.code,
      };
    } catch {
      // Failed to parse JSON, use default error
    }

    // Show toast notification
    const toastOptions = {
      description: error.message,
      action: error.status === 401 ? {
        label: 'Login',
        onClick: () => window.location.href = '/login',
      } : undefined,
    };

    switch (response.status) {
      case 400:
        toast.error('Bad Request', toastOptions);
        break;
      case 401:
        toast.error('Unauthorized', toastOptions);
        break;
      case 403:
        toast.error('Forbidden', { description: 'You do not have permission to perform this action' });
        break;
      case 404:
        toast.error('Not Found', { description: error.message || 'The requested resource was not found' });
        break;
      case 429:
        toast.error('Too Many Requests', { description: 'Please wait before trying again' });
        break;
      case 500:
        toast.error('Server Error', { description: 'An internal server error occurred. Please try again later.' });
        break;
      default:
        toast.error(`API Error (${endpoint})`, toastOptions);
    }

    throw error;
  }

  async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(endpoint, params);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
      });

      if (!response.ok) {
        await this.handleError(response, endpoint);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }
      
      return {} as T;
    } catch (error) {
      // Re-throw ApiError instances (already handled)
      if ((error as ApiError).status) {
        throw error;
      }

      // Handle network errors
      const message = error instanceof Error ? error.message : 'Network error occurred';
      toast.error('Network Error', { description: message });
      
      throw {
        message,
        details: error instanceof Error ? error.stack : undefined,
      } as ApiError;
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Default API client instance
export const api = new ApiClient('/api');

/**
 * Hook for using the API client with error handling
 */
export function useApi() {
  return api;
}

/**
 * Utility function for making API calls with loading state
 */
export async function withLoading<T>(
  promise: Promise<T>,
  setLoading: (loading: boolean) => void,
  onSuccess?: (data: T) => void,
  onError?: (error: unknown) => void
): Promise<T | null> {
  try {
    setLoading(true);
    const data = await promise;
    onSuccess?.(data);
    return data;
  } catch (error) {
    onError?.(error);
    return null;
  } finally {
    setLoading(false);
  }
}

/**
 * Utility function for API calls with toast notifications
 */
export async function withToast<T>(
  promise: Promise<T>,
  options: {
    loading?: string;
    success?: string;
    error?: string;
  } = {}
): Promise<T | null> {
  const { loading = 'Processing...', success, error: errorMessage } = options;
  
  return toast.promise(promise, {
    loading,
    success: (data) => {
      if (success) {
        return success;
      }
      return 'Operation completed successfully';
    },
    error: (err) => {
      const message = err instanceof Error ? err.message : 
        typeof err === 'object' && err !== null && 'message' in err 
          ? String((err as Record<string, unknown>).message)
          : errorMessage || 'An error occurred';
      return message;
    },
  });
}
