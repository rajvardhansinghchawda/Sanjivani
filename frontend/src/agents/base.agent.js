export class AarogyamError extends Error {
  constructor(message, status, code, details = null) {
    super(message);
    this.name = 'AarogyamError';
    this.status = status;
    this.code = code;
    this.details = details; // field-level errors or upgrade contexts
  }
}

export class AgentBase {
  /**
   * Unwraps the { data: { success, data, error } } envelope
   */
  async _call(requestPromise) {
    try {
      const response = await requestPromise;
      const payload = response.data;

      if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
        const method = (response.config?.method || 'GET').toUpperCase();
        const url = `${response.config?.baseURL || ''}${response.config?.url || ''}`;
        console.groupCollapsed(`[API:DATA] ${method} ${url}`);
        console.log('unwrapped payload:', payload?.data);
        console.groupEnd();
      }

      // Unpack standard response
      if (!payload.success) {
        throw new AarogyamError(
          payload.error?.message || 'Request failed',
          response.status,
          payload.error?.code || 'UNKNOWN_ERROR',
          payload.error?.details
        );
      }
      return payload.data;
    } catch (error) {
      if (error instanceof AarogyamError) {
        throw error;
      }
      
      // Handle Axios Errors
      if (error.response) {
        const payload = error.response.data;
        if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_API === 'true') {
          const method = (error.config?.method || 'GET').toUpperCase();
          const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
          console.groupCollapsed(`[API:DATA_ERROR] ${method} ${url}`);
          console.log('payload:', payload);
          console.groupEnd();
        }
        throw new AarogyamError(
          payload?.error?.message || error.message,
          error.response.status,
          payload?.error?.code || 'API_ERROR',
          payload?.error?.details
        );
      } else if (error.request) {
        throw new AarogyamError('Network error. Please check your connection.', 0, 'NETWORK_ERROR');
      } else {
        throw new AarogyamError(error.message, 0, 'CLIENT_ERROR');
      }
    }
  }

  // Convenience wrappers
  _get(promise) { return this._call(promise); }
  _post(promise) { return this._call(promise); }
  _put(promise) { return this._call(promise); }
  _patch(promise) { return this._call(promise); }
  _delete(promise) { return this._call(promise); }
}
