export const clerkConfig = {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/dashboard',
  afterSignUpUrl: '/dashboard',
  appearance: {
    elements: {
      formButtonPrimary: 'bg-primary-600 hover:bg-primary-700',
      footerActionLink: 'text-primary-600 hover:text-primary-700',
      card: 'shadow-xl',
    },
    variables: {
      colorPrimary: '#3b82f6',
      fontFamily: 'Inter, system-ui, sans-serif',
    },
  },
};