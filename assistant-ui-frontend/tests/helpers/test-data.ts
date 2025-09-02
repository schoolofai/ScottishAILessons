export const testUsers = {
  validUser: {
    name: 'Test User',
    email: 'test.user@example.com',
    password: 'TestPassword123!',
  },
  anotherValidUser: {
    name: 'Another User',
    email: 'another.user@example.com',
    password: 'AnotherPassword456!',
  },
  invalidUser: {
    email: 'invalid.email',
    password: '123',
    name: '',
  },
};

export const testData = {
  validEmails: [
    'user@example.com',
    'test.email+tag@example.co.uk',
    'user123@test-domain.org',
  ],
  invalidEmails: [
    'invalid',
    'invalid@',
    '@invalid.com',
    'invalid@.com',
    'invalid.email',
  ],
  validPasswords: [
    'Password123!',
    'StrongPass456@',
    'SecurePassword789#',
  ],
  invalidPasswords: [
    '123',        // too short
    'password',   // no numbers/caps
    'PASSWORD',   // no lowercase
    '12345678',   // no letters
  ],
  longText: 'a'.repeat(1000), // for testing input limits
};

export const apiEndpoints = {
  login: '/api/auth/login',
  signup: '/api/auth/signup',
  logout: '/api/auth/logout',
  recovery: '/api/auth/recovery',
  recoveryConfirm: '/api/auth/recovery/confirm',
  googleOAuth: '/api/auth/google',
  googleCallback: '/api/auth/google/callback',
};

export const routes = {
  home: '/',
  login: '/login',
  signup: '/signup',
  resetPassword: '/reset-password',
  chat: '/chat',
};

export const selectors = {
  // Navigation
  navbar: '[data-testid="navbar"]',
  logo: '[data-testid="logo"]',
  loginButton: 'text=Login',
  signupButton: 'text=Get Started',
  
  // Forms
  emailInput: 'input[type="email"]',
  passwordInput: 'input[type="password"]',
  nameInput: 'input[name="name"]',
  confirmPasswordInput: 'input[name="confirmPassword"]',
  submitButton: 'button[type="submit"]',
  
  // Auth buttons
  googleButton: 'text=Continue with Google',
  forgotPasswordLink: 'text=Forgot password?',
  
  // Messages
  errorMessage: '[data-testid="error-message"]',
  successMessage: '[data-testid="success-message"]',
  
  // Loading states
  loadingSpinner: '[data-testid="loading"]',
  
  // Chat interface
  chatInterface: '[data-testid="chat-interface"]',
};