export const prerender = true;
export const ssr = true;
export const trailingSlash = 'always';

// Handle 404s during prerendering
export const handleHttpError = ({ status }) => {
  if (status === 404) {
    return {
      status: 200,
      redirect: '/rapidtools/'
    };
  }
}; 