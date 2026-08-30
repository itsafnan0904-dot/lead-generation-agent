export class AIOutputValidationError extends Error {
  public readonly errors: any[];
  public readonly rawContent: string;

  constructor(message: string, errors: any[] = [], rawContent: string = '') {
    super(message);
    this.name = 'AIOutputValidationError';
    this.errors = errors;
    this.rawContent = rawContent;
    Object.setPrototypeOf(this, AIOutputValidationError.prototype);
  }
}

export class AIProviderTransientError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AIProviderTransientError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AIProviderTransientError.prototype);
  }
}

export class AIProviderFatalError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AIProviderFatalError';
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AIProviderFatalError.prototype);
  }
}
