import { toast } from 'sonner';

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  data?: any;
  baseUrl?: string;
  withCredentials?: boolean;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private authToken: string | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public async request<T>(
    method: RequestMethod,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      headers = {},
      params = {},
      data,
      baseUrl,
      withCredentials = false,
      ...restOptions
    } = options;

    // Build URL with query parameters
    const url = new URL(
      endpoint,
      baseUrl || this.baseUrl || window.location.origin
    );

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    // Prepare headers
    const requestHeaders: HeadersInit = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Add auth token if available
    if (this.authToken && !requestHeaders['Authorization']) {
      requestHeaders['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Prepare request config
    const config: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: withCredentials ? 'include' : 'same-origin',
      ...restOptions,
    };

    // Add request body for non-GET requests
    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url.toString(), config);
      
      // Handle non-2xx responses
      if (!response.ok) {
        const errorData = await this.parseResponse(response);
        throw new ApiError(
          errorData?.message || 'An error occurred',
          response.status,
          errorData
        );
      }

      // Parse and return response data
      return await this.parseResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error',
        0,
        error
      );
    }
  }

  private async parseResponse(response: Response) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  // HTTP method shortcuts
  get<T>(endpoint: string, options: Omit<RequestOptions, 'data'> = {}) {
    return this.request<T>('GET', endpoint, options);
  }

  post<T>(endpoint: string, data?: any, options: RequestOptions = {}) {
    return this.request<T>('POST', endpoint, { ...options, data });
  }

  put<T>(endpoint: string, data?: any, options: RequestOptions = {}) {
    return this.request<T>('PUT', endpoint, { ...options, data });
  }

  delete<T>(endpoint: string, options: RequestOptions = {}) {
    return this.request<T>('DELETE', endpoint, options);
  }

  patch<T>(endpoint: string, data?: any, options: RequestOptions = {}) {
    return this.request<T>('PATCH', endpoint, { ...options, data });
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Create a default instance with enhanced error handling
export const api = new (class extends ApiClient {
  constructor() {
    super(process.env.NEXT_PUBLIC_API_BASE_URL);
  }

  override async request<T>(
    method: RequestMethod,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    try {
      return await super.request<T>(method, endpoint, options);
    } catch (error) {
      if (error instanceof ApiError) {
        // Handle specific error codes
        switch (error.status) {
          case 401:
            // Handle unauthorized
            toast.error('Session expired. Please log in again.');
            // Redirect to login or refresh token
            break;
          case 403:
            toast.error('You do not have permission to perform this action.');
            break;
          case 404:
            toast.error('The requested resource was not found.');
            break;
          case 500:
            toast.error('A server error occurred. Please try again later.');
            break;
          default:
            toast.error(error.message || 'An error occurred');
        }
      } else {
        toast.error('A network error occurred. Please check your connection.');
      }
      throw error;
    }
  }
})();

export default api;
